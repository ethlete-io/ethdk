import { coverageGapsOf, sampleTextsOf, statusesTwiceOf } from './design-coverage';

const gaps = (coverage: unknown, drawn: Record<string, string> = {}, states = ['rest', 'tall', 'drawing', 'far']) =>
  coverageGapsOf({ file: 'pages/sketches/sketches.ts', part: 'pages/sketches', states, coverage, drawn }).map(
    ({ rule, message }) => `${rule} ${message}`,
  );

describe('coverageGapsOf', () => {
  it('warns when the samples of a layout branch stay below the real input range', () => {
    expect(
      gaps({
        branches: {
          matrix: { real: { width: 1440, height: 900 }, samples: { rest: { width: 640, height: 32 } } },
          grid: { real: { width: 300, height: 40 }, samples: { tall: { width: 320, height: 48 } } },
        },
      }),
    ).toEqual([
      'COVERAGE-RANGE branch matrix: the widest sample is 640 px, the widest real input 1440 px - draw a state with it',
      'COVERAGE-RANGE branch matrix: the tallest sample is 32 px, the tallest real input 900 px - draw a state with it',
    ]);
  });

  it('warns on a branch without a sample and on a sample state the part does not draw', () => {
    expect(
      gaps({
        branches: {
          empty: { real: { width: 10, height: 10 }, samples: {} },
          gone: { real: { width: 10, height: 10 }, samples: { missing: { width: 10, height: 10 } } },
        },
      }),
    ).toEqual([
      'COVERAGE-RANGE branch empty: no state draws a sample in this layout branch',
      'COVERAGE-RANGE branch gone: names the state "missing", which the part does not draw',
    ]);
  });

  it('crosses each status with each zoom extreme', () => {
    expect(
      gaps({
        zoom: {
          extremes: ['below-fit', 'far-out'],
          statuses: {
            drawing: { 'below-fit': 'drawing', 'far-out': 'far' },
            paused: { 'below-fit': 'far', fit: 'rest' },
          },
        },
      }),
    ).toEqual([
      'COVERAGE-ZOOM paused@far-out: no state draws the status "paused" at the zoom extreme "far-out"',
      'COVERAGE-ZOOM paused@fit: "fit" is not one of the zoom extremes',
    ]);
  });

  it('warns on an async mark without an unknown state', () => {
    expect(gaps({ async: { changed: null, unchanged: 'rest' } })).toEqual([
      'COVERAGE-ASYNC mark changed: the view reads "changed" asynchronously, but no state draws it while it is unknown',
    ]);
  });

  it('warns when a sample repeats a live chrome label, but not outside the sample', () => {
    expect(
      gaps(
        { chrome: ['Aktuell', 'Variante a'] },
        {
          rest: '<header>Aktuell</header><div data-et-sample><span>Variante a</span><img alt="Aktuell"></div>',
          tall: '<header>Aktuell</header><div data-et-sample><span>Variante alpha</span></div>',
        },
      ),
    ).toEqual([
      'SAMPLE-CHROME state rest: the sample repeats the live chrome labels "Aktuell", "Variante a" - give the sample other labels',
    ]);
  });

  it('warns on the same status twice in one view, also without a coverage declaration', () => {
    expect(
      gaps(undefined, {
        drawing:
          '<section data-et-view><p data-et-status="drawing">zeichnet</p><div><p data-et-status="drawing">Opus zeichnet</p></div></section>',
        rest: '<section data-et-view><p data-et-status="drawing"></p></section><section data-et-view><p data-et-status="drawing"></p></section>',
      }),
    ).toEqual(['STATUS-TWICE state drawing: shows the status "drawing" twice in one view']);
  });

  it('passes a fully covered part', () => {
    expect(
      gaps(
        {
          branches: {
            matrix: {
              real: { width: 900, height: 900 },
              samples: { rest: { width: 900, height: 32 }, tall: { width: 400, height: 900 } },
            },
          },
          zoom: { extremes: ['far-out'], statuses: { drawing: { 'far-out': 'far' } } },
          async: { changed: 'drawing' },
          chrome: ['Aktuell'],
        },
        { rest: '<div data-et-sample>Entwurf</div>' },
      ),
    ).toEqual([]);
  });
});

describe('statusesTwiceOf', () => {
  it('counts a status once per view region and closes regions at their end tag', () => {
    expect(
      statusesTwiceOf(
        '<div data-et-view><br><img src="x"><i data-et-status="failed"></i></div><div data-et-view><i data-et-status="failed"></i></div>',
      ),
    ).toEqual([]);
    expect(statusesTwiceOf('<i data-et-status="paused"></i><b data-et-status="paused"></b>')).toEqual(['paused']);
  });
});

describe('sampleTextsOf', () => {
  it('reads text and labelled attributes inside sample regions only', () => {
    expect(
      sampleTextsOf(
        '<p>live</p><figure data-et-sample><img alt="Probe"><figcaption> Spalte  1 </figcaption></figure><p>after</p>',
      ),
    ).toEqual(['Probe', 'Spalte 1']);
  });
});
