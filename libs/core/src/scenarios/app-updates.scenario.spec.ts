import { injectAppUpdates, provideAppUpdates } from '../index';
import { useScenario } from './harness';

const indexHtml = (...entries: string[]) =>
  `<!doctype html><html><head><link rel="stylesheet" href="/styles-A.css"></head><body><et-root></et-root>${entries
    .map((src) => `<script src="${src}" type="module"></script>`)
    .join('')}</body></html>`;

const appendScript = (parent: HTMLElement, src: string) => {
  const script = document.createElement('script');
  script.setAttribute('src', src);
  parent.appendChild(script);

  return script;
};

describe('app-update scenarios', () => {
  let deployed = indexHtml('/main-AAA.js');
  const added: HTMLScriptElement[] = [];

  beforeEach(() => {
    deployed = indexHtml('/main-AAA.js');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(deployed, { status: 200 }))),
    );
    added.push(appendScript(document.body, '/main-AAA.js'));
    added.push(appendScript(document.body, '/consent-loader.js'));
  });

  afterEach(() => {
    added.splice(0).forEach((script) => script.remove());
    vi.unstubAllGlobals();
  });

  const scenario = useScenario({ providers: [provideAppUpdates({ pollInterval: 0 })] });

  it('reports no update while the deploy matches, even after the app appended scripts of its own', async () => {
    const s = scenario();
    const updates = s.run(() => injectAppUpdates());

    void updates.check();
    await s.settle();

    expect(updates.isAvailable()).toBe(false);

    added.push(appendScript(document.head, '/chat-widget.js'));

    void updates.check();
    await s.settle();

    expect(updates.isAvailable()).toBe(false);
  });

  it('reports an update once the entry document references a different entry script', async () => {
    const s = scenario();
    const updates = s.run(() => injectAppUpdates());

    deployed = indexHtml('/main-BBB.js');

    void updates.check();
    await s.settle();

    expect(updates.isAvailable()).toBe(true);
  });
});
