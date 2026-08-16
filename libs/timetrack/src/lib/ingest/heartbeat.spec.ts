import { describe, expect, it } from 'vitest';
import { EditorSnapshot, gitHeadBranch, heartbeatRecordOf } from './heartbeat';

const AT = new Date(2026, 7, 16, 14, 0, 0);

const snapshot = (overrides: Partial<EditorSnapshot> = {}): EditorSnapshot => ({
  at: AT,
  repoPath: '/home/tom/dev/ethlete-sdk',
  branch: 'next',
  filePath: '/home/tom/dev/ethlete-sdk/libs/components/src/lib/table/table.component.ts',
  language: 'typescript',
  editing: true,
  ...overrides,
});

describe('heartbeatRecordOf', () => {
  it('reports the directory inside the checkout, not the file', () => {
    const record = heartbeatRecordOf(snapshot());

    expect(record).toEqual({
      atMs: AT.getTime(),
      kind: 'editor-heartbeat',
      repoPath: '/home/tom/dev/ethlete-sdk',
      branch: 'next',
      directory: 'libs/components/src/lib/table',
      language: 'typescript',
      editing: true,
    });
  });

  it('carries no file name anywhere in what it posts', () => {
    expect(JSON.stringify(heartbeatRecordOf(snapshot()))).not.toContain('table.component.ts');
  });

  it('keeps the whole path for a file outside the checkout', () => {
    const record = heartbeatRecordOf(snapshot({ filePath: '/home/tom/notes/standup.md' }));

    expect(record?.['directory']).toBe('/home/tom/notes');
  });

  it('reports the checkout alone when nothing is open in it', () => {
    const record = heartbeatRecordOf(snapshot({ filePath: undefined, language: undefined }));

    expect(record).toEqual({
      atMs: AT.getTime(),
      kind: 'editor-heartbeat',
      repoPath: '/home/tom/dev/ethlete-sdk',
      branch: 'next',
      editing: true,
    });
  });

  it('says nothing at all for a window with no file and no checkout', () => {
    expect(heartbeatRecordOf(snapshot({ repoPath: undefined, branch: undefined, filePath: undefined }))).toBeNull();
  });

  it('reads a Windows path the same way', () => {
    const record = heartbeatRecordOf(
      snapshot({ repoPath: undefined, filePath: 'C:\\Users\\tom\\dev\\sdk\\libs\\core\\index.ts' }),
    );

    expect(record?.['directory']).toBe('C:/Users/tom/dev/sdk/libs/core');
  });

  it('omits a branch the editor could not read rather than sending an empty one', () => {
    expect(heartbeatRecordOf(snapshot({ branch: undefined }))).not.toHaveProperty('branch');
  });
});

describe('gitHeadBranch', () => {
  it('reads the branch a symbolic head names', () => {
    expect(gitHeadBranch('ref: refs/heads/feat/FIP-2177-user-management\n')).toBe('feat/FIP-2177-user-management');
  });

  it('has no branch for a detached head', () => {
    expect(gitHeadBranch('9f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c\n')).toBeUndefined();
  });

  it('has no branch for a file it cannot make sense of', () => {
    expect(gitHeadBranch('')).toBeUndefined();
    expect(gitHeadBranch('ref: refs/heads/')).toBeUndefined();
  });
});
