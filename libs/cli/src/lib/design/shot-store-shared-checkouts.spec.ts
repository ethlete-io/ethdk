import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createShotStore } from './shot-store';

const address = { product: 'acme', part: 'components/card', sketch: null, props: null };

const sharedStore = () => {
  const base = mkdtempSync(join(tmpdir(), 'cli-design-shared-checkouts-'));
  const dir = join(base, 'part-shots');
  let draws = 0;

  const server = (name: string, content: string) => {
    const root = join(base, name);

    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'card.ts'), content);

    const store = createShotStore({
      dir,
      salt: 'salt',
      checkout: root,
      inputsOf: () => [join(root, 'card.ts')],
      scopeOf: () => 'scope',
      pollMs: 5,
    });

    return {
      show: () => {
        const stored = store.read('key', address);

        if (stored) return stored;

        draws++;

        const drawn = { png: Buffer.from(`drawn by ${name}`), marks: [] };

        store.write('key', { address, picture: drawn });

        return drawn;
      },
    };
  };

  return { server, draws: () => draws };
};

describe('shot store shared by two checkouts', () => {
  it('draws once when the files hold the same content, the second server reads the first picture', () => {
    const { server, draws } = sharedStore();
    const first = server('one', 'export const card = 1;').show();
    const second = server('two', 'export const card = 1;').show();

    expect(draws()).toBe(1);
    expect(second.png).toEqual(first.png);
  });

  it('draws again when the files differ only in content, the second server never reads the first picture', () => {
    const { server, draws } = sharedStore();
    const first = server('one', 'export const card = 1;').show();
    const second = server('two', 'export const card = 2;').show();

    expect(draws()).toBe(2);
    expect(second.png).not.toEqual(first.png);
  });
});
