import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { accentOf } from './accent.mjs';

describe('accentOf', () => {
  it('takes the accent of the real 46 B catalog, not a fixed red', () => {
    const excerpt = readFileSync(join(import.meta.dirname, 'fixtures/catalog-46b-theme-excerpt.css'), 'utf8');

    assert.equal(accentOf(excerpt), '#2dd4cc');
  });

  it('refuses a page without an accent', () => {
    assert.throws(() => accentOf('body{}'), /no --color-et-accent/);
  });
});
