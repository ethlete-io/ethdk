import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { designStudio } from './studio-open';

const fresh = () => mkdtempSync(join(tmpdir(), 'studio-open-'));

const checkoutWithDesign = () => {
  const checkout = fresh();

  mkdirSync(join(checkout, '.ethlete/design'), { recursive: true });
  writeFileSync(join(checkout, '.ethlete/design/config.json'), '{}');

  return checkout;
};

const capture = () => {
  const lines: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line));
  const error = vi.spyOn(console, 'error').mockImplementation((line: string) => void lines.push(line));

  return { lines, restore: () => [log, error].forEach((spy) => spy.mockRestore()) };
};

const run = (argv: string[], target: string, checksDir: string) =>
  designStudio({ target, argv, invocation: 'et design', checksDir, timeoutMs: 400, pollMs: 10 });

const studioAnswering = (checksDir: string, reply: object, seen: object[] = []) => {
  const timer = setInterval(() => {
    const request = readdirSync(checksDir).find((name) => name.endsWith('.open.json'));

    if (!request) return;

    const id = request.replace('.open.json', '');

    seen.push(JSON.parse(readFileSync(join(checksDir, request), 'utf8')));

    writeFileSync(join(checksDir, `${id}.opened.json`), JSON.stringify(reply));
    clearInterval(timer);
  }, 5);

  return () => clearInterval(timer);
};

describe('et design studio open', () => {
  it('asks Studio to add and switch to the checkout, and reports it', async () => {
    const checksDir = fresh();
    const checkout = checkoutWithDesign();
    const out = capture();
    const seen: object[] = [];
    const stop = studioAnswering(checksDir, { ok: true, message: '' }, seen);

    const code = await run(['open'], checkout, checksDir);

    stop();
    out.restore();

    expect(code).toBe(0);
    expect(seen).toEqual([{ checkout }]);
    expect(out.lines.join('\n')).toContain('Studio now shows');
  });

  it('refuses inside a client run sandbox and writes no request', async () => {
    const checksDir = fresh();
    const out = capture();

    vi.stubEnv('CLEAN_SLATE_SANDBOX', '1');

    const code = await run(['open'], checkoutWithDesign(), checksDir);

    vi.unstubAllEnvs();
    out.restore();

    expect(code).toBe(1);
    expect(out.lines.join('\n')).toContain('A client run does not add checkouts');
    expect(readdirSync(checksDir)).toEqual([]);
  });

  it('refuses a folder with no design work and asks Studio nothing', async () => {
    const checksDir = fresh();
    const out = capture();

    const code = await run(['open', fresh()], fresh(), checksDir);

    out.restore();

    expect(code).toBe(1);
    expect(out.lines.join('\n')).toContain('carries no design work');
    expect(readdirSync(checksDir)).toEqual([]);
  });

  it('keeps its request for the next Studio start when Studio is not running', async () => {
    const checksDir = fresh();
    const checkout = checkoutWithDesign();
    const out = capture();

    const code = await run(['open'], checkout, checksDir);

    out.restore();

    expect(code).toBe(3);
    expect(out.lines.join('\n')).toContain('Studio is not running; it adds');
    expect(out.lines.join('\n')).not.toContain('FAILED');

    const kept = readdirSync(checksDir);

    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatch(/\.open\.json$/);
    expect(JSON.parse(readFileSync(join(checksDir, kept[0] ?? ''), 'utf8'))).toEqual({ checkout });
  });

  it('relays the refusal Studio answers with', async () => {
    const checksDir = fresh();
    const out = capture();
    const stop = studioAnswering(checksDir, { ok: false, message: 'nope' });

    const code = await run(['open'], checkoutWithDesign(), checksDir);

    stop();
    out.restore();

    expect(code).toBe(1);
    expect(out.lines.join('\n')).toContain('nope');
  });
});
