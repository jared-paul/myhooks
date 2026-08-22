#!/usr/bin/env node
// SessionStart hook — emit a one-line banner (agent · project · resume marker)
// so you always know which window is which. Plain text: no colors, no decoration.
// Never exits non-zero.
//
// Hooks run without a controlling terminal, so /dev/tty and escape-sequence
// tricks can't reach the UI. The documented channel is JSON on stdout:
// systemMessage shows the line in the transcript, and terminalSequence sets
// the terminal/window title — persistent per-window identification.
// MYHOOKS_BANNER_PLAIN=1 emits the bare line instead (Codex path).

import { readFileSync } from "node:fs";
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
const line = `▸ ${parts.join(" · ")}`;

if (env.MYHOOKS_BANNER_PLAIN) {
  stdout.write(`${line}\n`);
} else {
  stdout.write(
    JSON.stringify({
      systemMessage: line,
      terminalSequence: `\x1b]0;${line}\x07`,
    }),
  );
}
exit(0);
