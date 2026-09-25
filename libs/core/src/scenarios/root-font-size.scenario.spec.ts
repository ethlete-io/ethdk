import { provideSurfaceThemesWithTailwind4, SurfaceTheme } from '../index';
import { createScenario, useScenario } from './harness';

const SURFACE_THEMES: SurfaceTheme[] = [
  {
    name: 'base',
    type: 'light',
    elevation: 0,
    isDefault: true,
    background: '255 255 255',
    color: '0 0 0',
    colorMuted: '60 60 60',
    colorSubtle: '120 120 120',
    border: '200 200 200',
  },
];

const WARNING = /root font size is 16px, the browser default.*html \{ font-size: 62\.5%; \}/;

type FontSizes = {
  /** The computed root size, or `null` when the page sets no root rule. */
  root: string | null;
  browserDefault?: string;
  minimum?: number;
};

const px = (value: number) => `${value}px`;

const stubFontSizes = ({ root, browserDefault = '16px', minimum = 0 }: FontSizes) => {
  const realGetComputedStyle = window.getComputedStyle.bind(window);

  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const defaultPx = parseFloat(browserDefault);
    const inline = element instanceof HTMLElement ? element.style.fontSize : '';
    const specified = element === document.documentElement ? (root ?? 'medium') : inline;
    const resolved =
      specified === 'medium'
        ? browserDefault
        : specified.endsWith('%')
          ? px(Math.max((defaultPx * parseFloat(specified)) / 100, minimum))
          : specified.endsWith('px')
            ? px(Math.max(parseFloat(specified), minimum))
            : null;

    if (resolved === null) return realGetComputedStyle(element, pseudo);

    return { fontSize: resolved } as CSSStyleDeclaration;
  });
};

const setReadyState = (state: DocumentReadyState) =>
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });

describe('root font size scenarios', () => {
  const scenario = useScenario({ providers: [provideSurfaceThemesWithTailwind4(SURFACE_THEMES)] });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'readyState');
  });

  it('stays silent when the page sets html { font-size: 62.5% }', () => {
    const s = scenario();

    stubFontSizes({ root: '62.5%' });
    s.flush();

    expect(s.warnings).toEqual([]);
  });

  it('warns exactly once when the page sets no root font size', () => {
    const s = scenario();

    stubFontSizes({ root: null });
    s.flush();
    s.tick();
    s.flush();

    s.expectWarning(WARNING);
    expect(s.warnings).toEqual([]);
  });

  it('stays silent for a 10px root while the browser default is 20px', () => {
    const s = scenario();

    stubFontSizes({ root: '10px', browserDefault: '20px' });
    s.flush();

    expect(s.warnings).toEqual([]);
  });

  it('stays silent for a 62.5% root while the browser default is 20px', () => {
    const s = scenario();

    stubFontSizes({ root: '62.5%', browserDefault: '20px' });
    s.flush();

    expect(s.warnings).toEqual([]);
  });

  it('stays silent when a browser minimum font size clamps the root to the default', () => {
    const s = scenario();

    stubFontSizes({ root: '62.5%', minimum: 16 });
    s.flush();

    expect(s.warnings).toEqual([]);
  });

  it('stays silent when the computed sizes are not pixel values', () => {
    const s = scenario();

    stubFontSizes({ root: null, browserDefault: '' });
    s.flush();

    expect(s.warnings).toEqual([]);
  });

  it('stays silent in plain jsdom, which computes no font sizes', () => {
    const s = scenario();

    s.flush();

    expect(s.warnings).toEqual([]);
  });

  it('waits for the window load event before measuring', () => {
    setReadyState('interactive');
    const s = scenario();

    stubFontSizes({ root: null });
    s.flush();

    expect(s.warnings).toEqual([]);

    setReadyState('complete');
    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('load'));

    s.expectWarning(WARNING);
    expect(s.warnings).toEqual([]);
  });

  it('removes its load listener when the app is destroyed before the page loads', () => {
    setReadyState('loading');
    const s = scenario();

    stubFontSizes({ root: null });
    s.flush();

    expect(s.warnings).toEqual([]);
  });
});

describe('root font size outside dev mode', () => {
  it('does not measure or warn', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    vi.stubGlobal('ngDevMode', false);

    const s = createScenario({ providers: [provideSurfaceThemesWithTailwind4(SURFACE_THEMES)] });

    try {
      stubFontSizes({ root: null });
      s.flush();

      expect(window.getComputedStyle).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      s.destroy();
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
