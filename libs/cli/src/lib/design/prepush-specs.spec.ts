import { describe, expect, it } from 'vitest';
import { relatedFilesOf } from './prepush-specs';

const ROOT = 'apps/ethlete-studio/';

const relatedOf = (changes: { status: 'A' | 'M' | 'D'; file: string }[], existing: string[] = []) =>
  relatedFilesOf({ changes, root: ROOT, exists: (file) => existing.includes(file) });

describe('relatedFilesOf', () => {
  it('hands over each changed or added TS file, spec or source', () => {
    expect(
      relatedOf([
        { status: 'M', file: `${ROOT}src/a.spec.ts` },
        { status: 'A', file: `${ROOT}src/b.ts` },
      ]),
    ).toEqual([`${ROOT}src/a.spec.ts`, `${ROOT}src/b.ts`]);
  });

  it('hands over the spec next to a changed template or stylesheet, which no import reaches', () => {
    const spec = `${ROOT}src/x.component.spec.ts`;

    expect(
      relatedOf(
        [
          { status: 'M', file: `${ROOT}src/x.component.html` },
          { status: 'M', file: `${ROOT}src/x.component.css` },
          { status: 'M', file: `${ROOT}src/y.component.html` },
        ],
        [spec],
      ),
    ).toEqual([spec]);
  });

  it('hands over the spec of a deleted source but not a deleted spec', () => {
    const spec = `${ROOT}src/b.spec.ts`;

    expect(
      relatedOf(
        [
          { status: 'D', file: `${ROOT}src/b.ts` },
          { status: 'D', file: `${ROOT}src/c.spec.ts` },
        ],
        [spec],
      ),
    ).toEqual([spec]);
  });

  it('hands over nothing for a file outside the root or one no spec can import', () => {
    expect(
      relatedOf([
        { status: 'M', file: 'libs/cli/src/a.spec.ts' },
        { status: 'M', file: `${ROOT}src-tauri/src/main.rs` },
        { status: 'M', file: `${ROOT}project.json` },
      ]),
    ).toEqual([]);
  });
});
