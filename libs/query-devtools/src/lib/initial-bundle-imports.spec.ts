import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const sourcesOf = (entryPoint: string) => {
  const dir = join(__dirname, '..', '..', entryPoint);

  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => ({ file: `${entryPoint}/${file}`, source: readFileSync(join(dir, file), 'utf8') }));
};

describe('the entry points an application loads up front', () => {
  it.each(['toggle', 'lazy'])('%s imports nothing from the @ethlete/components barrel', (entryPoint) => {
    const offenders = sourcesOf(entryPoint)
      .filter(({ source }) => /from '@ethlete\/components'/.test(source))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});
