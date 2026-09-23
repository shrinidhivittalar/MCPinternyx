import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "mcp-internyx.log");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function write(line: string) {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
}

export function log(event: string, details?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  write(JSON.stringify(entry));
}
