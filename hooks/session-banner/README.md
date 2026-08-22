# session-banner

> A `SessionStart` hook that prints a one-line banner — agent · project — so you always know which window is which.

## What it prints

```
▸ claude · yacb
▸ codex · hooks-internal · resume
```

Plain text only: no colors, no decoration, so it survives every terminal theme. The `resume` / `clear` marker is appended when the session is restored rather than freshly started (Claude Code reports this via the hook payload's `source` field).

## Where it prints

Claude Code captures `SessionStart` stdout into the model's context — the terminal never shows it — so the banner writes directly to `/dev/tty`. If that's unavailable (no controlling terminal), it falls back to stdout.

## Agent detection

The agent label comes from `MYHOOKS_BANNER_AGENT`, which the manifest sets to `codex` in the Codex-specific command override. Claude Code gets the default `claude`. To relabel (e.g. a second Claude install), set the env var yourself in the installed command.

## Codex matcher

Codex's override pins the matcher to `startup|resume` so re-running on `/clear` doesn't double-print.

## Install

```sh
npx agenthooks add ./hooks/session-banner
```

Removes cleanly with `npx agenthooks remove session-banner`.
