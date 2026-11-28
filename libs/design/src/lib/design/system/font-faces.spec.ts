// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT_FACES_SCRIPT } from './font-faces';

class FakeFontFace {
  status = 'unloaded';

  constructor(
    public family: string,
    public source: string,
  ) {}

  load() {
    this.status = this.source.includes('@assets') ? 'error' : 'loaded';

    return this.status === 'loaded' ? Promise.resolve(this) : Promise.reject(new Error('network'));
  }
}

class CSSFontFaceRule {
  constructor(private readonly descriptors: Record<string, string>) {}

  get style() {
    return { getPropertyValue: (name: string) => this.descriptors[name] ?? '' };
  }
}

const problemsOf = (rules: object[]) => {
  vi.stubGlobal('FontFace', FakeFontFace);
  vi.spyOn(document, 'styleSheets', 'get').mockReturnValue([{ href: null, cssRules: rules }] as never);

  return new Function(`return ${FONT_FACES_SCRIPT}`)() as Promise<{ rule: string; detail: string }[]>;
};

describe('FONT_FACES_SCRIPT', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('names the family and source of a face that does not load', async () => {
    const problems = await problemsOf([
      new CSSFontFaceRule({ 'font-family': '"Roboto"', src: 'url("@assets/fonts/roboto.woff2") format("woff2")' }),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.rule).toBe('FONT-FACE');
    expect(problems[0]?.detail).toContain('"Roboto"');
    expect(problems[0]?.detail).toContain('@assets/fonts/roboto.woff2');
  });

  it('passes a face that loads, also inside a layer', async () => {
    const face = new CSSFontFaceRule({ 'font-family': 'Inter', src: 'url("/@fs/x/inter.woff2")' });

    expect(await problemsOf([{ cssRules: [face] }])).toEqual([]);
  });
});
