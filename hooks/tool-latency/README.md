# tool-latency

> Records how long every tool call took, then summarizes p50/p95/max per tool.

## How it works

Timing a tool call takes two hooks, because the `PostToolUse` payload carries no start time:

- **`PreToolUse`** (`mark.mjs`) stamps `{ tool, start }` into `~/.agents/tool-latency/state.json`, keyed by `session_id`.
- **`PostToolUse`** (`record.mjs`) pairs with the stamp, appends `{ ts, session, tool, ms }` to `~/.agents/tool-latency/latency.ndjson`, and clears the stamp.

A stamp that doesn't match the completing call's tool (missed `PreToolUse`, parallel interleaving) is dropped rather than logged with a bogus duration.

Measuring from inside hooks means each recorded duration includes ~50ms of Node startup on the `PostToolUse` side — treat sub-100ms readings as "fast", not as exact.

## Summary

```sh
node hooks/tool-latency/scripts/summary.mjs --hours 24
```

Installed via @cerealbox/hooks, the script lands under `~/.agents/hooks/` — `npx @cerealbox/hooks list` shows the installed path.

Prints per-tool call count, p50, p95, and max over the window, sorted by p95:

```
last 24h — 412 calls
tool          n     p50     p95     max
Bash        180   412ms    3.2s   41.0s
Read        167    38ms    95ms    612ms
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MYHOOKS_LATENCY_DIR` | `~/.agents/tool-latency` | Where `state.json` + `latency.ndjson` live |

Both hook scripts never exit non-zero — a broken timer must not block or annotate tool calls.

## Install

```sh
npx @cerealbox/hooks add ./hooks/tool-latency
```

Removes cleanly with `npx @cerealbox/hooks remove tool-latency`. Uninstalling keeps `latency.ndjson` (it's outside the managed tree) — delete `~/.agents/tool-latency` yourself if you want the data gone.
