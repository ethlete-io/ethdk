import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { expect, vi } from 'vitest';
import { readConfig } from '../design-config';
import { checkSystem } from './check-system';

export const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

export const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

export const withoutOpenPoints = (lines: string[]) =>
  lines.filter(
    (line) =>
      !line.startsWith('OPEN POINTS ') &&
      !/^\[\d+\/\d+\] /.test(line) &&
      !line.startsWith('UNLINKED ') &&
      !line.startsWith('  ') &&
      !line.startsWith('PART ') &&
      !line.startsWith('PARTS ') &&
      !line.startsWith('DONE ') &&
      !/^[A-Z][A-Z-]+ \d+$/.test(line) &&
      !line.startsWith('check complete:'),
  );

export const withoutBrowserLines = (lines: string[]) =>
  withoutOpenPoints(lines).filter(
    (line) =>
      !/^RENDER CHECK (SKIPPED|FAILED)/.test(line) &&
      !line.startsWith('NOT CHECKED') &&
      !line.startsWith('HINT ') &&
      !line.startsWith('READY '),
  );

export const noBrowser = async () => null;

export const renderWarningsOf = (lines: string[]) =>
  lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))
    ? []
    : [expect.stringMatching(/^WARNING CONTROL-PART-INPUT acme components\/button /)];

export const check = (target: string, products: string[]) =>
  checkSystem({ target, config: readConfig(target) ?? {}, products });
