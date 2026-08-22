#!/usr/bin/env node
// Manual CLI for tool-latency — print p50/p95/max per tool from latency.ndjson.
// Run directly: node summary.mjs [--hours N]   (default 24)

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { argv, env, exit } from "node:process";

const DIR = env.MYHOOKS_LATENCY_DIR ?? join(homedir(), ".agents", "tool-latency");
const LOG = join(DIR, "latency.ndjson");

const hoursIdx = argv.indexOf("--hours");
const hours =
  hoursIdx !== -1 && Number(argv[hoursIdx + 1]) > 0 ? Number(argv[hoursIdx + 1]) : 24;

if (!existsSync(LOG)) {
  console.log(`no data yet — ${LOG} not found`);
  exit(0);
}

const cutoff = Date.now() - hours * 3600 * 1000;
const samples = new Map();
for (const line of readFileSync(LOG, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  if (typeof row.tool !== "string" || typeof row.ms !== "number" || row.ms < 0) continue;
  if (Date.parse(row.ts) < cutoff) continue;
  if (!samples.has(row.tool)) samples.set(row.tool, []);
  samples.get(row.tool).push(row.ms);
}

if (samples.size === 0) {
  console.log(`no tool calls recorded in the last ${hours}h`);
  exit(0);
}

function pct(sorted, p) {
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

function fmt(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : Math.round(ms) + "ms";
}

const rows = [...samples.entries()].map(([tool, arr]) => {
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    tool,
    n: arr.length,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    max: sorted[sorted.length - 1],
  };
});
rows.sort((a, b) => b.p95 - a.p95);

const w = Math.max(...rows.map((r) => r.tool.length), "tool".length);
console.log(`last ${hours}h — ${rows.reduce((n, r) => n + r.n, 0)} calls`);
console.log(`${"tool".padEnd(w)}    n   p50     p95     max`);
for (const r of rows) {
  console.log(
    `${r.tool.padEnd(w)}  ${String(r.n).padStart(3)}  ${fmt(r.p50).padStart(6)}  ${fmt(r.p95).padStart(6)}  ${fmt(r.max).padStart(6)}`,
  );
}
exit(0);
