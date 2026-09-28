import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  CAROUSEL_AUTOPLAY_TOKEN,
  CAROUSEL_ERROR_CODES,
  CAROUSEL_IMPORTS,
  CAROUSEL_LABELS,
  CAROUSEL_SLIDE_ALIGNMENTS,
  CAROUSEL_TOKEN,
  CAROUSEL_TRANSITION_DRIVERS,
  CAROUSEL_TRANSITIONS,
  CarouselAutoplayDirective,
  CarouselComponent,
  CarouselDirective,
  CarouselItemDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
  CarouselPreviousDirective,
  CarouselSlideDirective,
  DEFAULT_CAROUSEL_LABELS,
  injectCarouselLabels,
  provideCarouselLabels,
  SCROLLABLE_DRAG_IMPORTS,
  SCROLLABLE_IMPORTS,
} from '../index';
import { fakeElementScroll, fakeLayout, fakeResizeObserver, stackedChildren } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const SLIDE = 300;

const UNSTYLED_BLOCKS = 'et-carousel, et-scrollable { display: block; }';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const all = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));

const realSlides = () => all('.et-carousel-item:not([data-clone])');

const activeDot = () => all('.et-carousel-dot').findIndex((dot) => dot.getAttribute('aria-current') === 'true');

const layOut = (s: Scenario) => {
  const observer = fakeResizeObserver();
  const scroll = fakeElementScroll();

  fakeLayout([
    stackedChildren('.et-carousel-item', SLIDE),
    { match: '.et-scrollable-container', clientWidth: SLIDE, rect: { left: 0, top: 0, width: SLIDE, height: 200 } },
    {
      match: '.et-carousel-item',
      rect: (element) => ({ left: (element as HTMLElement).offsetLeft, top: 0, width: SLIDE, height: 200 }),
    },
  ]);

  const scrollWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');

  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      if (this.matches('.et-scrollable-container')) return this.querySelectorAll('.et-carousel-item').length * SLIDE;

      return (scrollWidth?.get?.call(this) as number | undefined) ?? 0;
    },
  });
  onTestFinished(() => {
    if (scrollWidth) Object.defineProperty(Element.prototype, 'scrollWidth', scrollWidth);
    else Reflect.deleteProperty(Element.prototype, 'scrollWidth');
  });

  return {
    scroll,
    measure: async () => {
      s.tick();
      await new Promise<void>((resolve) => setImmediate(resolve));
      s.tick();
      observer.fire();
      s.tick();
      s.frame(3);
    },
  };
};

const showOnly = (s: Scenario, slide: Element) => {
  const items = all('.et-carousel-item');

  for (const candidate of items) s.intersect(candidate, candidate === slide);
  for (const marker of all('.et-scroll-observer-first-element')) s.intersect(marker, slide === items[0]);
  for (const marker of all('.et-scroll-observer-last-element')) s.intersect(marker, slide === items.at(-1));
  s.tick();
};

const step = (s: Scenario, ms = 0) => {
  s.tick(ms);
  s.frame(3);
};

type Team = { name: string };

@Component({
  selector: 'et-scenario-slide-probe',
  template: `{{ carousel.count() }}|{{ autoplay?.isPlaying() ?? 'none' }}`,
})
class SlideProbeComponent {
  carousel = inject(CAROUSEL_TOKEN);
  autoplay = inject(CAROUSEL_AUTOPLAY_TOKEN, { optional: true });
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-team-carousel',
  imports: [CAROUSEL_IMPORTS, SlideProbeComponent],
  template: `
    <et-carousel
      [loop]="loop()"
      [labels]="labels()"
      [slideAlign]="align()"
      [transition]="transition()"
      [transitionDriver]="driver()"
    >
      <ng-template [etCarouselSlide]="teams()" let-team let-index="index" let-count="count" let-clone="clone">
        <article [attr.data-clone-view]="clone ? '' : null" class="team-card">
          <h3>{{ index + 1 }}/{{ count }} {{ team.name }}</h3>
          <button (click)="follow.push(team.name)" class="follow" type="button">Follow</button>
          <et-scenario-slide-probe />
        </article>
      </ng-template>
    </et-carousel>
  `,
})
class TeamCarouselComponent {
  teams = signal<Team[]>([{ name: 'team-a' }, { name: 'team-b' }, { name: 'team-c' }]);
  loop = signal(false);
  labels = signal<{ carousel?: string } | null>(null);
  align = signal<'start' | 'center'>(CAROUSEL_SLIDE_ALIGNMENTS.START);
  transition = signal<'none' | 'dim' | 'wipe' | 'custom'>(CAROUSEL_TRANSITIONS.NONE);
  driver = signal<'auto' | 'scroll-timeline' | 'js' | 'none'>(CAROUSEL_TRANSITION_DRIVERS.AUTO);
  follow: string[] = [];
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-news-carousel',
  imports: [CarouselComponent, CarouselSlideDirective],
  template: `
    <et-carousel [autoplayTime]="3000" [playOnInit]="playOnInit" autoplay>
      <ng-template [etCarouselSlide]="news" [autoplayTimeFor]="longerOnText" let-item>
        <p>{{ item }}</p>
      </ng-template>
    </et-carousel>
  `,
})
class NewsCarouselComponent {
  news = ['Kick-off', 'Half-time report with a long paragraph', 'Final whistle'];
  playOnInit = true;
  longerOnText = (item: string) => (item.length > 20 ? 8000 : null);
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-own-carousel',
  imports: [
    CarouselDirective,
    CarouselItemDirective,
    CarouselAutoplayDirective,
    CarouselPreviousDirective,
    CarouselNextDirective,
    CarouselPlayToggleDirective,
    SCROLLABLE_IMPORTS,
    SCROLLABLE_DRAG_IMPORTS,
  ],
  template: `
    <section
      #carousel="etCarousel"
      #autoplay="etCarouselAutoplay"
      [loop]="false"
      [autoplayTime]="2000"
      [pauseOnHover]="pauseOnHover"
      [enabled]="autoplayOn()"
      etCarousel
      etCarouselAutoplay
    >
      <et-scrollable itemSize="full" etScrollableSnap>
        @for (photo of photos; track photo) {
          <figure [autoplayTime]="photo === 'Stadium' ? 4000 : null" etCarouselItem>{{ photo }}</figure>
        }
      </et-scrollable>
      <button class="own-previous" etCarouselPrevious>Back</button>
      <span class="own-position">{{ carousel.activeIndex() + 1 }} / {{ carousel.count() }}</span>
      <button class="own-toggle" etCarouselPlayToggle>{{ autoplay.isPlaying() ? 'Pause' : 'Play' }}</button>
      <button class="own-next" etCarouselNext>Forward</button>
    </section>
  `,
})
class OwnCarouselComponent {
  photos = ['Pitch', 'Stadium', 'Fans'];
  pauseOnHover = true;
  autoplayOn = signal(true);
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-broken-carousels',
  imports: [CarouselComponent, CarouselDirective, CarouselItemDirective, CarouselAutoplayDirective, SCROLLABLE_IMPORTS],
  template: `
    <div class="stray" etCarouselItem>Stray</div>
    <et-carousel class="empty" />
    <div class="no-track" etCarousel></div>
    <et-scrollable class="no-pause" etCarousel etCarouselAutoplay>
      <div etCarouselItem>One</div>
      <div etCarouselItem>Two</div>
    </et-scrollable>
  `,
})
class BrokenCarouselsComponent {}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-itemless-carousel',
  imports: [CarouselDirective, SCROLLABLE_IMPORTS],
  template: `
    <et-scrollable etCarousel>
      <div>Plain child</div>
    </et-scrollable>
  `,
})
class ItemlessCarouselComponent {}

@Component({
  selector: 'et-scenario-carousel-labels-probe',
  template: `{{ labels().next }}|{{ labels().slide(2, 5) }}`,
})
class LabelsProbeComponent {
  labels = injectCarouselLabels();
  source = inject(CAROUSEL_LABELS);
}

describe('carousel scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('steps a non-looping team carousel with its controls and dots, and follows a swipe', async () => {
    const s = scenario();
    const { scroll, measure } = layOut(s);
    const fixture = TestBed.createComponent(TeamCarouselComponent);
    const page = fixture.componentInstance;

    await measure();

    const region = query('et-carousel');

    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-roledescription')).toBe('carousel');
    expect(region.getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.carousel);
    expect(region.hasAttribute('data-looping')).toBe(false);
    expect(all('.et-carousel-item[data-clone]')).toHaveLength(0);
    expect(realSlides().map((slide) => text(slide.querySelector('h3')))).toEqual([
      '1/3 team-a',
      '2/3 team-b',
      '3/3 team-c',
    ]);
    expect(realSlides().map((slide) => slide.getAttribute('aria-label'))).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(realSlides().every((slide) => slide.getAttribute('aria-roledescription') === 'slide')).toBe(true);
    expect(all('.et-carousel-dot').map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Go to slide 1',
      'Go to slide 2',
      'Go to slide 3',
    ]);
    expect(text(query('et-scenario-slide-probe'))).toBe('3|false');
    expect(document.querySelector('[etCarouselPlayToggle]')).toBeNull();

    const previous = query<HTMLButtonElement>('[etCarouselPrevious]');
    const next = query<HTMLButtonElement>('[etCarouselNext]');

    expect(previous.getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.previous);
    expect(next.getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.next);
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(next.hasAttribute('aria-disabled')).toBe(false);

    showOnly(s, realSlides()[0] as HTMLElement);
    expect(activeDot()).toBe(0);
    expect(realSlides()[0]?.hasAttribute('data-active')).toBe(true);

    next.click();
    step(s);

    expect(scroll.lastCall()?.options.left).toBe(SLIDE);
    expect(activeDot()).toBe(1);
    expect(previous.hasAttribute('aria-disabled')).toBe(false);

    all('.et-carousel-dot')[2]?.click();
    step(s);

    expect(scroll.lastCall()?.options.left).toBe(2 * SLIDE);
    expect(activeDot()).toBe(2);
    expect(next.getAttribute('aria-disabled')).toBe('true');

    const calls = scroll.calls().length;

    next.click();
    step(s);
    expect(scroll.calls()).toHaveLength(calls);

    const container = query('.et-scrollable-container');

    container.dispatchEvent(new Event('pointerdown'));
    container.scrollLeft = SLIDE;
    container.dispatchEvent(new Event('scroll'));
    step(s);
    showOnly(s, realSlides()[1] as HTMLElement);
    expect(activeDot()).toBe(1);

    query<HTMLButtonElement>('.follow', realSlides()[1]).click();
    expect(page.follow).toEqual(['team-b']);

    page.teams.set([...page.teams(), { name: 'team-d' }]);
    page.labels.set({ carousel: 'Featured teams' });
    await measure();

    expect(region.getAttribute('aria-label')).toBe('Featured teams');
    expect(all('.et-carousel-dot')).toHaveLength(4);
    expect(realSlides().at(-1)?.getAttribute('aria-label')).toBe('4 of 4');
  });

  it('loops seamlessly with clones that stay hidden, and wraps the controls round the seam', async () => {
    const s = scenario();
    const { scroll, measure } = layOut(s);
    const fixture = TestBed.createComponent(TeamCarouselComponent);

    fixture.componentInstance.loop.set(true);
    await measure();
    await measure();

    const region = query('et-carousel');
    const clones = all('.et-carousel-item[data-clone]');

    expect(region.hasAttribute('data-looping')).toBe(true);
    expect(clones).toHaveLength(4);
    expect(clones.every((clone) => clone.getAttribute('aria-hidden') === 'true' && clone.hasAttribute('inert'))).toBe(
      true,
    );
    expect(clones.every((clone) => clone.getAttribute('aria-label') === null)).toBe(true);
    expect(all('.team-card[data-clone-view]')).toHaveLength(4);
    expect(all('.et-carousel-dot')).toHaveLength(3);

    const items = all('.et-carousel-item');

    showOnly(s, items[2] as HTMLElement);
    expect(activeDot()).toBe(0);
    expect(query<HTMLButtonElement>('[etCarouselPrevious]').hasAttribute('aria-disabled')).toBe(false);

    query<HTMLButtonElement>('[etCarouselPrevious]').click();
    step(s);

    expect(scroll.lastCall()?.options.left).toBe(SLIDE);
    expect(activeDot()).toBe(2);
  });

  it('marks the chosen alignment, transition and resolved transition driver on the region', async () => {
    const s = scenario();
    const { measure } = layOut(s);
    const fixture = TestBed.createComponent(TeamCarouselComponent);
    const page = fixture.componentInstance;

    await measure();

    const region = query('et-carousel');

    expect(region.getAttribute('data-slide-align')).toBe('start');
    expect(region.getAttribute('data-transition')).toBe('none');
    expect(region.getAttribute('data-transition-driver')).toBe('none');

    page.align.set(CAROUSEL_SLIDE_ALIGNMENTS.CENTER);
    page.transition.set(CAROUSEL_TRANSITIONS.DIM);
    page.driver.set(CAROUSEL_TRANSITION_DRIVERS.JS);
    step(s);

    expect(region.getAttribute('data-slide-align')).toBe('center');
    expect(region.getAttribute('data-transition')).toBe('dim');
    expect(region.getAttribute('data-transition-driver')).toBe('js');

    page.driver.set(CAROUSEL_TRANSITION_DRIVERS.NONE);
    step(s);

    expect(region.getAttribute('data-transition-driver')).toBe('none');
  });

  it('autoplays with a pause control, rests longer on a text slide and pauses for hover and focus', async () => {
    const s = scenario();
    const { scroll, measure } = layOut(s);

    TestBed.createComponent(NewsCarouselComponent);
    await measure();
    await measure();

    const region = query('et-carousel');
    const toggle = query<HTMLButtonElement>('[etCarouselPlayToggle]');
    const realStart = all('.et-carousel-item[data-clone]').length / 2;

    showOnly(s, all('.et-carousel-item')[realStart] as HTMLElement);

    expect(region.hasAttribute('data-autoplaying')).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.pause);
    expect(query('.et-carousel-dot[aria-current="true"]').hasAttribute('data-counting')).toBe(true);

    const calls = scroll.calls().length;

    step(s, 2999);
    expect(scroll.calls()).toHaveLength(calls);

    step(s, 1);
    expect(scroll.lastCall()?.options.left).toBe((realStart + 1) * SLIDE);
    expect(activeDot()).toBe(1);

    const afterFirst = scroll.calls().length;

    step(s, 3000);
    expect(scroll.calls()).toHaveLength(afterFirst);

    step(s, 5000);
    expect(activeDot()).toBe(2);

    region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    step(s);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.play);

    const paused = scroll.calls().length;

    step(s, 10000);
    expect(scroll.calls()).toHaveLength(paused);

    toggle.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    step(s);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    step(s);
    toggle.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    step(s);

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(region.hasAttribute('data-autoplaying')).toBe(false);

    step(s, 10000);
    expect(scroll.calls()).toHaveLength(paused);

    toggle.click();
    step(s);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    query<HTMLButtonElement>('[etCarouselNext]').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    step(s);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('builds its own carousel over a scrollable, with its own controls, per-slide times and an end stop', async () => {
    const s = scenario();
    const { scroll, measure } = layOut(s);
    const fixture = TestBed.createComponent(OwnCarouselComponent);

    await measure();

    const section = query('section');
    const toggle = query<HTMLButtonElement>('.own-toggle');
    const slides = all('.et-carousel-item');

    expect(section.getAttribute('role')).toBe('region');
    expect(slides.map((slide) => slide.getAttribute('aria-label'))).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(query('.own-previous').getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.previous);
    expect(query('.own-previous').getAttribute('type')).toBe('button');

    showOnly(s, slides[0] as HTMLElement);

    expect(text(query('.own-position'))).toBe('1 / 3');
    expect(text(toggle)).toBe('Pause');

    step(s, 2000);
    expect(scroll.lastCall()?.options.left).toBe(SLIDE);
    expect(text(query('.own-position'))).toBe('2 / 3');

    step(s, 2000);
    expect(text(query('.own-position'))).toBe('2 / 3');

    step(s, 2000);
    expect(text(query('.own-position'))).toBe('3 / 3');
    expect(query('.own-next').getAttribute('aria-disabled')).toBe('true');

    step(s, 2000);
    expect(text(toggle)).toBe('Play');

    query<HTMLButtonElement>('.own-previous').click();
    step(s);
    expect(text(query('.own-position'))).toBe('2 / 3');

    fixture.componentInstance.autoplayOn.set(false);
    step(s);

    expect(text(toggle)).toBe('Play');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('reports parts outside a carousel, a carousel without slides, track or pause control', () => {
    const s = scenario();

    TestBed.createComponent(BrokenCarouselsComponent);
    step(s, 1);

    for (const code of [
      CAROUSEL_ERROR_CODES.PART_OUTSIDE_CAROUSEL,
      CAROUSEL_ERROR_CODES.MISSING_SLIDE_TEMPLATE,
      CAROUSEL_ERROR_CODES.MISSING_SCROLLABLE,
      CAROUSEL_ERROR_CODES.AUTOPLAY_WITHOUT_PAUSE_CONTROL,
    ]) {
      s.expectError(`ET${code}`);
    }

    s.errors.splice(0, s.errors.length);

    const itemless = TestBed.createComponent(ItemlessCarouselComponent);

    expect(() => itemless.detectChanges()).not.toThrow();
    step(s, 1);
    s.expectError(`ET${CAROUSEL_ERROR_CODES.MISSING_ITEMS}`);
    expect(itemless.nativeElement.querySelector('[aria-roledescription="slide"]')).toBeNull();

    s.tick(1);
    s.frame(3);
    s.errors.splice(0, s.errors.length);
  });
});

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-german-carousel',
  imports: [CAROUSEL_IMPORTS, LabelsProbeComponent],
  template: `
    <et-carousel>
      <ng-template [etCarouselSlide]="['Tor', 'Abpfiff']" let-item
        ><p>{{ item }}</p></ng-template
      >
    </et-carousel>
    <et-scenario-carousel-labels-probe />
  `,
})
class GermanCarouselComponent {}

describe('carousel scenarios with app labels', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideCarouselLabels({ next: 'Nächstes Bild', slide: (index, count) => `${index} von ${count}` }),
    ],
  });

  it('localizes the controls and slide labels and keeps the rest at the defaults', async () => {
    const s = scenario();
    const { measure } = layOut(s);
    const fixture = TestBed.createComponent(GermanCarouselComponent);

    await measure();

    expect(query('[etCarouselNext]').getAttribute('aria-label')).toBe('Nächstes Bild');
    expect(query('[etCarouselPrevious]').getAttribute('aria-label')).toBe(DEFAULT_CAROUSEL_LABELS.previous);
    expect(realSlides().map((slide) => slide.getAttribute('aria-label'))).toEqual(['1 von 2', '2 von 2']);
    expect(text(query('et-scenario-carousel-labels-probe'))).toBe('Nächstes Bild|2 von 5');
    expect(
      Object.keys(
        fixture.debugElement.query((node) => node.name === 'et-scenario-carousel-labels-probe').componentInstance
          .source,
      ),
    ).toEqual(['next', 'slide']);
  });
});
