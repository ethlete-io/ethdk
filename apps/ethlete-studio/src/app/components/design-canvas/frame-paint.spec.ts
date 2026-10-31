import { Subscription } from 'rxjs';
import { vi } from 'vitest';
import { paintedFrame$, UNREPORTED_PAINT_MS } from './frame-paint';

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

  it('settles an external frame that silently loads', () => {
    const iframe = frame();
    const painted = watch(iframe);

    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS);
    vi.runAllTimers();

    expect(painted).toEqual([false, true]);
  });

  it('ignores a loading message from another frame', () => {
    const iframe = frame();
    const other = frame();
    const painted = watch(iframe);

    message(other.contentWindow, { type: 'design-explore:loading' });
    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(UNREPORTED_PAINT_MS);
    vi.runAllTimers();

    expect(painted).toEqual([false, true]);
  });
});
