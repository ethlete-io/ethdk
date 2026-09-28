import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_FILE_NAME } from './config';
import { migrate } from './migrate';
import { END_MARKER, START_MARKER } from './render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('migrate', () => {
  it('keeps a single marker block when CLAUDE.md and AGENTS.md both hold one', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-migrate-'));
    const block = `${START_MARKER}\nold-generated-text\n${END_MARKER}`;

    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: ['claude'] }), 'utf8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), `# Claude notes\n\n${block}\n`, 'utf8');
    writeFileSync(join(root, 'AGENTS.md'), `# Agents\n\n${block}\n`, 'utf8');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    migrate({ root });

    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

    expect(agents.split(START_MARKER)).toHaveLength(2);
    expect(agents).toContain('# Claude notes');
    expect(agents).not.toContain('old-generated-text');
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
  });
});
