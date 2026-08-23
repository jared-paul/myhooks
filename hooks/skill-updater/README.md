# skill-updater

> If a skill was used this session, ask — once — whether its content should be updated based on how it went. The model proposes the edit; you confirm; nothing is written without your yes.

## How it works

Two hooks:

- **`PostToolUse`** (`mark.mjs`) — records which skills the session used. "Used" means a Skill-tool invocation or any read of a `SKILL.md`. Skill dirs are resolved across `./.claude/skills`, `./.codex/skills`, `~/.claude/skills`, and `~/.codex/skills`, so it works identically from Claude Code and Codex. On Claude Code the manifest matcher narrows to `Skill|Read`; on Codex the script filters every call itself.
- **`Stop`** (`nudge.mjs`) — the first time the model finishes a turn after a skill was used, blocks the stop once with a continuation instruction: decide whether any used skill's content should be updated based on how the session went; if yes, propose the edit and ask the user to confirm before writing; if not, say the check is done and stop.

The nudge fires **at most once per session** (`nudged` flag in state) and respects `stop_hook_active`, so it can't loop. Both hooks never exit non-zero — a broken nudge must not trap the session.

State lives in `~/.agents/skill-updater/state.json` (keyed by session, pruned after 7 days). Uninstalling keeps it — delete the directory yourself if you want it gone.

## What it does not do

- It never edits skills itself. The model proposes, you approve — edits happen through the normal file-edit flow with your permission prompts.
- Skills injected by `load-skills` that the model never invokes or reads aren't counted (nothing observed them).
- Plugin-namespaced skills are tracked by bare name; the nudge lists the name without a resolved path when the skill isn't found in a standard root.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MYHOOKS_SKILL_DIR` | `~/.agents/skill-updater` | Where `state.json` lives |

## Install

```sh
npx @cerealbox/hooks add ./hooks/skill-updater
```

Removes cleanly with `npx @cerealbox/hooks remove skill-updater`.
