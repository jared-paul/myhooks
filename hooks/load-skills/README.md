# load-skills

> A `SessionStart` hook that tells the model to load and apply a configurable list of skills for the session.

## What it does

On session start, the hook emits a short instruction listing the skills you've configured and tells the model to load each one — via the `Skill` tool if registered, otherwise by reading the `SKILL.md` at the path shown. The hook itself never reads skill bodies; it just resolves paths and prints the directive, so the cost per session is one line per skill instead of every skill's full text.

## Configure

The config lives inside agenthooks's managed tree, scoped **per-hook**:

```
~/.agents/hooks/<hook-id>/config.json
```

For this hook: `~/.agents/hooks/load-skills/config.json`. The path is keyed by hook id (not the manifest hash), so it survives edits to `hooks.json`. And because it sits under the hook's installed dir, `agenthooks remove myhooks` deletes it along with the hook — the config's lifecycle is tied to the hook.

Resolution order:

1. `$MYHOOKS_LOAD_SKILLS_CONFIG` — explicit override (optional, e.g. for testing)
2. `~/.agents/hooks/load-skills/config.json` — default

To set up after installing, start a session — the hook prints the exact `cp` command. Then edit the config and restart.

Each entry in `skills` can be:

| Entry shape | Resolves to |
|---|---|
| `"caveman"` | `~/.claude/skills/caveman/SKILL.md` (override dir with `$MYHOOKS_SKILLS_DIR`) |
| `"/abs/path/to/dir"` | `<dir>/SKILL.md` |
| `"/abs/path/to/notes.md"` | the file itself |

```json
{
  "skills": [
    "caveman",
    "simplify",
    "/home/me/src/my-skills/team-workflow",
    "/home/me/notes/coding-style.md"
  ]
}
```

## How it works

- Claude Code and Codex both inject a `SessionStart` hook's output into the session context. The directive — "Load and apply these N skills for the session" plus a `name → SKILL.md path` list — is emitted as the JSON envelope both agents document (`hookSpecificOutput.additionalContext`), because Codex's TUI rejects plain-text stdout with "invalid session start JSON output". The model loads each however its harness loads skills; the hook stays out of the mechanism.
- The hook only `stat`s files to resolve paths — it never reads skill contents — so session-start cost is flat regardless of how big the skills are.
- The hook never exits non-zero. Missing config, bad JSON, and unresolvable entries degrade to a warning line — they never block the session.
- The Codex matcher is `startup|resume` so the hook skips `/clear`. Override via the manifest if you want different behavior.

### Why an instruction, not injected content

A `SessionStart` hook can put text into context but can't register new invokable skills — Claude Code discovers those from `~/.claude/skills/` at process startup, before hooks run. So instead of dumping every skill's body up front, the hook points the model at them and lets it load each one lazily through whatever its harness offers. Cheaper at start, and agent-agnostic: it doesn't assume a specific skill-loading tool.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MYHOOKS_LOAD_SKILLS_CONFIG` | — | Override config file path (optional) |
| `MYHOOKS_SKILLS_DIR` | `~/.claude/skills` | Resolve bare skill names against this dir |
