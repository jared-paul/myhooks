#!/usr/bin/env node
// PostToolUse half of tool-latency — pair with the PreToolUse stamp and append
// { ts, session, tool, ms } to latency.ndjson. Silent on success; never exits
// non-zero: a broken timer must not interfere with the tool result.

import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env, exit } from "node:process";

const DIR = env.MYHOOKS_LATENCY_DIR ?? join(homedir(), ".agents", "tool-latency");
const STATE = join(DIR, "state.json");
const LOG = join(DIR, "latency.ndjson");

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

function writeState(state) {
  mkdirSync(DIR, { recursive: true });
  const tmp = STATE + ".tmp";
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, STATE);
}

try {
  const payload = readPayload();
  const session = payload.session_id;
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : "unknown";
  if (typeof session !== "string" || !session) exit(0);

  const state = readState();
  const stamp = state[session];
  delete state[session];
  writeState(state);

  // Only record when the stamp matches this call's tool. Mismatch (missed a
  // PreToolUse, or parallel interleaving) means we can't time it — skip rather
  // than log a bogus duration.
  if (!stamp || stamp.tool !== tool) exit(0);
  const ms = Date.now() - stamp.start;
  if (ms < 0) exit(0);

  const row = JSON.stringify({
    ts: new Date().toISOString(),
    session,
    tool,
    ms,
  });
  mkdirSync(DIR, { recursive: true });
  appendFileSync(LOG, row + "\n");
} catch {
  // timing is best-effort
}
exit(0);
