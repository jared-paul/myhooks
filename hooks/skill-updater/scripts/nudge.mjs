#!/usr/bin/env node
// Stop half of skill-updater — if this session used any skills and we haven't
// asked yet, block the stop once with a continuation reason telling the model
// to decide whether any skill's content should be updated based on how the
// session went, and to get the user's confirmation before editing. Both
// harnesses accept {"decision":"block","reason":...} on Stop; Codex requires
// JSON here (plain stdout is invalid for its Stop event).
// Never exits non-zero.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env, exit, stdout } from "node:process";

const DIR = env.MYHOOKS_SKILL_DIR ?? join(homedir(), ".agents", "skill-updater");
const STATE = join(DIR, "state.json");
const PRUNE_AFTER_MS = 7 * 24 * 3600 * 1000;

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

function reason(rec) {
  const lines = Object.entries(rec.skills)
    .map(([name, path]) => (typeof path === "string" ? `- ${name} (${path})` : `- ${name}`))
    .join("\n");
  return (
    `Skill check — these skills were used this session:\n${lines}\n\n` +
    "Decide whether any of their content should be updated based on how the session went " +
    "(confusing instructions, missing cases, corrections the user had to repeat). " +
    "If yes, propose the specific edit and ask the user to confirm before writing anything. " +
    "If nothing warrants a change, briefly say the skill check is done and stop."
  );
}

try {
  const payload = readPayload();
  const session = payload.session_id;
  if (typeof session !== "string" || !session) exit(0);
  // Already continued once by this hook — let the turn end.
  if (payload.stop_hook_active === true) exit(0);

  const state = readState();
  const rec = state.sessions?.[session];
  if (!rec || rec.nudged === true) exit(0);
  const skills = rec.skills && typeof rec.skills === "object" ? Object.keys(rec.skills) : [];
  if (skills.length === 0) exit(0);

  rec.nudged = true;
  rec.updated = new Date().toISOString();
  state.sessions[session] = rec;
  const now = Date.now();
  for (const [sid, r] of Object.entries(state.sessions ?? {})) {
    if (!r || now - Date.parse(r.updated ?? "") > PRUNE_AFTER_MS) delete state.sessions[sid];
  }
  writeState(state);

  stdout.write(JSON.stringify({ decision: "block", reason: reason(rec) }));
} catch {
  // best-effort; never block the session on a broken nudge
}
exit(0);
