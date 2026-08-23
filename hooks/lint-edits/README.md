# lint-edits

> After each file edit, runs the project's own linter on the changed file and hands the findings back to the model so it fixes them in the same turn.

## How it works

One `PostToolUse` hook (`lint.mjs`):

1. Extracts the edited file path from the tool input (`Edit` / `Write` / `MultiEdit`, or a Codex `apply_patch` body).
2. Skips non-lintable files (`.md`, images, anything under `node_modules/`).
3. Finds the nearest linter config walking up from the file — **biome** (`biome.json{,c}`) > **eslint** (`eslint.config.*` / `.eslintrc*`) > **oxlint** (`.oxlintrc.json`). No config found = silent no-op, so the hook is safe to install globally.
4. Runs the project-local binary from `node_modules/.bin` (falls back to `npx --no-install`; still nothing = no-op).
5. On findings, prints `{"decision":"block","reason":"<linter output>"}` — the model sees the diagnostics and fixes them. Clean lint, missing linter, or linter crash all exit silently: linting must never break the session.

The hook never runs `--fix` — it reports, the model decides what to change.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MYHOOKS_LINT_TIMEOUT_MS` | `30000` | Kill the linter after this long and stay silent |

## Install

```sh
npx @cerealbox/hooks add ./hooks/lint-edits
```

Removes cleanly with `npx @cerealbox/hooks remove lint-edits`.
