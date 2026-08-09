#!/usr/bin/env node
// SessionStart hook: emit a short instruction telling the model to load and
// apply a configurable list of skills. We do NOT dump skill contents — the
// model loads them itself, however its harness loads skills. Never exits
// non-zero (a hook failure must not block session start).

import { readFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { argv, env, exit, stdout } from "node:process";

const HOOK_DIR = env.HOOK_DIR ?? dirname(resolve(argv[1]));
const SKILLS_DIR = env.MYHOOKS_SKILLS_DIR ?? join(homedir(), ".claude", "skills");

function drainStdin() {
  try { readFileSync(0, "utf8"); } catch { /* no stdin is fine */ }
}

function defaultConfigPath() {
  return join(HOOK_DIR, "config.json");
}

function resolveConfigPath() {
  if (env.MYHOOKS_LOAD_SKILLS_CONFIG) return env.MYHOOKS_LOAD_SKILLS_CONFIG;
  const cfg = defaultConfigPath();
  return existsSync(cfg) ? cfg : null;
}

// Resolve a config entry to a concrete SKILL.md path, or {error}. Entry may be:
// a bare skill name ("caveman"), a directory containing SKILL.md, or a .md path.
function resolveSkillPath(entry) {
  if (typeof entry !== "string" || entry.trim() === "") return { error: "empty" };
  const p = entry.trim();
  if (existsSync(p) && statSync(p).isDirectory()) {
    const md = join(p, "SKILL.md");
    return existsSync(md) ? { path: md } : { error: `no SKILL.md in ${p}` };
  }
  if (p.endsWith(".md") && existsSync(p)) return { path: p };
  const guess = join(SKILLS_DIR, p, "SKILL.md");
  if (existsSync(guess)) return { path: guess };
  return { error: `not found (tried ${p} and ${guess})` };
}

function readJson(path) {
  let raw;
  try { raw = readFileSync(path, "utf8"); }
  catch (e) { return { error: `cannot read ${path}: ${e.message}` }; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { error: `invalid JSON in ${path}: ${e.message}` }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: `${path} must be a JSON object` };
  }
  if (!Array.isArray(parsed.skills)) {
    return { error: `${path}: "skills" must be an array` };
  }
  return { skills: parsed.skills };
}

function label(entry) {
  return basename(entry.replace(/\.md$/, "").replace(/\/$/, ""));
}

function emit(line) { stdout.write(line + "\n"); }

function main() {
  drainStdin();

  const configPath = resolveConfigPath();
  if (!configPath) {
    emit("[myhooks] No config found. Set up with:");
    emit(`[myhooks]   cp ${HOOK_DIR}/config.example.json ${HOOK_DIR}/config.json`);
    emit("[myhooks] Then edit the config and restart the session.");
    return;
  }

  const cfg = readJson(configPath);
  if (cfg.error) {
    emit(`[myhooks] config error — ${cfg.error}`);
    emit("[myhooks] skipping skill load.");
    return;
  }

  const entries = cfg.skills.filter((s) => typeof s === "string");
  const rejected = cfg.skills.length - entries.length;
  const resolved = [];
  const warnings = [];
  for (const entry of entries) {
    const r = resolveSkillPath(entry);
    if (r.error) warnings.push(`${entry} — ${r.error}`);
    else resolved.push({ label: label(entry), path: r.path });
  }

  if (resolved.length === 0) {
    emit(`[myhooks] No skills to load from ${configPath}.`);
    if (warnings.length) {
      emit(`[myhooks] ${warnings.length} skill(s) skipped:`);
      for (const w of warnings) emit(`[myhooks]   - ${w}`);
    }
    return;
  }

  // The instruction. Both Claude Code and Codex inject SessionStart stdout
  // into the model's context — this block is read as a session directive.
  emit(`[myhooks] Load and apply these ${resolved.length} skill(s) for the rest of this session:`);
  for (const s of resolved) emit(`[myhooks]   - ${s.label}  →  ${s.path}`);
  emit("[myhooks] Use your harness's skill mechanism where available; otherwise read the SKILL.md path shown.");
  if (warnings.length) {
    emit(`[myhooks] ${warnings.length} skill(s) skipped:`);
    for (const w of warnings) emit(`[myhooks]   - ${w}`);
  }
  if (rejected > 0) {
    const noun = rejected === 1 ? "entry" : "entries";
    emit(`[myhooks] ${rejected} non-string ${noun} ignored.`);
  }
}

try { main(); }
catch (e) { emit(`[myhooks] unexpected error: ${e?.stack ?? e}`); }
exit(0);
