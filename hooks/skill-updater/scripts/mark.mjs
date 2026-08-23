#!/usr/bin/env node
// PostToolUse half of skill-updater — record which skills this session used:
// a Skill-tool invocation, or any read of a SKILL.md. Writes
// { skills: { <name>: <SKILL.md path> } } for the session into state.json.
// Silent on success; never exits non-zero.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { env, exit } from "node:process";

const DIR = env.MYHOOKS_SKILL_DIR ?? join(homedir(), ".agents", "skill-updater");
const STATE = join(DIR, "state.json");
const PRUNE_AFTER_MS = 7 * 24 * 3600 * 1000;

const SKILL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

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

function prune(state, now) {
  let changed = false;
  for (const [sid, rec] of Object.entries(state.sessions ?? {})) {
    if (!rec || now - Date.parse(rec.updated ?? "") > PRUNE_AFTER_MS) {
      delete state.sessions[sid];
      changed = true;
    }
  }
  return changed;
}

/** All roots a skill can live under, most-specific first. */
function skillRoots(cwd) {
  const claudeHome = env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  const codexHome = env.CODEX_HOME ?? join(homedir(), ".codex");
  return [
    join(cwd, ".claude", "skills"),
    join(cwd, ".codex", "skills"),
    join(claudeHome, "skills"),
    join(codexHome, "skills"),
  ];
}

function findSkillMd(cwd, skill) {
  for (const root of skillRoots(cwd)) {
    const md = join(root, skill, "SKILL.md");
    if (existsSync(md)) return md;
  }
  return null;
}

/** Extract {skill, path?} from a PostToolUse payload, or null. */
function extract(payload) {
  const input = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};

  let skill = "";
  let directPath;
  if (typeof input.skill === "string") {
    skill = input.skill;
  } else if (typeof input.file_path === "string" && basename(input.file_path) === "SKILL.md") {
    directPath = input.file_path;
    skill = basename(dirname(input.file_path));
  }
  // plugin-namespaced ids ("plugin:skill") point at plugin caches we don't
  // manage — track the bare skill name instead.
  if (skill.includes(":")) skill = skill.split(":").pop() ?? "";
  skill = skill.trim();
  if (!SKILL_ID_RE.test(skill)) return null;

  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : ".";
  return { skill, path: directPath ?? findSkillMd(cwd, skill) };
}

try {
  const payload = readPayload();
  const session = payload.session_id;
  if (typeof session !== "string" || !session) exit(0);

  const found = extract(payload);
  if (!found) exit(0);

  const now = new Date().toISOString();
  const state = readState();
  state.sessions ??= {};
  const rec = state.sessions[session] ?? { skills: {}, nudged: false };
  rec.skills ??= {};
  rec.skills[found.skill] = found.path ?? null;
  rec.updated = now;
  state.sessions[session] = rec;
  if (prune(state, Date.now())) state.sessions[session] = rec;
  writeState(state);
} catch {
  // tracking is best-effort
}
exit(0);
