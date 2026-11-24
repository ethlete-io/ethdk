import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { check, acme, output } from './system/check-system.fixtures';
import { collapseShippedErrors } from './shipped-skew';

const CAPTURED = `node_modules/@ethlete/components/design/sdk/components/accent-on-light/accent-on-light.ts(5,27): error TS2345: Argument of type '{ note: string; }' is not assignable to parameter of type 'PartSource<unknown, string, string>'.
  Type '{ note: string; }' is missing the following properties from type '{ data: "list"; dataStates: PartDataStates; }': data, dataStates
node_modules/@ethlete/components/design/sdk/components/accordion/accordion.ts(59,3): error TS2322: Type '(props: Props) => Drawing' is not assignable to type '(props: unknown) => Drawing | Promise<Drawing>'.
  Types of parameters 'props' and 'props' are incompatible.
    Type 'unknown' is not assignable to type 'Props'.
.ethlete/design/app/pages/home/home.ts(3,1): error TS2322: Type 'number' is not assignable to type 'string'.`;

describe('collapseShippedErrors', () => {
  it('folds the errors of shipped parts into one line and keeps the checkout own errors', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'cli-skew-'));
    const lines = collapseShippedErrors(CAPTURED, cwd).split('\n');

    expect(lines).toEqual([
      ".ethlete/design/app/pages/home/home.ts(3,1): error TS2322: Type 'number' is not assignable to type 'string'.",
      expect.stringMatching(
        /^SDK-VERSION-SKEW node_modules\/@ethlete\/components: 2 type errors .*accent-on-light\.ts/,
      ),
    ]);
  });
});

describe('a product on a base whose installed parts do not fit the cli', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports one skew line, not a type error per shipped part', () => {
    const target = acme();
    const lines = output();
    const components = join(target, 'node_modules/@ethlete/components');
    const dir = join(components, 'design/sdk/components/divider');

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(components, 'package.json'),
      JSON.stringify({ name: '@ethlete/components', version: '1.0.0-next.79' }),
    );
    writeFileSync(join(components, 'design/config.json'), JSON.stringify({ products: { sdk: {} } }));
    writeFileSync(
      join(dir, 'divider.ts'),
      `import { definePart, drawing } from '@design-system';
type Props = { set?: 'horizontal' | 'vertical' };
export default definePart({
  note: "Today's look",
  states: { default: {}, vertical: { set: 'vertical' } },
  widths: [480],
  render: (props: Props) => drawing({ body: props.set ?? '', styles: '' }),
});
`,
    );
    writeFileSync(
      join(target, DESIGN_DIR, 'config.json'),
      JSON.stringify({ products: { app: { base: '@ethlete/components' } } }),
    );

    expect(check(target, ['app'])).toBe(1);
    expect(lines.filter((line) => line.startsWith('TYPE-ERROR'))).toEqual([
      expect.stringMatching(
        /^TYPE-ERROR \.ethlete\/design\/app: \nSDK-VERSION-SKEW node_modules\/@ethlete\/components \(1\.0\.0-next\.79\): 1 type errors /,
      ),
    ]);
    expect(lines.join('\n')).not.toContain('error TS');
  });
});
