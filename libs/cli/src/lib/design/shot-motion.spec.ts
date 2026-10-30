import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter } from './shot';
import { createSystemModules } from './system/system-modules';

const BODY = '<div class="aa-body">The rest</div>';

const PARTS: Record<string, string> = {
  fade: '.aa-body { height: 40px; background: black; transition: opacity 2s; @starting-style { opacity: 0; } }',
  plain: '.aa-body { height: 40px; background: black; }',
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-shot-motion-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  for (const [name, styles] of Object.entries(PARTS)) {
    const dir = join(design, 'app-a', 'components', name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { open: {} },
  render: () => drawing({ body: ${JSON.stringify(BODY)}, styles: ${JSON.stringify(styles)} }),
});
`,
    );
  }

  return { target, config: readConfig(target) ?? {} };
};

describe('createPartShooter', () => {
  it('draws an element that fades in with @starting-style at the end of its fade', async (context) => {
    const { target, config } = checkout();
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const shooter = createPartShooter({
      target,
      base: `http://localhost:${port}`,
      system: createSystemModules({ target, config }),
    });

    try {
      const shotOf = (part: string) =>
        shooter.pictureOf({
          product: 'app-a',
          part,
          state: 'open',
          preset: null,
          width: 200,
          sketch: null,
          interaction: null,
          params: new URLSearchParams(),
        });
      const fade = await shotOf('components/fade').catch((error: Error) => error);

      if (fade instanceof Error && /chromium|playwright/i.test(fade.message)) return context.skip(fade.message);

      if (fade instanceof Error) throw fade;

      expect(fade.png.equals((await shotOf('components/plain')).png)).toBe(true);
    } finally {
      await shooter.close();
      await server.close();
    }
  }, 60_000);
});
