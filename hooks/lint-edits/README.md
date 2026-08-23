# lint-edits

> After each file edit, runs the project's own linter on the changed file and hands the findings back to the model so it fixes them in the same turn.

## How it works

Two hooks:

- **`SessionStart`** (`check.mjs`) — if the project configures a linter but the linter isn't installed (not in `node_modules/.bin`, not resolvable via `npx --no-install`), print a one-line warning so the edit hook's silence isn't mistaken for clean lint. No linter config at all = no warning; the hook is inert by design there.
- **`PostToolUse`** (`lint.mjs`) —
  1. Extracts the edited file path from the tool input (`Edit` / `Write` / `MultiEdit`, or a Codex `apply_patch` body).
  2. Skips non-lintable files (`.md`, images, anything under `node_modules/`).
  3. Finds the nearest linter config walking up from the file — **biome** (`biome.json{,c}`) > **eslint** (`eslint.config.*` / `.eslintrc*`) > **oxlint** (`.oxlintrc.json`). No config found = silent no-op.
  4. Runs the project-local binary from `node_modules/.bin` (falls back to `npx --no-install`; still nothing = no-op).
  5. On findings, prints `{"decision":"block","reason":"<linter output>"}` — the model sees the diagnostics and fixes them.

Every failure says something: linter not installed, linter crash (non-zero exit, no output), timeout, or a bug in the hook itself all emit a `{"systemMessage":...}` warning to the user — once per session per failure kind, so a broken setup isn't mistaken for clean lint. Clean lint, no linter configured, and non-lintable files (`.md`, `node_modules/`, …) stay silent: those are the hook working as intended, not failures. Never exits non-zero.

The hook never runs `--fix` — it reports, the model decides what to change.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MYHOOKS_LINT_TIMEOUT_MS` | `30000` | Kill the linter after this long (emits a timeout warning) |
| `MYHOOKS_LINT_DIR` | `~/.agents/lint-edits` | Where the once-per-session note state lives |

## Install

```sh
npx @cerealbox/hooks add ./hooks/lint-edits
```

Removes cleanly with `npx @cerealbox/hooks remove lint-edits`.
