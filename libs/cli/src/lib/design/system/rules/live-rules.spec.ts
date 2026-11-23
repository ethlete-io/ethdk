import { describe, expect, it } from 'vitest';
import { ANCHORED_DIALOG_PART, pageAnchoredDialogsOf, themeClassesOf } from './live-rules';

const file = '/p/part.ts';

describe('themeClassesOf', () => {
  it('flags a surface and a colour class outside foundations, with the line and the fix', () => {
    const source = 'const a = 1;\nconst b = `<div class="p-2 et-surface--raised et-color--brand">`;\n';
    const messages = themeClassesOf({ file, source, layer: 'elements' }).map((problem) => problem.message);

    expect(messages).toEqual([
      expect.stringMatching(/^line 2: `et-surface--raised` names a theme - .*data-et-auto-surface/u),
      expect.stringMatching(/^line 2: `et-color--brand` names a theme - .*etProvideColor.*"brand"/u),
    ]);
  });

  it('allows the classes in foundations and ignores look-alike names', () => {
    expect(themeClassesOf({ file, source: '`et-surface--raised`', layer: 'foundations' })).toEqual([]);
    expect(themeClassesOf({ file, source: '`my-et-surface--x et-surface-raised`', layer: 'pages' })).toEqual([]);
  });
});

describe('pageAnchoredDialogsOf', () => {
  const source = "import { anchoredDialog } from '@ethlete/components/design';\n\nconst pop = anchoredDialog({});\n";

  it('flags a page that calls anchoredDialog() when the product has the part', () => {
    expect(pageAnchoredDialogsOf({ file, source, layer: 'pages', partKeys: [ANCHORED_DIALOG_PART] })).toEqual([
      {
        rule: 'PAGE-ANCHORED-DIALOG',
        file,
        message: expect.stringMatching(
          /^line 3: a page calls anchoredDialog\(\) - embed the components\/anchored-dialog part/u,
        ),
      },
    ]);
  });

  it('leaves other layers, a product without the part and a mere import alone', () => {
    expect(pageAnchoredDialogsOf({ file, source, layer: 'components', partKeys: [ANCHORED_DIALOG_PART] })).toEqual([]);
    expect(pageAnchoredDialogsOf({ file, source, layer: 'pages', partKeys: [] })).toEqual([]);
    expect(
      pageAnchoredDialogsOf({
        file,
        source: "import { anchoredDialogStyles } from 'x';\nfoo.anchoredDialog(1);\n",
        layer: 'pages',
        partKeys: [ANCHORED_DIALOG_PART],
      }),
    ).toEqual([]);
  });
});
