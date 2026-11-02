import { Subscription } from 'rxjs';
import { vi } from 'vitest';
import {
  designServerBack$,
  failedLoadReason$,
  FrameLoad,
  frameLoad$,
  paintedFrame$,
  SERVER_BACK_POLL_MS,
  UNREPORTED_PAINT_MS,
} from './frame-paint';

const frame = () => {
  const iframe = document.createElement('iframe');

  document.body.append(iframe);

  return iframe;
};

const report = { type: 'design-explore:height', height: 240 };

const message = (source: MessageEventSource | null, data: object) =>
  window.dispatchEvent(new MessageEvent('message', { source, data }));

describe('paintedFrame$', () => {
  let subscriptions: Subscription[];

  beforeEach(() => {
    subscriptions = [];
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => window.clearTimeout(handle));
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const watch = (iframe: HTMLIFrameElement) => {
    const painted: boolean[] = [];

    subscriptions.push(paintedFrame$(iframe).subscribe((value) => painted.push(value)));

    return painted;
  };

  it('waits for the first height report after an asynchronous frame announced itself', () => {
    const iframe = frame();
    const painted = watch(iframe);

    message(iframe.contentWindow, { type: 'design-explore:loading' });
    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS + 1);

    expect(painted).toEqual([false]);

    message(iframe.contentWindow, report);
    vi.runAllTimers();

    expect(painted).toEqual([false, true]);
  });

  it('keeps a reporting frame hidden until the page says it painted', () => {
    const iframe = frame();
    const painted = watch(iframe);

    message(iframe.contentWindow, { type: 'design-explore:loading' });
    message(iframe.contentWindow, report);
    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS - 1);

    expect(painted).toEqual([false]);

    message(iframe.contentWindow, { type: 'design-explore:painted' });
    vi.runAllTimers();

    expect(painted).toEqual([false, true]);
  });

  it('settles a frame page that reports its height but never its paint once the fallback passed', () => {
    const iframe = frame();
    const painted = watch(iframe);

    message(iframe.contentWindow, { type: 'design-explore:loading' });
    message(iframe.contentWindow, report);
    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS);
    vi.runAllTimers();

    expect(painted).toEqual([false, true]);
  });
});

describe('frameLoad$', () => {
  let subscriptions: Subscription[];

  beforeEach(() => {
    subscriptions = [];
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => window.clearTimeout(handle));
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const watch = (iframe: HTMLIFrameElement) => {
    const loads: FrameLoad[] = [];

    subscriptions.push(frameLoad$(iframe).subscribe((load) => loads.push(load)));

    return loads;
  };

  it('fails a load without one message of the frame page, like the browser error page', () => {
    const iframe = frame();
    const loads = watch(iframe);

    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS);
    vi.runAllTimers();

    expect(loads).toEqual(['pending', 'failed']);
  });

  it('ignores the messages of another frame', () => {
    const iframe = frame();
    const other = frame();
    const loads = watch(iframe);

    message(other.contentWindow, { type: 'design-explore:loading' });
    message(other.contentWindow, { type: 'design-explore:painted' });
    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS);
    vi.runAllTimers();

    expect(loads).toEqual(['pending', 'failed']);
  });

  it('paints a failed frame once its reload reports', () => {
    const iframe = frame();
    const loads = watch(iframe);

    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS);
    message(iframe.contentWindow, { type: 'design-explore:loading' });
    iframe.dispatchEvent(new Event('load'));
    message(iframe.contentWindow, { type: 'design-explore:painted' });
    vi.runAllTimers();

    expect(loads).toEqual(['pending', 'failed', 'pending', 'painted']);
  });
});

describe('failedLoadReason$', () => {
  afterEach(() => vi.unstubAllGlobals());

  const reasonOf = async (src: string) => {
    let reason = '';

    await new Promise<void>((resolve) =>
      failedLoadReason$(src).subscribe({ next: (r) => (reason = r), complete: resolve }),
    );

    return reason;
  };

  it('names a refused connection', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await reasonOf('http://localhost:4402/frame.html?product=a')).toContain(
      'Nothing answers at localhost:4402, the design server may be restarting',
    );
  });

  it('names the status of an error answer', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503, statusText: 'Service Unavailable' }));

    expect(await reasonOf('http://localhost:4402/frame.html')).toBe(
      'The design server answered 503 Service Unavailable.',
    );
  });

  it('names a page that loads but never reports', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html></html>'));

    expect(await reasonOf('http://localhost:4402/frame.html')).toBe('The page loaded but sent no frame message.');
  });
});

describe('designServerBack$', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls the stamp of the frame server until it answers', async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    let up = false;
    let back = false;

    vi.stubGlobal('fetch', async (url: URL) => {
      asked.push(String(url));
      if (!up) throw new TypeError('Failed to fetch');

      return new Response('{}');
    });

    designServerBack$('http://localhost:4402/frame.html?product=a').subscribe(() => (back = true));
    await vi.advanceTimersByTimeAsync(SERVER_BACK_POLL_MS * 2);

    expect(back).toBe(false);

    up = true;
    await vi.advanceTimersByTimeAsync(SERVER_BACK_POLL_MS);

    expect(back).toBe(true);
    expect(asked.at(-1)).toBe('http://localhost:4402/__design/stamp');
    expect(asked).toHaveLength(4);
  });
});
