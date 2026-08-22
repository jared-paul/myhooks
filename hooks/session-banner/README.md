# session-banner

> A `SessionStart` hook that prints a one-line banner — agent · project — so you always know which window is which.

## What it prints

```
▸ claude · yacb
▸ codex · hooks-internal · resume
```

Plain text only: no colors, no decoration, so it survives every terminal theme. The `resume` / `clear` marker is appended when the session is restored rather than freshly started (Claude Code reports this via the hook payload's `source` field).

## Where it shows up

Hooks run without a controlling terminal, so stdout alone is context for the model, and `/dev/tty` is unreachable. The hook emits JSON instead, using each agent's documented output fields:

- `systemMessage` — the banner line, shown to the user (Claude Code transcript; Codex UI)
- `terminalSequence` — Claude Code only: sets the terminal/window title to the same line, so every window stays labeled after the scrollback moves on. Omitted for Codex, whose schema has no such field (unknown fields mark the hook failed).

## Agent detection

The agent label comes from `MYHOOKS_BANNER_AGENT`, which the manifest sets to `codex` in the Codex-specific command override. Claude Code gets the default `claude`. To relabel (e.g. a second Claude install), set the env var yourself in the installed command.

## Codex matcher

Codex's override pins the matcher to `startup|resume` so re-running on `/clear` doesn't double-print.

## Install

```sh
npx @cerealbox/hooks add ./hooks/session-banner
```

Removes cleanly with `npx @cerealbox/hooks remove session-banner`.
