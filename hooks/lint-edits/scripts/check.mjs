#!/usr/bin/env node
// SessionStart half of lint-edits — if this project configures a linter but
// the linter isn't installed, say so once at startup so the silence of the
// PostToolUse hook isn't mistaken for clean lint. Plain stdout, like
// session-banner; both harnesses display SessionStart stdout. Never exits
// non-zero.

import { spawnSync } from "node:child_process";
import { exit, stdout } from "node:process";
import { LINTERS, readPayload, findUp, localBin } from "./lint.mjs";

const VERSION_TIMEOUT_MS = 15_000;

try {
  const payload = readPayload();
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();

  const hit = findUp(cwd, LINTERS.flatMap((l) => l.configs));
  if (!hit) exit(0); // no linter configured — the edit hook is inert by design
  const linter = LINTERS.find((l) => l.configs.includes(hit.found));

  if (localBin(hit.dir, linter.name)) exit(0);
  const res = spawnSync("npx", ["--silent", "--no-install", linter.name, "--version"], {
    cwd: hit.dir,
    timeout: VERSION_TIMEOUT_MS,
    encoding: "utf8",
  });
  if (!res.error && res.status === 0) exit(0);

  stdout.write(
    `lint-edits: ${hit.found} found but ${linter.name} isn't installed — edits won't be linted. ` +
      `Fix with \`npm i -D ${linter.name}\`, or \`npx @cerealbox/hooks remove lint-edits\` to drop the hook.\n`,
  );
} catch {
  // best-effort; never break session start
}
exit(0);
