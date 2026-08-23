#!/usr/bin/env node
// PostToolUse half of lint-edits — run the project's own linter on the file(s)
// an edit just changed and hand the findings back to the model as
// {"decision":"block","reason":...} so it fixes them right away. JSON works on
// both harnesses (Codex rejects plain stdout); never exits non-zero: a broken
// linter must not interfere with the tool result.

import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, dirname, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { env, exit, stdout } from "node:process";
import { pathToFileURL } from "node:url";

const TIMEOUT_MS = Number(env.MYHOOKS_LINT_TIMEOUT_MS ?? 30_000);
const MAX_FILES = 10;
const MAX_REASON = 6000;
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

const LINTABLE_EXT = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx", ".jsx",
  ".vue", ".svelte", ".astro",
]);

// Ordered by priority: the config file that appears nearest the edited file
// picks the linter.
export const LINTERS = [
  {
    name: "biome",
    configs: ["biome.json", "biome.jsonc"],
    args: (f) => ["lint", "--no-errors-on-unmatched", "--max-diagnostics=20", f],
  },
  {
    name: "eslint",
    configs: [
      "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
      "eslint.config.ts", "eslint.config.mts", "eslint.config.cts",
      ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json",
      ".eslintrc.yml", ".eslintrc.yaml",
    ],
    // --no-warn-ignored is flat-config-only (eslint >= 9); eslint 8 rejects it.
    args: (f, found) => (found && found.startsWith("eslint.config") ? ["--no-warn-ignored", f] : [f]),
  },
  {
    name: "oxlint",
    configs: [".oxlintrc.json"],
    args: (f) => [f],
  },
];

export function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}") ?? {};
  } catch {
    return {};
  }
}

/** Unique edited file paths from a PostToolUse payload (Edit/Write/MultiEdit
 * tool_input, or a Codex apply_patch body). */
function editedFiles(payload) {
  const input = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
  const paths = [];
  const push = (p) => {
    if (typeof p === "string" && p) paths.push(p);
  };

  push(input.file_path);
  for (const e of Array.isArray(input.edits) ? input.edits : []) {
    if (e && typeof e === "object") push(e.file_path);
  }
  // Codex apply_patch bodies carry the file list inside the patch text.
  for (const key of ["input", "patch"]) {
    if (typeof input[key] === "string") {
      for (const m of input[key].matchAll(/^\*\*\* (?:Add|Update|Modified) File: (.+)$/gm)) {
        push(m[1]);
      }
    }
  }

  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const out = new Set();
  for (const p of paths) {
    const abs = isAbsolute(p) ? p : join(cwd, p);
    if (abs.includes("/node_modules/")) continue;
    if (!LINTABLE_EXT.has(extname(abs).toLowerCase())) continue;
    out.add(abs);
  }
  return [...out].slice(0, MAX_FILES);
}

/** Nearest ancestor dir of `from` (inclusive) containing one of `names`. */
export function findUp(from, names) {
  let dir = from;
  for (;;) {
    for (const n of names) {
      if (existsSync(join(dir, n))) return { dir, found: n };
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function localBin(configDir, cmd) {
  const bin = findUp(configDir, [`node_modules/.bin/${cmd}`]);
  return bin ? join(bin.dir, `node_modules/.bin/${cmd}`) : null;
}

function run(linter, configDir, file, configName) {
  const bin = localBin(configDir, linter.name);
  const cmd = bin ? [bin] : ["npx", "--silent", "--no-install", linter.name];
  const res = spawnSync(cmd[0], [...cmd.slice(1), ...linter.args(file, configName)], {
    cwd: configDir,
    timeout: TIMEOUT_MS,
    encoding: "utf8",
  });
  if (res.error || res.status === 0) return null;
  const out = ((res.stdout || "") + (res.stderr || "")).replace(ANSI_RE, "");
  return out.trim() ? out.trim() : null;
}

// check.mjs imports the detection helpers above; only act when run directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const payload = readPayload();
    const files = editedFiles(payload);
    if (files.length === 0) exit(0);

    const parts = [];
    for (const file of files) {
      const hit = findUp(dirname(file), LINTERS.flatMap((l) => l.configs));
      if (!hit) continue; // no linter configured — nothing to say
      const linter = LINTERS.find((l) => l.configs.includes(hit.found));
      const out = run(linter, hit.dir, file, hit.found);
      if (out) parts.push(out);
    }
    if (parts.length === 0) exit(0);

    const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
    const rel = files.map((f) => relative(cwd, f) || f).join(", ");
    let reason = `Linter reported problems in ${rel}:\n\n${parts.join("\n\n")}`;
    if (reason.length > MAX_REASON) reason = reason.slice(0, MAX_REASON) + "\n…(truncated)";
    stdout.write(JSON.stringify({ decision: "block", reason }));
  } catch {
    // best-effort; never break the session over linting
  }
  exit(0);
}
