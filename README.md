# myhooks

> Personal collection of agent hooks for Claude Code + Codex. Each subdirectory under `hooks/` is a self-contained package installable with [`agenthooks`](https://github.com/jared-paul/agenthooks).

## Hooks

| Hook | Event | What it does |
|---|---|---|
| [`load-skills`](./hooks/load-skills/) | `SessionStart` | Tell the model to load and apply a configurable list of skills for the session |

## Install a hook

```sh
npx agenthooks add ./hooks/<name>     # merge into ~/.claude/settings.json + ~/.codex/hooks.json
npx agenthooks list                   # show installed packages + drift
npx agenthooks remove <name>          # remove cleanly
```

> Remote sources (`github:`) are planned for agenthooks; until then, clone and `add` by local path.

## Adding a hook

Drop a new directory under `hooks/` with a `hooks.json` manifest (see [agenthooks](https://github.com/jared-paul/agenthooks) for the format) and add a row to the table above.

## License

MIT
