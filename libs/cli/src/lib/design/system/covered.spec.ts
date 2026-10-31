import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { FoundControl, seeFrame } from './complete';

const PAGE = `<div id="root" style="position:relative;width:400px;height:300px">
  <button id="under" style="position:absolute;left:10px;top:10px;width:80px;height:30px">Save</button>
  <button id="partly" style="position:absolute;left:10px;top:100px;width:100px;height:30px">Partly</button>
  <button id="free" style="position:absolute;left:10px;top:200px;width:80px;height:30px">Free</button>
  <button id="off" disabled style="position:absolute;left:150px;top:200px;width:80px;height:30px">Off</button>
  <button id="none" disabled style="position:absolute;left:250px;top:200px;width:80px;height:30px;pointer-events:none">None</button>
  <div style="position:absolute;left:0;top:0;width:200px;height:60px;background:#ccc"></div>
  <div style="position:absolute;left:0;top:90px;width:50px;height:60px;background:#ccc"></div>
</div>`;

describe('covered controls in the frame discovery', () => {
  let close: () => Promise<void> = async () => undefined;
  let found: FoundControl[] = [];

  beforeAll(async () => {
    const loaded = await chromiumOf(process.cwd());

    if (!loaded) return;

    const browser = await loaded.chromium.launch();
    const page = await browser.newPage();

    close = () => browser.close();
    await page.setContent(PAGE);

    const seen = (await page.evaluate(
      seeFrame({ discover: true, part: 'pages/x', ownCss: [], controlParts: {}, clip: false }),
    )) as { found: FoundControl[] };

    found = seen.found;
  }, 60_000);

  afterAll(() => close());

  const coveredOf = (label: string) => found.find((control) => control.label === label)?.covered;

  it('marks a control fully under another element, not a partly covered or free one', () => {
    expect(coveredOf('Save')).toBe(true);
    expect(coveredOf('Partly')).toBe(false);
    expect(coveredOf('Free')).toBe(false);
  });

  it('keeps a disabled control, also one with pointer-events none, visible', () => {
    expect(coveredOf('Off')).toBe(false);
    expect(coveredOf('None')).toBe(false);
  });
});
