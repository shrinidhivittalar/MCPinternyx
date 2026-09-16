import type { Page } from "playwright";
import { getBrowserContext, PORTAL_URL } from "../browser.js";

const FIELD_WAIT_TIMEOUT_MS = 10_000;

/**
 * Candidate locator strategies for the "Diary" navigation control, tried in
 * order. UNVERIFIED — this session has no network access to the live portal,
 * so these are best-effort accessible-role guesses (a nav link vs. a button
 * are both plausible for a SPA). Confirm against the real DOM locally and
 * adjust.
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
  const context = await getBrowserContext();
  const page = context.pages()[0] ?? (await context.newPage());

  if (page.url() === "about:blank" || !page.url().includes("internyx.ellipsonic.com")) {
    await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded" });
  }

  if (await isLikelyLoginPage(page)) {
    return {
      status: "login_required",
      message:
        "The Internyx login page is showing in the browser window. Please log in manually, " +
        "then call fill_daily_diary again — the session will persist for future runs.",
    };
  }

  // Internyx is a single-page dashboard: authenticated sessions stay on
  // /intern/dashboard and the Diary section is revealed by clicking a nav
  // control rather than via a distinct URL. Click it, then wait for the
  // diary field itself to confirm the section actually rendered.
  const diaryNav = await findFirstVisible(candidateDiaryNavLocators(page), "the Diary navigation control", FIELD_WAIT_TIMEOUT_MS);
  await diaryNav.click();

  const field = await findFirstVisible(candidateFieldLocators(page), "the Daily Diary field", FIELD_WAIT_TIMEOUT_MS);
  await field.click();
  await field.fill(content);

  return {
    status: "filled",
    message:
      "The Daily Diary field has been filled in the open browser window. " +
      "Please review the entry yourself and click \"SAVE DIARY ENTRY\" manually — " +
      "this tool does not submit it for you.",
  };
}
