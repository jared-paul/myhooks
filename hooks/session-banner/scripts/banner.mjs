#!/usr/bin/env node
// SessionStart hook — emit a one-line banner (agent · project · source marker)
// so you always know which window is which. Plain text: no colors, no decoration.
// Never exits non-zero.
//
// Hooks run without a controlling terminal, so /dev/tty and escape-sequence
// tricks can't reach the UI. The documented channel is JSON on stdout:
// systemMessage shows the line to the user (Claude Code transcript; Codex UI).
// Claude Code additionally supports terminalSequence, which we use to set the
// terminal/window title — Codex's schema has no such field, so we omit it there.

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
if (payload.source === "resume" || payload.source === "clear" || payload.source === "compact") {
  parts.push(payload.source);
}
const line = `▸ ${parts.join(" · ")}`;

const out = { systemMessage: line };
if (agent !== "codex") out.terminalSequence = `\x1b]0;${line}\x07`;

stdout.write(JSON.stringify(out));
exit(0);
