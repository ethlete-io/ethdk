import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { MotionAnswer, motionUrl } from '../../host/design-motion';
import { THEMES } from '../../themes';
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
