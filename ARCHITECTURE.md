# mcp-internyx — Server Architecture

A personal MCP (Model Context Protocol) server that fills the Internyx Daily
Diary field via Playwright. Login and final submission are left to the user.

## What is MCP?

MCP is an open protocol for connecting AI clients (e.g. Claude Code, Claude
Desktop) to external tools and data sources. An **MCP server** exposes tools
with a schema; an **MCP client** discovers them, and when the model decides a
tool is useful, the client sends a structured call, the server executes it,
and the result flows back into the model's context. It standardizes what
would otherwise be bespoke integration code per tool/client pair.

## File structure

### `src/index.ts` — MCP server entrypoint
- Creates an `McpServer` instance named `mcp-internyx`.
- Registers the `fill_daily_diary` tool with a Zod-validated input schema
  (`content: string`) and a description the client uses to decide when to
  call it.
- The handler calls `fillDailyDiary(content)`, catches errors, and returns
  MCP's standard response shape: `{ content: [...], isError?: true }`.
- Connects via `StdioServerTransport` — the server runs as a local subprocess
  talking to the client over stdin/stdout (not a network socket).

### `src/browser.ts` — shared browser lifecycle
- Wraps Playwright's `chromium.launchPersistentContext`, storing profile data
  in `.browser-profile/` so a manually-logged-in session persists across
  runs.
- Uses a module-level `contextPromise` singleton so every tool call reuses
  the same headed (visible) browser window instead of spawning a new one.
- If the launch fails, the cached promise is cleared so a retry isn't
  permanently poisoned (e.g. by a locked profile directory).

### `src/tools/fillDiary.ts` — tool implementation
`fillDailyDiary(content)`:
1. Gets the shared browser context/page, navigates to the portal if needed.
2. Detects a login page (checks for a password input); if found, returns
   `status: "login_required"` and asks the user to log in manually rather
   than automating auth.
3. Clicks the "Diary" nav control (tries several locator strategies in
   order, since the exact DOM role wasn't pinned down) and fills the diary
   `<textarea>`.
4. Does **not** click submit — returns a message telling the user to review
   and save the entry themselves.

## Data flow

```
Claude (client)
  → MCP call fill_daily_diary({content})   [stdio]
  → index.ts handler
  → fillDailyDiary() in fillDiary.ts
  → getBrowserContext() in browser.ts (Playwright/Chromium)
  → fills the field in the real browser window
  → result bubbles back up as MCP tool response text
```

## Design notes

- Automates the tedious part (open portal, click nav, type text) but leaves
  login and final submission as manual human checkpoints.
- Locator strategies are kept as ordered candidate lists so a DOM mismatch
  fails with a clear, diagnosable error instead of a silent no-op.
