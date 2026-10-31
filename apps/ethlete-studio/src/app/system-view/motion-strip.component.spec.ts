import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { MotionAnswer, motionUrl } from '../../host/design-motion';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { THEMES } from '../../themes';
import { MotionCanvas, motionFrameIdOf } from './motion-drive';
import { MotionStripComponent } from './motion-strip.component';

const answerOf = (motion: string, url: string): MotionAnswer => ({
  product: 'studio',
  part: 'components/drawer',
  motion,
  from: 'closed',
  to: 'open',
  mode: 'full',
  preset: 'phone',
  width: 390,
  end: 400,
  tracks: [
    {
      element: '[data-et-key="panel"]',
      kind: 'transition',
      properties: ['opacity'],
      start: 0,
      delay: 0,
      duration: 400,
      iterations: 1,
      easing: 'ease-out',
      end: 400,
    },
  ],
  keyframes: [0, 100, 200, 300, 400].map((ms) => ({ ms, src: `${url}&frame=${ms}` })),
});

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async (fixture: ComponentFixture<MotionStripComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const render = async () => {
  const asked: string[] = [];

  vi.stubGlobal('fetch', (url: string) => {
    asked.push(url);

    return url.includes('motion=broken')
      ? json({ error: 'design-explore: the motion failed' }, 422)
      : json(answerOf(new URL(url).searchParams.get('motion') ?? '', url));
  });
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(MotionStripComponent);

  fixture.componentRef.setInput('port', 4999);
  fixture.componentRef.setInput('product', 'studio');
  fixture.componentRef.setInput('part', 'components/drawer');
  fixture.componentRef.setInput('presets', ['phone', 'desktop']);
  fixture.componentRef.setInput('motions', {
    open: { from: 'closed', to: 'open' },
    broken: { from: 'open', to: 'closed' },
  });
  await settle(fixture);

  return { fixture, asked, element: fixture.nativeElement as HTMLElement };
};

describe('motionUrl', () => {
  it('asks for one motion at a preset and mode', () => {
    expect(
      motionUrl({
        port: 4999,
        product: 'studio',
        part: 'components/drawer',
        motion: 'open',
        preset: 'phone',
        mode: 'reduced',
      }),
    ).toBe(
      'http://localhost:4999/__design/motion?product=studio&part=components%2Fdrawer&motion=open&preset=phone&mode=reduced',
    );
  });
});

describe('MotionStripComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws a row per motion with its keyframes at the first preset', async () => {
    const { element, asked } = await render();
    const open = element.querySelector('[data-motion="open"]');

    expect(asked.every((url) => url.includes('preset=phone') && url.includes('mode=full'))).toBe(true);
    expect([...(open?.querySelectorAll('[data-motion-keyframe]') ?? [])].map((key) => key.textContent?.trim())).toEqual(
      ['0 ms', '100 ms', '200 ms', '300 ms', '400 ms'],
    );
    expect(open?.querySelector('img')?.getAttribute('src')).toContain('motion=open');
  });

  it('shows the refusal of a motion the server cannot draw in its row', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-motion="broken"] [data-motion-error]')?.textContent?.trim()).toBe(
      'design-explore: the motion failed',
    );
  });

  it('opens the timeline at the clicked keyframe and closes it again', async () => {
    const { element, fixture } = await render();

    expect(element.querySelector('[data-motion-timeline]')).toBeNull();

    element.querySelectorAll<HTMLButtonElement>('[data-motion="open"] [data-motion-keyframe]')[2]?.click();
    await settle(fixture);

    expect(element.querySelector('[data-motion-time]')?.textContent?.trim()).toBe('200 / 400 ms');

    [...element.querySelectorAll<HTMLButtonElement>('[data-motion-timeline] button')]
      .find((button) => button.textContent?.trim() === 'Close')
      ?.click();
    await settle(fixture);

    expect(element.querySelector('[data-motion-timeline]')).toBeNull();
  });

  it('draws the motions anew at another preset and in reduced motion', async () => {
    const { element, fixture, asked } = await render();

    element.querySelectorAll<HTMLButtonElement>('[data-motion-preset]')[1]?.click();
    await settle(fixture);
    element.querySelector<HTMLButtonElement>('[data-motion-reduced]')?.click();
    await settle(fixture);

    expect(asked.some((url) => url.includes('preset=desktop') && url.includes('mode=full'))).toBe(true);
    expect(asked.at(-1)).toContain('preset=desktop&mode=reduced');
  });
});

const frameOf = (state: string, size: string, interaction?: string): CanvasFrame => ({
  id: [state, size, ...(interaction ? [interaction] : [])].join(' '),
  src: '',
  label: state,
  place: { part: 'components/drawer', state, size, ...(interaction ? { interaction } : {}) },
});

const FRAMES = [frameOf('closed', 'desktop'), frameOf('closed', 'phone', 'hover'), frameOf('closed', 'phone')];

describe('motionFrameIdOf', () => {
  it('picks the resting frame of the from state at the preset, else the first resting one', () => {
    expect(motionFrameIdOf(FRAMES, { state: 'closed', preset: 'phone' })).toBe('closed phone');
    expect(motionFrameIdOf(FRAMES, { state: 'closed', preset: 'tablet' })).toBe('closed desktop');
    expect(motionFrameIdOf(FRAMES, { state: 'open', preset: 'phone' })).toBeNull();
  });
});

describe('MotionStripComponent driving the live frame', () => {
  afterEach(() => vi.unstubAllGlobals());

  const drive = async () => {
    const iframe = document.createElement('iframe');

    document.body.append(iframe);

    const target = iframe.contentWindow as Window;
    const posted = vi.spyOn(target, 'postMessage').mockImplementation(() => undefined);
    const live = signal<string | null>(null);
    const canvas: MotionCanvas = {
      frames: () => FRAMES,
      activate: vi.fn((id: string) => live.set(id)),
      liveWindowOf: (id) => (live() === id ? target : null),
    };
    const rendered = await render();

    rendered.fixture.componentRef.setInput('canvas', canvas);
    rendered.element.querySelectorAll<HTMLButtonElement>('[data-motion="open"] [data-motion-keyframe]')[2]?.click();
    await settle(rendered.fixture);

    const messages = () => posted.mock.calls.map(([message]) => message as { type: string });

    return { ...rendered, canvas, target, messages, posted };
  };

  const answerReady = (target: Window, motion: string) =>
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'design-explore:motion-ready', motion }, source: target }),
    );

  it('makes the frame of the from state live and starts the motion in it', async () => {
    const { canvas, element, messages } = await drive();

    expect(canvas.activate).toHaveBeenCalledWith('closed phone');
    expect(messages()).toEqual([{ type: 'design-explore:motion-start', motion: 'open', reduced: false }]);
    expect(element.querySelector('[data-motion-picture]')).not.toBeNull();
    expect(element.querySelector('[data-motion-driven]')).toBeNull();
  });

  it('posts the slider time, play and speed once the frame is ready, and stop on close', async () => {
    const { element, fixture, target, messages } = await drive();

    answerReady(target, 'open');
    await settle(fixture);

    expect(element.querySelector('[data-motion-picture]')).toBeNull();
    expect(element.querySelector('[data-motion-driven]')).not.toBeNull();
    expect(messages().at(-1)).toEqual({ type: 'design-explore:motion-seek', ms: 200, rate: 1 });

    element.querySelectorAll<HTMLButtonElement>('[data-motion-speed]')[1]?.click();
    await settle(fixture);

    expect(messages().at(-1)).toEqual({ type: 'design-explore:motion-seek', ms: 200, rate: 0.25 });

    element.querySelector<HTMLButtonElement>('[data-motion-play]')?.click();
    await settle(fixture);

    expect(messages()).toContainEqual({ type: 'design-explore:motion-play', ms: 200, rate: 0.25 });

    [...element.querySelectorAll<HTMLButtonElement>('[data-motion-timeline] button')]
      .find((button) => button.textContent?.trim() === 'Close')
      ?.click();
    await settle(fixture);

    expect(messages().at(-1)).toEqual({ type: 'design-explore:motion-stop' });
  });
});
