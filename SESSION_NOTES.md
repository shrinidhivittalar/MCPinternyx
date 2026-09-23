# Session Notes

## 2026-09-16

- Discussed how to log an error; clarified scope (codebase error handling vs.
  diary entry vs. something else) — no action taken, awaiting direction.
- Explained what MCP (Model Context Protocol) is, how it works (client/server,
  tools/resources/prompts, stdio/HTTP transports), and why it matters
  (decoupling, composability, reusability).
- Walked through this repo's MCP server structure:
  - `src/index.ts` — server entrypoint, registers the `fill_daily_diary` tool.
  - `src/browser.ts` — shared persistent Playwright browser context.
  - `src/tools/fillDiary.ts` — tool logic: navigate portal, detect login,
    click Diary nav, fill the diary textarea (no auto-submit).
- Wrote `ARCHITECTURE.md` documenting the above (MCP primer + file-by-file
  breakdown + data flow diagram + design notes).
- Created this `SESSION_NOTES.md` file to track session activity.
- Filled today's diary entry into Internyx via the `fill_daily_diary` MCP tool
  (not saved/submitted — left for manual review).
- Discussed Nous Research's Hermes agent: what it is (open-weight fine-tuned
  LLM line, agentic/tool-use focused) and its function-calling harness
  (`<tools>`/`<tool_call>`/`<tool_response>` tag convention plus a hand-rolled
  parse-execute-reinject loop, contrasted with MCP's standardized approach).
