#!/usr/bin/env node
// PreToolUse half of tool-latency — stamp a start time for the session's
// current tool call. record.mjs (PostToolUse) turns the stamp into a duration.
// Never exits non-zero: a broken timer must not block the tool call.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env, exit } from "node:process";

const DIR = env.MYHOOKS_LATENCY_DIR ?? join(homedir(), ".agents", "tool-latency");
const STATE = join(DIR, "state.json");

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}") ?? {};
  } catch {
    return {};
  }
}

function readState() {
  try {
    const s = JSON.parse(readFileSync(STATE, "utf8"));
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  } catch {
    return {};
  }
}

try {
  const payload = readPayload();
  const session = payload.session_id;
  const tool = payload.tool_name;
  if (typeof session === "string" && session && typeof tool === "string" && tool) {
    const state = readState();
    state[session] = { tool, start: Date.now() };
    mkdirSync(DIR, { recursive: true });
    const tmp = STATE + ".tmp";
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, STATE);
  }
} catch {
  // timing is best-effort
}
exit(0);
