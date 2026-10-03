import { signal } from '@angular/core';
import { applyFaviconOverlay, FaviconOverlay } from '../index';
import { useScenario } from './harness';

const CDN_ICON = 'https://cdn.example.com/favicon.png';
const BADGE_URL = 'data:image/png;base64,badge';

class FakeImage {
  static created: FakeImage[] = [];

  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeImage.created.push(this);
  }

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const installBrowserCanvas = () => {
  const drawn: FakeImage[] = [];
  const ctx = new Proxy(
    { drawImage: (image: FakeImage) => drawn.push(image) },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => undefined) },
  );

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
    if (drawn.some((image) => image.crossOrigin === null)) {
      throw new DOMException('The canvas has been tainted by cross-origin data.', 'SecurityError');
    }

    return BADGE_URL;
  });
};

describe('favicon cross-origin scenarios', () => {
  const originalImage = globalThis.Image;
  let icon: HTMLLinkElement;

  beforeEach(() => {
    FakeImage.created = [];
    globalThis.Image = FakeImage as unknown as typeof Image;
    installBrowserCanvas();

    icon = document.createElement('link');
    icon.rel = 'icon';
    icon.setAttribute('href', CDN_ICON);
    document.head.appendChild(icon);
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
    icon.remove();
  });

  const scenario = useScenario();

  it('draws the badge over a favicon served from a CORS-enabled CDN', async () => {
    const s = scenario();
    const overlay = signal<FaviconOverlay | null>({ kind: 'dot', color: '#000' });
    const c = s.consumer();

    c.run(() => applyFaviconOverlay(overlay));
    await s.settle();

    expect(FakeImage.created).toHaveLength(1);
    expect(icon.getAttribute('href')).toBe(BADGE_URL);

    overlay.set(null);
    await s.settle();

    expect(icon.getAttribute('href')).toBe(CDN_ICON);
  });
});
