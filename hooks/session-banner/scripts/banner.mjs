#!/usr/bin/env node
// SessionStart hook — print a one-line banner (agent · project · resume marker)
// so you always know which window is which. Plain text: no colors, no decoration,
// survives every terminal theme. Never exits non-zero.
//
// Claude Code captures SessionStart stdout into the model's context — it never
// reaches the terminal — so the banner goes straight to /dev/tty. stdout is the
// fallback (Codex surfaces hook output in its own UI).

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { env, exit, stdout } from "node:process";

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}") ?? {};
  } catch {
    return {};
  }
}

const payload = readPayload();
const agent = env.MYHOOKS_BANNER_AGENT ?? "claude";
const project = basename(payload.cwd || env.PWD || process.cwd());
const parts = [agent, project];
if (payload.source === "resume" || payload.source === "clear") parts.push(payload.source);
const line = `▸ ${parts.join(" · ")}\n`;

try {
  writeFileSync("/dev/tty", line);
} catch {
  stdout.write(line);
}
exit(0);
