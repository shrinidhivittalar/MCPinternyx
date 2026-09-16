#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fillDailyDiary } from "./tools/fillDiary.js";

const server = new McpServer({
  name: "mcp-internyx",
  version: "0.1.0",
});

server.registerTool(
  "fill_daily_diary",
  {
    title: "Fill Internyx Daily Diary",
    description:
      "Opens the Internyx portal in a browser and fills the Daily Diary text field with the given content. " +
      "Does NOT submit or save the entry — you must review and click \"SAVE DIARY ENTRY\" yourself.",
    inputSchema: {
      content: z.string().min(1).describe("The diary text to fill into the Daily Diary field."),
    },
  },
  async ({ content }) => {
    try {
      const result = await fillDailyDiary(content);
      return {
        content: [{ type: "text", text: result.message }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Failed to fill Daily Diary field: ${message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
