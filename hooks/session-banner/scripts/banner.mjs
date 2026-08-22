#!/usr/bin/env node
// SessionStart hook — print a one-line banner (agent · project · resume marker)
// so you always know which window is which. Plain text: no colors, no decoration,
// survives every terminal theme. Never exits non-zero.

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

stdout.write(`▸ ${parts.join(" · ")}\n`);
exit(0);
