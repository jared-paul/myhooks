# myhooks

> Personal collection of agent hooks for Claude Code + Codex. Each subdirectory under `hooks/` is a self-contained package installable with [`@cerealbox/hooks`](https://github.com/cereal-dot-box/hooks).

## Hooks

| Hook | Event | What it does |
|---|---|---|
| [`load-skills`](./hooks/load-skills/) | `SessionStart` | Tell the model to load and apply a configurable list of skills for the session |
| [`lint-edits`](./hooks/lint-edits/) | `SessionStart` + `PostToolUse` | Run the project's own linter (biome/eslint/oxlint, auto-detected) on the file just edited and feed findings back to the model; warn at startup when the configured linter isn't installed |
| [`session-banner`](./hooks/session-banner/) | `SessionStart` | Print a one-line agent · project banner so you know which window is which |
| [`skill-updater`](./hooks/skill-updater/) | `PostToolUse` + `Stop` | If a skill was used this session, ask once whether its content should be updated based on how it went — you confirm before any edit |
| [`tool-latency`](./hooks/tool-latency/) | `PreToolUse` + `PostToolUse` | Record how long every tool call took; p50/p95 summary per tool |

## Install a hook

```sh
npx @cerealbox/hooks add ./hooks/<name>     # merge into ~/.claude/settings.json + ~/.codex/hooks.json
npx @cerealbox/hooks list                   # show installed packages + drift
npx @cerealbox/hooks remove <name>          # remove cleanly
```

> Remote sources work too: `npx @cerealbox/hooks add github:owner/repo[@ref][#path]`.

## Adding a hook

Drop a new directory under `hooks/` with a `hooks.json` manifest (see [`@cerealbox/hooks`](https://github.com/cereal-dot-box/hooks) for the format) and add a row to the table above.

## License

MIT
