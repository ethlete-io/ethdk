import { describe, expect, it } from 'vitest';
import { serveStateLines } from './serve-state';

const own = { version: '1.0.0', build: 'aaa' };
const base = 'http://localhost:4402';

describe('serveStateLines', () => {
  it('says nothing answers and names the command that binds the port', () => {
    const [line] = serveStateLines({ base, own, served: null });

    expect(line).toContain('nothing answers');
    expect(line).toContain('`DE_PORT=4402 et design`');
  });

  it('names the Studio app as owner and the Studio restart for an older build', () => {
    const text = serveStateLines({
      base,
      own,
      served: { stamp: { version: '1.0.0', build: 'bbb' }, owner: 'studio', pid: 42, cliRoot: '/tmp/studio-cli/x' },
    }).join('\n');

    expect(text).toContain('served by the Studio app (pid 42)');
    expect(text).toContain('from /tmp/studio-cli/x');
    expect(text).toContain('different build');
    expect(text).toContain('Press restart in Studio');
  });

  it('names a terminal owner and its pid to stop', () => {
    const text = serveStateLines({ base, own, served: { stamp: own, owner: 'terminal', pid: 7 } }).join('\n');

    expect(text).toContain('served by a terminal (pid 7)');
    expect(text).toContain('the server runs it');
    expect(text).toContain('Stop pid 7');
    expect(text).toContain('run `DE_PORT=4402 et design` again');
  });

  it('reads a server that predates the identity', () => {
    const text = serveStateLines({ base, own, served: { version: '0.9.0', build: 'old' } }).join('\n');

    expect(text).toContain('an unknown owner');
    expect(text).toContain('0.9.0 build old');
  });
});
