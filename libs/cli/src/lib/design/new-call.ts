import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { callsRootOf, readConfig } from './paths';

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const KEY = /^[a-z][a-z0-9-]*$/;

const callFile = (options: { slug: string; keys: string[] }) => {
  const { slug, keys } = options;
  const variants = keys
    .map(
      (key) =>
        `    {\n      key: '${key}',\n      name: 'Variant ${key}',\n      claim: 'What this variant argues.',\n` +
        `      cost: 'What it costs.',\n      load: () => import('./variant-${key}'),\n    },`,
    )
    .join('\n');

  return `import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: '${slug}',
  headline: 'The open question, in one sentence',
  intro: 'What the call is about, and what the variants share.',
  frameWidth: 720,
  variants: [
${variants}
  ],
});
`;
};

const FIXTURE_FILE = `export const FIXTURE = {
  title: 'The data every variant shares',
};
`;

const variantFile = (key: string) => `import { css, drawing, html } from '@design-explore';
import { FIXTURE } from './fixture';

export default drawing({
  body: html\`<p class="placeholder">\${FIXTURE.title} · variant ${key}</p>\`,
  styles: css\`
    .placeholder {
      margin: 0;
      padding: 24px;
      font-family: system-ui, sans-serif;
    }
  \`,
});
`;

/**
 * Writes a call that renders at once: `call.ts`, a shared `fixture.ts` and one drawing per variant
 * key. Refuses a slug whose folder exists, so it never overwrites a drawing.
 */
export const newCall = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const slug = argv.find((argument, index) => !argument.startsWith('--') && argv[index - 1] !== '--variants');
  const listed = argv[argv.indexOf('--variants') + 1];
  const keys = argv.includes('--variants') ? (listed ?? '').split(',').filter(Boolean) : ['a', 'b'];

  if (!slug) {
    console.error(`usage: ${invocation} new <project>/<group>/<name> [--variants a,b]`);

    return 2;
  }

  const segments = slug.split('/');

  if (segments.length < 2 || !segments.every((segment) => SEGMENT.test(segment))) {
    console.error(
      `BAD SLUG "${slug}" - use lowercase segments joined by "/", led by the project, e.g. app/checkout/01-summary.`,
    );

    return 2;
  }

  if (keys.length === 0 || !keys.every((key) => KEY.test(key)) || new Set(keys).size !== keys.length) {
    console.error(`BAD VARIANTS "${listed ?? ''}" - give distinct lowercase keys, e.g. --variants a,b,c.`);

    return 2;
  }

  const folder = join(callsRootOf(target), ...segments);

  if (existsSync(folder)) {
    console.error(`CALL EXISTS - ${relative(target, folder)} is already there. Pick another slug.`);

    return 1;
  }

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'call.ts'), callFile({ slug, keys }));
  writeFileSync(join(folder, 'fixture.ts'), FIXTURE_FILE);

  for (const key of keys) {
    writeFileSync(join(folder, `variant-${key}.ts`), variantFile(key));
  }

  const project = segments[0] as string;
  const projects = readConfig(target)?.projects ?? {};

  if (!(project in projects)) {
    console.warn(`note: config.json names no project "${project}", so its drawings get no styles or providers.`);
  }

  console.log(
    [
      `wrote ${relative(target, folder)}: call.ts, fixture.ts, ${keys.map((key) => `variant-${key}.ts`).join(', ')}`,
      `next: ${invocation} check --call ${slug}`,
    ].join('\n'),
  );

  return 0;
};
