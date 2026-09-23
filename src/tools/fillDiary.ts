import type { Page } from "playwright";
import { getBrowserContext, PORTAL_URL } from "../browser.js";
import { log } from "../logger.js";

const FIELD_WAIT_TIMEOUT_MS = 10_000;

/**
 * Candidate locator strategies for the "Diary" navigation control, tried in
 * order. One of these matches on the live portal (confirmed via an
 * end-to-end test); the exact accessible role Internyx uses for it wasn't
 * pinned down further, so the full candidate list is kept.
 */
function candidateDiaryNavLocators(page: Page) {
  const nameRe = /^diary$/i;
  return [
    { label: "getByRole('link', { name: /^diary$/i })", locator: page.getByRole("link", { name: nameRe }) },
    { label: "getByRole('button', { name: /^diary$/i })", locator: page.getByRole("button", { name: nameRe }) },
    { label: "getByRole('tab', { name: /^diary$/i })", locator: page.getByRole("tab", { name: nameRe }) },
    { label: "getByRole('menuitem', { name: /^diary$/i })", locator: page.getByRole("menuitem", { name: nameRe }) },
  ] as const;
}

/**
 * Locator for the Daily Diary text field, verified against the live portal's
 * DOM: a <textarea data-slot="textarea" placeholder="Describe what you
 * worked on today, blockers, progress…">.
 */
function candidateFieldLocators(page: Page) {
  return [
    {
      label: "getByPlaceholder(/Describe what you worked on today/i)",
      locator: page.getByPlaceholder(/Describe what you worked on today/i),
    },
  ] as const;
}

async function isLikelyLoginPage(page: Page): Promise<boolean> {
  const hasPasswordField = await page.locator("input[type='password']").count();
  return hasPasswordField > 0;
}

/**
 * Locator for the "SAVE DIARY ENTRY" button, so its click can be observed
 * (see watchForSaveClick). This tool never clicks it itself.
 */
function candidateSaveButtonLocators(page: Page) {
  const nameRe = /save diary entry/i;
  return [
    { label: "getByRole('button', { name: /save diary entry/i })", locator: page.getByRole("button", { name: nameRe }) },
  ] as const;
}

const SAVE_CLICK_BINDING = "__internyxLogSaveClick";

/**
 * Attaches a passive, capture-phase click listener to the Save button that
 * only reports the click for logging — it never calls preventDefault or
 * stopPropagation, so the real save still happens exactly as if this tool
 * weren't watching. Best-effort: if the button can't be found (e.g. layout
 * changed), filling the diary still succeeds without save-click logging.
 */
async function watchForSaveClick(page: Page): Promise<void> {
  try {
    await page.exposeFunction(SAVE_CLICK_BINDING, () => {
      log("save_button.clicked");
    });
  } catch {
    // Already exposed on this page (e.g. a prior fillDailyDiary call this
    // session) — the existing binding still works, nothing more to do.
  }

  try {
    const saveButton = await findFirstVisible(candidateSaveButtonLocators(page), "the Save Diary Entry button", FIELD_WAIT_TIMEOUT_MS);
    await saveButton.evaluate((el, bindingName) => {
      const alreadyWatched = el.getAttribute("data-internyx-watched") === "true";
      if (alreadyWatched) return;
      el.setAttribute("data-internyx-watched", "true");
      el.addEventListener(
        "click",
        () => {
          (window as unknown as Record<string, () => void>)[bindingName]();
        },
        { capture: true }
      );
    }, SAVE_CLICK_BINDING);
    log("save_button.watch_attached");
  } catch {
    log("save_button.watch_not_attached", {
      reason: "Could not locate the Save Diary Entry button, so its click won't be logged.",
    });
  }
}

/**
 * Tries each candidate locator in order, waiting briefly for the first
 * visible match. Throws with the full list of attempted strategies if none
 * appear within the timeout, so a mismatch against the real DOM is easy to
 * diagnose.
 */
async function findFirstVisible(
  candidates: readonly { label: string; locator: ReturnType<Page["locator"]> }[],
  what: string,
  timeoutMs: number
) {
  const tried: string[] = [];
  for (const { label, locator } of candidates) {
    tried.push(label);
    try {
      const first = locator.first();
      await first.waitFor({ state: "visible", timeout: timeoutMs });
      return first;
    } catch {
      // Not found within the timeout with this strategy; try the next.
    }
  }
  throw new Error(
    `Could not locate ${what}. Tried these strategies:\n- ${tried.join("\n- ")}\n` +
      "Inspect the real element in the open browser window and update the corresponding candidate locators in src/tools/fillDiary.ts."
  );
}

export interface FillDiaryResult {
  status: "filled" | "login_required";
  message: string;
}

export async function fillDailyDiary(content: string): Promise<FillDiaryResult> {
  log("fill_daily_diary.start", { contentLength: content.length, content });

  const context = await getBrowserContext();
  const page = context.pages()[0] ?? (await context.newPage());

  if (page.url() === "about:blank" || !page.url().includes("internyx.ellipsonic.com")) {
    log("navigate", { url: PORTAL_URL });
    await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded" });
  }

  if (await isLikelyLoginPage(page)) {
    log("login_required", { url: page.url() });
    return {
      status: "login_required",
      message:
        "The Internyx login page is showing in the browser window. Please log in manually, " +
        "then call fill_daily_diary again — the session will persist for future runs.",
    };
  }

  // Internyx is a single-page dashboard: authenticated sessions stay on
  // /intern/dashboard and the Diary section is revealed by clicking a nav
  // control rather than via a distinct URL. Skip the click if the field is
  // already visible (e.g. a prior call in this session left the section
  // open) — re-clicking an unknown nav control could toggle it closed again
  // if it behaves like an accordion rather than a plain tab/link.
  const fieldAlreadyVisible = await candidateFieldLocators(page)[0].locator.isVisible().catch(() => false);
  if (!fieldAlreadyVisible) {
    const diaryNav = await findFirstVisible(candidateDiaryNavLocators(page), "the Diary navigation control", FIELD_WAIT_TIMEOUT_MS);
    log("click_diary_nav");
    await diaryNav.click();
  }

  const field = await findFirstVisible(candidateFieldLocators(page), "the Daily Diary field", FIELD_WAIT_TIMEOUT_MS);
  await field.click();
  await field.fill(content);
  log("field_filled", { content });

  await watchForSaveClick(page);

  return {
    status: "filled",
    message:
      "The Daily Diary field has been filled in the open browser window. " +
      "Please review the entry yourself and click \"SAVE DIARY ENTRY\" manually — " +
      "this tool does not submit it for you.",
  };
}
