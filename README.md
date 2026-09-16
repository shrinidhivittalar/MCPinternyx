# MCPinternyx

A small personal MCP server that fills the Daily Diary text field on the
Internyx internship portal (`https://internyx.ellipsonic.com/`) using
Playwright, so it can be driven from Claude Code.

**This tool only fills the diary field. It never clicks "SAVE DIARY ENTRY".
You always review and submit the entry yourself.**

## What's here

- `src/index.ts` — MCP server (stdio transport) exposing exactly one tool.
- `src/browser.ts` — shared, persistent, headed Playwright browser context.
- `src/tools/fillDiary.ts` — navigates to the portal and fills the diary field.

No database, no credential storage, no scheduling, no other integrations.

## How authentication persistence works

The browser context is launched with `chromium.launchPersistentContext()`
pointed at a local folder, `.browser-profile/` (gitignored). This is the same
mechanism as a normal Chrome profile: cookies and local storage from a login
are saved to disk and reused on the next run. The server never sees or
stores your username/password — you type them into the real Internyx login
page in the visible browser window.

## Setup

```bash
npm install
npx playwright install chromium   # downloads the Chromium browser Playwright drives
npm run build
```

## First login

1. Run the server once directly to trigger a browser launch and confirm setup:
   ```bash
   npm run build && node dist/index.js
   ```
   (It will sit waiting for MCP stdio messages — that's expected; Ctrl+C to stop.)
2. In practice, the browser window opens the first time the `fill_daily_diary`
   tool is actually called (see below). It will land on
   `https://internyx.ellipsonic.com/`. If a login form appears, the tool
   returns a `login_required` message instead of erroring — log in manually
   in that window, then call the tool again. The session persists in
   `.browser-profile/` for all future runs.

## Connecting to Claude Code

Add the server to Claude Code's MCP config (e.g. via `claude mcp add` or your
`~/.claude.json` / project `.mcp.json`):

```json
{
  "mcpServers": {
    "internyx": {
      "command": "node",
      "args": ["/absolute/path/to/MCPinternyx/dist/index.js"]
    }
  }
}
```

Or with the CLI:

```bash
claude mcp add internyx -- node /absolute/path/to/MCPinternyx/dist/index.js
```

Restart Claude Code (or reconnect the server) so it picks up the new tool.

## Using it

Ask Claude Code to fill your diary, e.g.:

> Use fill_daily_diary to log: "Worked on the onboarding module today, fixed
> two bugs in the auth flow."

The tool will:
1. Reuse the persisted browser session (or prompt you to log in if needed).
2. Locate the Daily Diary field and fill it with the given text.
3. Leave the browser open and tell you to review and click
   "SAVE DIARY ENTRY" yourself.

## Testing the tool

You can test without Claude Code using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web UI where you can call `fill_daily_diary` directly with a
`content` string and watch the browser window respond.

## A note on the diary field selector

The Daily Diary field selector in `src/tools/fillDiary.ts`
(`candidateLocators`) was written without being able to inspect the live
portal's DOM (no network access to `internyx.ellipsonic.com` from the dev
environment used to build this). It tries several accessible/semantic
locator strategies in order (label, ARIA role, placeholder, heading-adjacent
textarea, contenteditable). If none match on the real page, the tool throws
an error listing every strategy it tried — inspect the field in the open
browser window (right-click → Inspect) and adjust `candidateLocators()`
accordingly.
