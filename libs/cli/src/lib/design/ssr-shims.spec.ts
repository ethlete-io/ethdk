import { describe, expect, it, vi } from 'vitest';
import { keepCustomPropertyCase, quietDevModeNotice, shimMutationObserver } from './ssr-shims';

const serverRender = async (template: string) => {
  await import('@angular/compiler');

  const [core, browser, server] = await Promise.all([
    import('@angular/core'),
    import('@angular/platform-browser'),
    import('@angular/platform-server'),
  ]);

  server.ɵDominoAdapter.makeCurrent();
  keepCustomPropertyCase(globalThis.Element.prototype);

  const Host = core.Component({ selector: 'et-design-host', template })(
    class {
      tone = 'red';
    },
  );
  const document = await server.renderApplication(
    (context) =>
      browser.bootstrapApplication(
        Host,
        { providers: [core.provideZonelessChangeDetection(), server.provideServerRendering()] },
        context,
      ),
    { document: '<html><head></head><body><et-design-host></et-design-host></body></html>', url: '/' },
  );

  return /<et-design-host[^>]*>([\s\S]*)<\/et-design-host>/.exec(document)?.[1] ?? '';
};

describe('keepCustomPropertyCase', () => {
  it('keeps the case of a custom property an inline style binds', async () => {
    const markup = await serverRender(
      `<p style="--tfl-accentDeep: {{ tone }}"></p>` +
        `<i [style.--bindCase]="tone" [style.color]="tone"></i>` +
        `<b [style]="{ '--objCase': tone, 'color': 'Blue' }"></b>`,
    );

    expect(markup).toContain('<p style="--tfl-accentDeep: red;">');
    expect(markup).toContain('<i style="--bindCase: red; color: red;">');
    expect(markup).toContain('<b style="--objCase: red; color: Blue;">');
  }, 30_000);

  it('renders again in the same process after patching', async () => {
    keepCustomPropertyCase(globalThis.Element.prototype);

    expect(await serverRender('<p [style.--aB]="tone">hi</p>')).toBe('<p style="--aB: red;">hi</p>');
    expect(await serverRender('<p>hi</p>')).toBe('<p>hi</p>');
  }, 30_000);

  it('keeps the case when a style attribute written as text is parsed again', async () => {
    await serverRender('');

    const { ɵgetDOM } = await import('@angular/common');
    const element = ɵgetDOM().getDefaultDocument().createElement('p');

    element.setAttribute('style', '--keepMe: 1; --and-this: 2');
    element.style.setProperty('color', 'red');
    element.style.setProperty('--otherOne', 'x', 'important');

    expect(element.getAttribute('style')).toBe('--keepMe: 1; --and-this: 2; color: red; --otherOne: x !important;');
    expect(element.style.getPropertyValue('--keepMe')).toBe('1');

    element.style.removeProperty('--keepMe');
    expect(element.getAttribute('style')).toBe('--and-this: 2; color: red; --otherOne: x !important;');
  }, 30_000);
});

describe('shimMutationObserver', () => {
  it('adds an observer that never fires, and keeps an existing one', () => {
    const scope: { MutationObserver?: unknown } = {};

    shimMutationObserver(scope);

    const Observer = scope.MutationObserver as new (callback: () => void) => MutationObserver;
    const observer = new Observer(() => {
      throw new Error('fired');
    });

    observer.observe({} as Node, { attributes: true });
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();

    const existing = class {};
    const withOne = { MutationObserver: existing };

    shimMutationObserver(withOne);
    expect(withOne.MutationObserver).toBe(existing);
  });
});

describe('quietDevModeNotice', () => {
  it('drops the development mode line of each render and keeps every other log', async () => {
    const original = console.log;
    const log = vi.fn();

    console.log = log;

    try {
      quietDevModeNotice(console);
      await serverRender('<p>hi</p>');
      await serverRender('<p>again</p>');
      console.log('kept');
    } finally {
      console.log = original;
    }

    expect(log.mock.calls).toEqual([['kept']]);
  }, 30_000);
});
