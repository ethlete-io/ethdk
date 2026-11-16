#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MINUTE_SAMPLES = 12;

/** The samples of a `vmstat -n <interval>` log as objects keyed by column, without the since-boot first row. */
export const vmstatSamplesOf = (text) => {
  const lines = text.split('\n').filter((line) => line.trim());
  const header = lines.findIndex((line) => /^\s*r\s+b\s/.test(line));

  if (header === -1) return [];

  const columns = lines[header].trim().split(/\s+/);

  return lines
    .slice(header + 2)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((values) => values.length === columns.length && values.every(Number.isFinite))
    .map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])));
};

/** Each test file vitest printed with `--logHeapUsage`, with its heap in MB. */
export const heapLinesOf = (text) =>
  [...text.matchAll(/^.*?(?:\|([\w-]+)\| )?(\S+\.spec\.[cm]?[jt]sx?)\b.*?(\d+) MB heap used/gm)].map((match) => ({
    file: match[1] ? `${match[1]}:${match[2]}` : match[2],
    mb: Number(match[3]),
  }));

const peakOf = (samples, column) => Math.max(...samples.map((sample) => sample[column] ?? 0));

const minuteRowOf = (samples, index) =>
  `min ${index + 1}: r ${peakOf(samples, 'r')}, cpu ${Math.max(...samples.map((sample) => sample.us + sample.sy))}%, st ${peakOf(samples, 'st')}%, wa ${peakOf(samples, 'wa')}%, free ${Math.round(Math.min(...samples.map((sample) => sample.free + sample.cache)) / 1024)} MB, si/so ${peakOf(samples, 'si')}/${peakOf(samples, 'so')}`;

/** The load report: one peak line and one row per minute (each the peak of its samples), and the top heap files. */
export const loadReportOf = ({ vmstat, unitLog, cores }) => {
  const samples = vmstatSamplesOf(vmstat);
  const heaps = heapLinesOf(unitLog).sort((a, b) => b.mb - a.mb);
  const lines = [];

  if (samples.length) {
    const over = samples.filter((sample) => sample.r > cores).length;

    lines.push(
      `${samples.length} samples; run queue above ${cores} cores in ${over}; peak r ${peakOf(samples, 'r')}, st ${peakOf(samples, 'st')}%, wa ${peakOf(samples, 'wa')}%, swap out ${peakOf(samples, 'so')}`,
    );
    for (let start = 0; start < samples.length; start += MINUTE_SAMPLES)
      lines.push(minuteRowOf(samples.slice(start, start + MINUTE_SAMPLES), start / MINUTE_SAMPLES));
  } else lines.push('no vmstat samples');

  lines.push(
    heaps.length
      ? `heap: ${heaps.length} files, top ${heaps
          .slice(0, 5)
          .map(({ file, mb }) => `${file} ${mb} MB`)
          .join(', ')}`
      : 'heap: no heap lines',
  );

  return lines;
};

const escapeAnnotation = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [vmstatPath, unitLogPath] = process.argv.slice(2);
  const read = (path) => (path && existsSync(path) ? readFileSync(path, 'utf8') : '');
  const { availableParallelism } = await import('node:os');
  const lines = loadReportOf({ vmstat: read(vmstatPath), unitLog: read(unitLogPath), cores: availableParallelism() });

  console.log(lines.join('\n'));
  console.log(`::notice title=unit-load::${escapeAnnotation(lines.join('\n'))}`);
}
