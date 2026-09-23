import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, type BrowserContext } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORTAL_URL = "https://internyx.ellipsonic.com/";

const USER_DATA_DIR = path.join(__dirname, "..", ".browser-profile");

let contextPromise: Promise<BrowserContext> | null = null;

/**
 * Returns a shared, persistent headed browser context. Reusing one process-wide
 * context (rather than opening a fresh browser per call) means a session logged
 * in manually stays logged in for subsequent tool calls, and the window stays
 * open after filling the diary so the user can review/submit it themselves.
 */
export function getBrowserContext(): Promise<BrowserContext> {
  if (!contextPromise) {
    contextPromise = chromium
      .launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 900 },
      })
      .catch((err) => {
        // Don't cache a failed launch — otherwise every later call fails the
        // same way until the process restarts, even if the cause (e.g. the
        // profile being locked by another Chrome instance) has cleared.
        contextPromise = null;
        throw err;
      });
  }
  return contextPromise;
}
