#!/usr/bin/env node
// SessionStart hook: load a configurable list of skills into the session.
// Output goes to stdout, which both Claude Code and Codex inject into the
// session context on SessionStart. Never exits non-zero — a hook failure must
// not block session start.

import { readFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { argv, env, exit, stdout } from "node:process";

const HOOK_DIR = env.HOOK_DIR ?? dirname(resolve(argv[1]));
const SKILLS_DIR = env.MYHOOKS_SKILLS_DIR ?? join(homedir(), ".claude", "skills");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function resolveConfigPath() {
  if (env.MYHOOKS_SKILLS_CONFIG) return env.MYHOOKS_SKILLS_CONFIG;
  const userCfg = join(homedir(), ".config", "myhooks", "skills.json");
  if (existsSync(userCfg)) return userCfg;
  const pkgCfg = join(HOOK_DIR, "skills.json");
  if (existsSync(pkgCfg)) return pkgCfg;
  return null;
}

// Resolve a config entry to a concrete .md file path, or null if not found.
// Entry may be: a bare skill name ("caveman"), a directory containing SKILL.md,
// or a path to a .md file directly.
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

function loadConfig(configPath) {
  let raw;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch (e) {
    return { error: `cannot read ${configPath}: ${e.message}` };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `invalid JSON in ${configPath}: ${e.message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: `${configPath} must be a JSON object` };
  }
  const skills = parsed.skills;
  if (!Array.isArray(skills)) {
    return { error: `${configPath}: "skills" must be an array` };
  }
  return { skills };
}

// Pull `name:` and `description:` out of YAML frontmatter if present, without
// a YAML dep. Falls back to basename.
function parseFrontmatter(text, fallbackName) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return { name: fallbackName, description: null, body: text };
  const fm = m[1];
  const body = text.slice(m[0].length).replace(/^\n+/, "");
  const nameLine = fm.split("\n").find((l) => /^name:\s/.test(l));
  const descMatch = fm.match(/description:\s*([\s\S]*?)(\n\w+:|\n---$|$)/);
  let name = nameLine ? nameLine.replace(/^name:\s*/, "").trim() : fallbackName;
  let description = null;
  if (descMatch) {
    description = descMatch[1]
      .replace(/^\s*>\s?/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return { name, description, body };
}

function emit(line) {
  stdout.write(line + "\n");
}

function main() {
  // Drain the hook payload; we don't use it but must consume it.
  readStdin();

  const configPath = resolveConfigPath();
  if (!configPath) {
    emit("[myhooks] No skills config found.");
    emit("[myhooks] Create one at ~/.config/myhooks/skills.json — see skills.config.example.json.");
    exit(0);
  }

  const cfg = loadConfig(configPath);
  if ("error" in cfg) {
    emit(`[myhooks] config error — ${cfg.error}`);
    emit("[myhooks] skipping skill load.");
    exit(0);
  }

  const entries = cfg.skills.filter((s) => typeof s === "string");
  const rejected = cfg.skills.length - entries.length;
  const loaded = [];
  const warnings = [];

  for (const entry of entries) {
    const resolved = resolveSkillPath(entry);
    if ("error" in resolved) {
      warnings.push(`${entry} — ${resolved.error}`);
      continue;
    }
    let text;
    try {
      text = readFileSync(resolved.path, "utf8");
    } catch (e) {
      warnings.push(`${entry} — read failed: ${e.message}`);
      continue;
    }
    const alias = basename(entry.replace(/\.md$/, ""));
    const { name, description, body } = parseFrontmatter(text, alias);
    loaded.push({ entry, name, description, body });
  }

  if (loaded.length === 0) {
    emit(`[myhooks] Loaded 0 skills from ${configPath}`);
    if (warnings.length) {
      emit(`[myhooks] ${warnings.length} skill(s) skipped:`);
      for (const w of warnings) emit(`[myhooks]   - ${w}`);
    }
    exit(0);
  }

  emit(`[myhooks] Loaded ${loaded.length} skill(s) from ${configPath}:`);
  for (const s of loaded) emit(`[myhooks]   - ${s.name}`);
  if (warnings.length) {
    emit(`[myhooks] ${warnings.length} skill(s) skipped:`);
    for (const w of warnings) emit(`[myhooks]   - ${w}`);
  }
  if (rejected > 0) {
    const noun = rejected === 1 ? "entry" : "entries";
    emit(`[myhooks] ${rejected} non-string ${noun} ignored.`);
  }
  emit("");

  for (const s of loaded) {
    emit(`# Skill: ${s.name}`);
    if (s.description) emit(`> ${s.description}`);
    emit("");
    emit(s.body.trim());
    emit("");
    emit("---");
    emit("");
  }
}

try {
  main();
} catch (e) {
  emit(`[myhooks] unexpected error: ${e?.stack ?? e}`);
}
exit(0);
