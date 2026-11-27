#!/usr/bin/env node
/**
 * Print how much of the Codex 5h and weekly limit is left and when each resets.
 * Exit code 0 when Codex can start a task, 1 when a window is exhausted, 2 without data.
 *
 * Usage: node codex-limit.mjs [--json]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCAN_FILES = 12;
const EXHAUSTED_AT = 100;

/** Reads the `codex` rate limits out of one rollout line, or undefined when the line carries none. */
export function parseRateLimitLine(line) {
  if (!line.includes('"rate_limits"')) return undefined;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return undefined;
  }
  const limits = event?.payload?.rate_limits;
  if (!limits?.primary || limits.limit_id !== 'codex') return undefined;
  const at = Date.parse(event.timestamp);
  if (Number.isNaN(at)) return undefined;
  return { at, primary: limits.primary, secondary: limits.secondary };
}

/** Turns a window into what is left now: a window past its reset is full again. */
export function windowStatus(window, now) {
  if (!window) return undefined;
  const resetsAt = window.resets_at * 1000;
  const expired = resetsAt <= now;
  const usedPercent = expired ? 0 : window.used_percent;
  return { leftPercent: Math.max(0, 100 - usedPercent), resetsAt, exhausted: usedPercent >= EXHAUSTED_AT };
}

export function limitStatus(sample, now) {
  if (!sample) return undefined;
  const fiveHour = windowStatus(sample.primary, now);
  const week = windowStatus(sample.secondary, now);
  return { fiveHour, week, exhausted: Boolean(fiveHour?.exhausted || week?.exhausted), sampledAt: sample.at };
}

function rolloutFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.jsonl')) found.push({ path, mtime: statSync(path).mtimeMs });
    }
  };
  try {
    walk(root);
  } catch {
    return [];
  }
  return found.sort((a, b) => b.mtime - a.mtime).slice(0, SCAN_FILES);
}

/** The newest rate-limit sample in the most recently written rollout files. */
export function latestSample(sessionsRoot) {
  let latest;
  for (const file of rolloutFiles(sessionsRoot)) {
    for (const line of readFileSync(file.path, 'utf8').split('\n')) {
      const sample = parseRateLimitLine(line);
      if (sample && (!latest || sample.at >= latest.at)) latest = sample;
    }
  }
  return latest;
}

const pad = (value) => String(value).padStart(2, '0');

function clock(ms, now) {
  const date = new Date(ms);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const sameDay = date.toDateString() === new Date(now).toDateString();
  return sameDay ? time : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${time}`;
}

export function formatStatus(status, now) {
  const part = (label, window) =>
    window ? `${label} ${window.leftPercent}% left, resets ${clock(window.resetsAt, now)}` : `${label} unknown`;
  const verdict = status.exhausted ? 'exhausted: use a Claude subagent' : 'ok';
  return `${part('5h', status.fiveHour)}\n${part('week', status.week)}\nverdict: ${verdict}`;
}

function main() {
  const now = Date.now();
  const sample = latestSample(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions'));
  const status = limitStatus(sample, now);
  if (!status) {
    console.log('verdict: unknown (no Codex rate-limit data found), treat Codex as available');
    process.exit(2);
  }
  console.log(process.argv.includes('--json') ? JSON.stringify(status) : formatStatus(status, now));
  process.exit(status.exhausted ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
