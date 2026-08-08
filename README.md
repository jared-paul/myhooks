# myhooks

> A universal `SessionStart` hook that loads a configurable list of skills into every Claude Code + Codex session. Designed to be installed with [`agenthooks`](https://github.com/jared-paul/agenthooks).

## What it does

On every session start, the hook reads a list of skills you've configured and injects their contents into the session context — so the model has those skills' instructions available from the first turn, in every session, on every project.

```sh
# install into ~/.claude/settings.json + ~/.codex/hooks.json
npx agenthooks add /path/to/myhooks

# remove cleanly later
npx agenthooks remove myhooks
```

> **Remote sources (`github:jared-paul/myhooks`) are planned for `agenthooks`; until then, clone this repo and `add` it by local path.**

## Configure

The hook looks for a config file in this order:

1. `$MYHOOKS_SKILLS_CONFIG` — explicit path
2. `~/.config/myhooks/skills.json` — user default (recommended)
3. `$HOOK_DIR/skills.json` — in-package fallback (version-controlled with the hook)

Copy the example and edit:

```sh
mkdir -p ~/.config/myhooks
cp skills.config.example.json ~/.config/myhooks/skills.json
```

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

- Claude Code and Codex both inject a `SessionStart` hook's stdout into the session context. The hook reads each skill's markdown and prints it under a clear `# Skill: <name>` header with the frontmatter description quoted above the body.
- The hook never exits non-zero. Missing config, bad JSON, unreadable files, and unresolvable entries all degrade to a warning line — they never block the session.
- The Codex matcher is `startup|resume` so the hook skips `/clear` (which would re-inject everything mid-session). Override via the manifest if you want different behavior.

### What this is *not*

A `SessionStart` hook can't register skills as invokable tools — Claude Code discovers skills from `~/.claude/skills/` at process startup, before hooks run. This hook makes skill **instructions** available in context. If a skill is also formally installed in the skills dir, the model can still invoke it via the `Skill` tool; otherwise it follows the injected instructions inline.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MYHOOKS_SKILLS_CONFIG` | — | Override config file path |
| `MYHOOKS_SKILLS_DIR` | `~/.claude/skills` | Resolve bare skill names against this dir |

## License

MIT
