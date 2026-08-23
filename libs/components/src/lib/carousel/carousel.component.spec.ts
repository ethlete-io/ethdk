import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { flushFrames } from '../testing/driver-core';
import { LayoutRule, fakeElementScroll, fakeLayout, fakeResizeObserver, stackedChildren } from '../testing/fake-layout';
import { CarouselComponent } from './carousel.component';
import { CAROUSEL_IMPORTS } from './carousel.imports';
import { provideCarouselLabels } from './carousel-labels';
import { CarouselAutoplayDirective, CarouselDirective } from './headless';
import { CAROUSEL_SLIDE_PROGRESS_PROPERTY } from './headless/internals/carousel-slide-progress';

type Slide = { title: string };

@Component({
  selector: 'et-test-carousel-host',
  template: `
    <et-carousel
      [autoplay]="autoplay()"
      [autoplayTime]="autoplayTime()"
      [loop]="loop()"
      [itemSize]="itemSize()"
      [slideAlign]="slideAlign()"
      [transition]="transition()"
      [transitionDriver]="transitionDriver()"
    >
      <ng-template [etCarouselSlide]="slides()" [autoplayTimeFor]="autoplayTimeFor()" let-slide let-index="index">
        <span>{{ index + 1 }}. {{ slide.title }}</span>
      </ng-template>
    </et-carousel>
  `,
  imports: [CAROUSEL_IMPORTS],
})
class CarouselHostComponent {
  public carouselComponent = viewChild.required(CarouselComponent);
  public carousel = viewChild.required(CarouselComponent, { read: CarouselDirective });
  public autoplayDirective = viewChild.required(CarouselComponent, { read: CarouselAutoplayDirective });

  public slides = signal<Slide[]>([{ title: 'one' }, { title: 'two' }, { title: 'three' }]);
  public autoplay = signal(false);
  public autoplayTime = signal(5000);
  // off by default here so the plain cases see three slides and not three plus their clones; the looping
  // block below turns it on deliberately
  public loop = signal(false);
  public itemSize = signal('full');
  public slideAlign = signal<'start' | 'center'>('start');
  public transition = signal<'none' | 'dim' | 'wipe' | 'custom'>('none');
  public transitionDriver = signal<'auto' | 'scroll-timeline' | 'js' | 'none'>('auto');
  public autoplayTimeFor = signal<((slide: Slide, index: number) => number | null) | null>(null);
}

const createHost = (): ComponentFixture<CarouselHostComponent> => {
  const fixture = TestBed.createComponent(CarouselHostComponent);
  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<CarouselHostComponent>) => fixture.nativeElement as HTMLElement;

const slideElements = (fixture: ComponentFixture<CarouselHostComponent>) =>
  Array.from(host(fixture).querySelectorAll('.et-carousel-item'));

/**
 * The track's children reach the carousel through the scrollable's mutation observer, which reports
 * asynchronously - so anything reading `domCount()` (the clone count among it) needs a turn of the event
 * loop. The slide *count* does not: that comes from the slides array.
 */
const settleChildren = async (fixture: ComponentFixture<CarouselHostComponent>) => {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
};

const SLIDE_SIZE = 300;

/** The track's slides laid out in a row, inside a viewport exactly one slide wide. */
const CAROUSEL_LAYOUT: LayoutRule[] = [
  stackedChildren('.et-carousel-item', SLIDE_SIZE),
  { match: '.et-scrollable-container', clientWidth: SLIDE_SIZE },
];

describe('CarouselComponent', () => {
  it('is a labelled carousel region wrapping the track and its controls', () => {
    const fixture = createHost();
    const carousel = host(fixture).querySelector('et-carousel');

    expect(carousel?.getAttribute('role')).toBe('region');
    expect(carousel?.getAttribute('aria-roledescription')).toBe('carousel');
    expect(carousel?.getAttribute('aria-label')).toBe('Carousel');
    // the controls live inside the region, so they are part of what it labels
    expect(carousel?.querySelector('[etCarouselNext]')).toBeTruthy();
  });

  it('stamps the slide template once per slide, with the slide role and a typed context', () => {
    const fixture = createHost();
    const slides = slideElements(fixture);

    expect(slides.length).toBe(3);
    expect(slides[0]?.getAttribute('role')).toBe('group');
    expect(slides[0]?.getAttribute('aria-roledescription')).toBe('slide');
    expect(slides[1]?.textContent?.trim()).toBe('2. two');
    expect(fixture.componentInstance.carousel().count()).toBe(3);
  });

  it('takes the slide count from the slides array, so it does not wait for the DOM', () => {
    const fixture = createHost();

    fixture.componentInstance.slides.set([{ title: 'only one' }]);
    fixture.detectChanges();

    expect(fixture.componentInstance.carousel().count()).toBe(1);
  });

  it('renders a labelled dot per slide', () => {
    const fixture = createHost();
    const dots = host(fixture).querySelectorAll('.et-carousel-dot');

    expect(dots.length).toBe(3);
    expect(dots[1]?.getAttribute('aria-label')).toBe('Go to slide 2');

    fixture.componentInstance.slides.set([{ title: 'one' }, { title: 'two' }]);
    fixture.detectChanges();

    expect(host(fixture).querySelectorAll('.et-carousel-dot').length).toBe(2);
  });

  it('keeps both controls operable while looping, and marks them aria-disabled without it', () => {
    const fixture = createHost();
    const carousel = fixture.componentInstance.carousel();

    fixture.componentInstance.loop.set(true);
    fixture.detectChanges();

    expect(carousel.canGoNext()).toBe(true);
    expect(carousel.canGoPrevious()).toBe(true);

    fixture.componentInstance.loop.set(false);
    fixture.detectChanges();

    // jsdom has no layout, so the active slide stays at the start - which is where `previous` runs out
    expect(carousel.canGoPrevious()).toBe(false);
    expect(host(fixture).querySelector('[etCarouselPrevious]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('takes localized labels from the provider', () => {
    TestBed.configureTestingModule({ providers: [provideCarouselLabels({ carousel: 'Karussell' })] });

    const fixture = createHost();

    expect(host(fixture).querySelector('et-carousel')?.getAttribute('aria-label')).toBe('Karussell');
  });

  it('does not autoplay unless asked to', () => {
    // `<et-carousel>` always carries the autoplay directive, whose own `enabled` defaults to true because
    // putting it on an element is the opt-in. The component has to override that, or every carousel plays.
    TestBed.resetTestingModule();

    @Component({
      selector: 'et-test-carousel-bare',
      template: `
        <et-carousel>
          <ng-template [etCarouselSlide]="slides" let-slide>
            <span>{{ slide.title }}</span>
          </ng-template>
        </et-carousel>
      `,
      imports: [CAROUSEL_IMPORTS],
    })
    class BareHostComponent {
      public autoplayDirective = viewChild.required(CarouselComponent, { read: CarouselAutoplayDirective });
      public slides: Slide[] = [{ title: 'one' }, { title: 'two' }];
    }

    const fixture = TestBed.createComponent(BareHostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.autoplayDirective().isEnabled()).toBe(false);
    expect(fixture.componentInstance.autoplayDirective().pauseReason()).toBe('disabled');
    // and so no pause control is required, and none is rendered
    expect((fixture.nativeElement as HTMLElement).querySelector('[etCarouselPlayToggle]')).toBeNull();
  });

  it('renders no play control while autoplay is off, and one that reports the state while it is on', () => {
    const fixture = createHost();

    expect(host(fixture).querySelector('[etCarouselPlayToggle]')).toBeNull();

    fixture.componentInstance.autoplay.set(true);
    fixture.detectChanges();

    const toggle = host(fixture).querySelector('[etCarouselPlayToggle]');

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('Pause automatic slide show');

    (toggle as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('Start automatic slide show');
  });

  it('stays stopped when playOnInit is off, which is only bound after the directive is constructed', () => {
    TestBed.resetTestingModule();

    @Component({
      selector: 'et-test-carousel-no-play-on-init',
      template: `
        <et-carousel playOnInit="false" autoplay>
          <ng-template [etCarouselSlide]="slides" let-slide>
            <span>{{ slide.title }}</span>
          </ng-template>
        </et-carousel>
      `,
      imports: [CAROUSEL_IMPORTS],
    })
    class NoPlayOnInitHostComponent {
      public autoplayDirective = viewChild.required(CarouselComponent, { read: CarouselAutoplayDirective });
      public slides: Slide[] = [{ title: 'one' }, { title: 'two' }];
    }

    const fixture = TestBed.createComponent(NoPlayOnInitHostComponent);
    fixture.detectChanges();

    const autoplay = fixture.componentInstance.autoplayDirective();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector('[etCarouselPlayToggle]');

    expect(autoplay.playOnInit()).toBe(false);
    expect(autoplay.isStopped()).toBe(true);
    expect(autoplay.pauseReason()).toBe('stopped');
    expect(autoplay.isPlaying()).toBe(false);
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  });

  it('reports the play control as not playing for any pause, not only an explicit stop', () => {
    const fixture = createHost();
    fixture.componentInstance.autoplay.set(true);
    fixture.detectChanges();

    const autoplay = fixture.componentInstance.autoplayDirective();
    const toggle = host(fixture).querySelector('[etCarouselPlayToggle]');

    expect(toggle?.getAttribute('data-playing')).toBe('');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');

    // hovering a *slide* pauses without stopping - the rendered icon flips, so the label and aria must too
    autoplay.isHovered.set(true);
    fixture.detectChanges();

    expect(autoplay.isStopped()).toBe(false);
    expect(autoplay.pauseReason()).toBe('hover');
    expect(toggle?.getAttribute('data-playing')).toBeNull();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('Start automatic slide show');

    // and a control offering "play" must not stop autoplay when it is pressed
    (toggle as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(autoplay.isStopped()).toBe(false);
    expect(autoplay.pauseReason()).toBe('hover');
  });

  it('can be paused and restarted from its own control, which the pointer and focus are on', () => {
    const fixture = createHost();
    fixture.componentInstance.autoplay.set(true);
    fixture.detectChanges();

    const autoplay = fixture.componentInstance.autoplayDirective();
    const toggle = host(fixture).querySelector('[etCarouselPlayToggle]') as HTMLButtonElement;

    // pressing the control leaves the pointer on it and focus in it - the state a real click produces
    autoplay.isHovered.set(true);
    autoplay.isFocusWithin.set(true);
    autoplay.isPointerOnPauseControl.set(true);
    autoplay.isFocusOnPauseControl.set(true);

    toggle.click();
    fixture.detectChanges();
    expect(autoplay.pauseReason()).toBe('stopped');

    toggle.click();
    fixture.detectChanges();

    // hover and focus are still on the control, and must not stand in for the pause it just cleared
    expect(autoplay.pauseReason()).toBeNull();
    expect(autoplay.isPlaying()).toBe(true);

    // moving onto a slide is a different matter: that pause is what it is for
    autoplay.isPointerOnPauseControl.set(false);
    expect(autoplay.pauseReason()).toBe('hover');
  });

  it('reports why autoplay is not running', () => {
    const fixture = createHost();
    const autoplay = fixture.componentInstance.autoplayDirective();

    expect(autoplay.pauseReason()).toBe('disabled');

    fixture.componentInstance.autoplay.set(true);
    fixture.detectChanges();

    expect(autoplay.pauseReason()).toBeNull();
    expect(autoplay.isPlaying()).toBe(true);

    autoplay.isHovered.set(true);
    expect(autoplay.pauseReason()).toBe('hover');

    autoplay.isHovered.set(false);
    autoplay.stop();
    expect(autoplay.pauseReason()).toBe('stopped');

    autoplay.start();
    fixture.componentInstance.slides.set([{ title: 'only one' }]);
    fixture.detectChanges();

    // a single slide has nowhere to advance to
    expect(autoplay.pauseReason()).toBe('no-slides');
  });

  it('falls back to the carousel’s autoplayTime when no slide overrides it', () => {
    const fixture = createHost();
    fixture.componentInstance.autoplay.set(true);
    fixture.componentInstance.autoplayTime.set(4000);
    fixture.detectChanges();

    expect(fixture.componentInstance.autoplayDirective().duration()).toBe(4000);
  });

  it('hands each slide the duration autoplayTimeFor returns for it', async () => {
    const fixture = createHost();

    fixture.componentInstance.autoplayTimeFor.set((_slide, index) => (index === 0 ? 9000 : null));
    await settleChildren(fixture);

    const slides = fixture.componentInstance.carousel().items();

    expect(slides[0]?.autoplayTime()).toBe(9000);
    expect(slides[1]?.autoplayTime()).toBeNull();
  });

  describe('looping', () => {
    const FOUR_SLIDES: Slide[] = [{ title: 'one' }, { title: 'two' }, { title: 'three' }, { title: 'four' }];

    /** The host keeps `loop` off, so the looping cases turn it on along with the slides they need. */
    const createLoopingHost = async (slides: Slide[] = FOUR_SLIDES) => {
      const fixture = createHost();

      fixture.componentInstance.loop.set(true);
      fixture.componentInstance.slides.set(slides);
      await settleChildren(fixture);

      return fixture;
    };

    it('leaves the clones once layout arrives, even when the first alignment pass could not measure', async () => {
      const resizeObserver = fakeResizeObserver();
      const scroll = fakeElementScroll();

      const fixture = await createLoopingHost();
      const carousel = fixture.componentInstance.carousel();

      expect(carousel.cloneCount()).toBe(2);
      expect(carousel.domCount()).toBe(8);
      // a carousel in a hidden tab panel or a collapsed accordion: nothing to measure, so nowhere to go
      expect(scroll.calls()).toEqual([]);

      fakeLayout(CAROUSEL_LAYOUT);
      resizeObserver.fire();
      fixture.detectChanges();

      // the track opens parked on child 0, which is a clone - the real child for the same slide sits a
      // whole clone run further in, and that is where a looping carousel has to be put before it is seen
      const restingOffset = (carousel.cloneCount() + carousel.activeIndex()) * SLIDE_SIZE;

      expect(restingOffset).toBeGreaterThan(0);
      expect(scroll.lastCall()?.options).toEqual({ left: restingOffset, behavior: 'instant' });
    });

    it('crosses the seam once the scroll settles on a clone, landing on the same picture a track away', async () => {
      const resizeObserver = fakeResizeObserver();
      const scroll = fakeElementScroll();

      const fixture = await createLoopingHost();
      const carousel = fixture.componentInstance.carousel();

      fakeLayout(CAROUSEL_LAYOUT);
      resizeObserver.fire();
      fixture.detectChanges();

      const container = host(fixture).querySelector('.et-scrollable-container') as HTMLElement;
      const cloneCount = carousel.cloneCount();
      const trackLength = carousel.count() * SLIDE_SIZE;

      // resting on the leading clone run - the far side of the seam from the real run
      container.scrollLeft = 0;
      container.dispatchEvent(new Event('scrollend'));
      fixture.detectChanges();

      expect(scroll.lastCall()?.options).toEqual({ left: trackLength, behavior: 'instant' });

      // and the same holds crossing the trailing seam, in the other direction
      const trailingOffset = (cloneCount + carousel.count()) * SLIDE_SIZE;

      container.scrollLeft = trailingOffset;
      container.dispatchEvent(new Event('scrollend'));
      fixture.detectChanges();

      expect(scroll.lastCall()?.options).toEqual({ left: trailingOffset - trackLength, behavior: 'instant' });
    });

    it('does not cross the seam while a real slide is resting, even though it settled', async () => {
      const resizeObserver = fakeResizeObserver();
      const scroll = fakeElementScroll();

      const fixture = await createLoopingHost();

      fakeLayout(CAROUSEL_LAYOUT);
      resizeObserver.fire();
      fixture.detectChanges();

      const container = host(fixture).querySelector('.et-scrollable-container') as HTMLElement;
      const callsBeforeSettle = scroll.calls().length;

      // the first real slide, not a clone - nothing to correct
      container.scrollLeft = SLIDE_SIZE * 2;
      container.dispatchEvent(new Event('scrollend'));
      fixture.detectChanges();

      expect(scroll.calls().length).toBe(callsBeforeSettle);
    });

    it('renders clones either side of the slides, marked hidden and inert and left out of the count', async () => {
      const fixture = await createLoopingHost();
      const carousel = fixture.componentInstance.carousel();
      const cloneCount = carousel.cloneCount();

      // one slide per view, so a clone run is two slides long
      expect(cloneCount).toBe(2);
      expect(carousel.count()).toBe(4);
      expect(carousel.isLooping()).toBe(true);
      expect(carousel.domCount()).toBe(4 + cloneCount * 2);

      const slides = slideElements(fixture);
      const clones = slides.filter((slide) => slide.hasAttribute('data-clone'));

      expect(slides.length).toBe(8);
      expect(clones.length).toBe(4);
      expect(clones.every((clone) => clone.getAttribute('aria-hidden') === 'true')).toBe(true);
      expect(clones.every((clone) => clone.hasAttribute('inert'))).toBe(true);
      // a clone announces nothing: it is a slide the reader has already been told about
      expect(clones.every((clone) => !clone.hasAttribute('aria-label'))).toBe(true);

      // the dots and the `N of M` labels count the real slides only
      expect(host(fixture).querySelectorAll('.et-carousel-dot').length).toBe(4);
      expect(slides[cloneCount]?.getAttribute('aria-label')).toBe('1 of 4');
    });

    it('leads with clones of the last slides and trails with clones of the first', async () => {
      const fixture = await createLoopingHost();
      const text = slideElements(fixture).map((slide) => slide.textContent?.trim());

      // [3, 4] [1, 2, 3, 4] [1, 2] - so scrolling off either end lands on content, not on a wall
      expect(text).toEqual(['3. three', '4. four', '1. one', '2. two', '3. three', '4. four', '1. one', '2. two']);
    });

    it('maps a clone back onto the slide it clones', async () => {
      const fixture = await createLoopingHost();
      const carousel = fixture.componentInstance.carousel();
      const cloneCount = carousel.cloneCount();

      // the leading clones are the tail of the run, the trailing clones its head
      expect(carousel.slideIndexOf(0)).toBe(2);
      expect(carousel.slideIndexOf(1)).toBe(3);
      // the real slides map to themselves
      expect(carousel.slideIndexOf(cloneCount)).toBe(0);
      expect(carousel.slideIndexOf(cloneCount + 3)).toBe(3);
      // and past them it wraps round again
      expect(carousel.slideIndexOf(cloneCount + 4)).toBe(0);
      expect(carousel.slideIndexOf(cloneCount + 5)).toBe(1);
    });

    it('does not clone when every slide fits a viewport, so there is no seam to cross', async () => {
      const fixture = await createLoopingHost([{ title: 'only one' }]);
      const carousel = fixture.componentInstance.carousel();

      expect(carousel.cloneCount()).toBe(0);
      expect(carousel.isLooping()).toBe(false);
      expect(slideElements(fixture).length).toBe(1);
      // and a lone slide has nowhere to go, `loop` or not
      expect(carousel.canGoNext()).toBe(false);
    });

    it('does not clone with loop off', async () => {
      const fixture = createHost();

      fixture.componentInstance.slides.set(FOUR_SLIDES);
      await settleChildren(fixture);

      expect(fixture.componentInstance.carousel().cloneCount()).toBe(0);
      expect(slideElements(fixture).length).toBe(4);
      expect(slideElements(fixture).some((slide) => slide.hasAttribute('data-clone'))).toBe(false);
    });

    it('follows a change to the slides, clones included', async () => {
      const fixture = await createLoopingHost();
      const carousel = fixture.componentInstance.carousel();

      expect(carousel.domCount()).toBe(8);

      fixture.componentInstance.slides.update((slides) => [...slides, { title: 'five' }]);
      await settleChildren(fixture);

      expect(carousel.count()).toBe(5);
      expect(carousel.domCount()).toBe(5 + carousel.cloneCount() * 2);
      // the trailing clones still mirror the head of the run
      expect(slideElements(fixture).at(-1)?.textContent?.trim()).toBe('2. two');
    });

    it('grows the clone run with a multi-item view, capped at the number of slides', async () => {
      const fixture = await createLoopingHost(Array.from({ length: 8 }, (_, index) => ({ title: `slide ${index}` })));
      const carousel = fixture.componentInstance.carousel();

      fixture.componentInstance.itemSize.set('third');
      await settleChildren(fixture);

      // three per view plus one, so the seam is never in shot when the offset is shifted
      expect(carousel.cloneCount()).toBe(4);

      fixture.componentInstance.slides.set(FOUR_SLIDES);
      await settleChildren(fixture);

      // never more clones than there are slides to clone
      expect(carousel.cloneCount()).toBe(4);
      expect(carousel.domCount()).toBe(12);
    });
  });

  describe('transitions', () => {
    it('reports the effect and the driver actually filling the progress property', () => {
      const fixture = createHost();
      const carousel = host(fixture).querySelector('et-carousel');

      // nothing asked for, nothing running
      expect(carousel?.getAttribute('data-transition')).toBe('none');
      expect(carousel?.getAttribute('data-transition-driver')).toBe('none');

      fixture.componentInstance.transition.set('dim');
      fixture.componentInstance.transitionDriver.set('js');
      fixture.detectChanges();

      expect(carousel?.getAttribute('data-transition')).toBe('dim');
      expect(carousel?.getAttribute('data-transition-driver')).toBe('js');
    });

    it('centres the current slide when asked to, and tells the track to snap that way', () => {
      const fixture = createHost();
      const track = host(fixture).querySelector('et-scrollable');

      // the snapping is CSS reading these attributes, so they are the whole of the wiring
      expect(track?.hasAttribute('snap')).toBe(true);
      expect(track?.getAttribute('snap-origin')).toBe('start');

      fixture.componentInstance.slideAlign.set('center');
      fixture.detectChanges();

      // the alignment is the carousel's, and the track has to snap the same way or the two would fight
      expect(fixture.componentInstance.carousel().slideAlign()).toBe('center');
      expect(track?.getAttribute('snap-origin')).toBe('center');
    });

    it('reports a custom transition so a consumer can hang their own effect on the progress property', () => {
      const fixture = createHost();

      fixture.componentInstance.transition.set('custom');
      fixture.detectChanges();

      const carousel = host(fixture).querySelector('et-carousel');

      expect(carousel?.getAttribute('data-transition')).toBe('custom');
      // a driver has to be running, or nothing would fill the property
      expect(fixture.componentInstance.carousel().resolvedTransitionDriver()).not.toBe('none');
    });

    it('turns the driver off when asked for none, whatever the effect', () => {
      const fixture = createHost();

      fixture.componentInstance.transition.set('wipe');
      fixture.componentInstance.transitionDriver.set('none');
      fixture.detectChanges();

      expect(fixture.componentInstance.carousel().resolvedTransitionDriver()).toBe('none');
      // the effect is still reported, so a consumer's own CSS can still hang off it
      expect(host(fixture).querySelector('et-carousel')?.getAttribute('data-transition')).toBe('wipe');
    });
  });

  describe('slide progress', () => {
    const progressOf = (slide: Element | undefined) =>
      (slide as HTMLElement | undefined)?.style.getPropertyValue(CAROUSEL_SLIDE_PROGRESS_PROPERTY);

    it('fills the progress property for every slide once the js driver takes over', () => {
      const fixture = createHost();

      fakeLayout(CAROUSEL_LAYOUT);
      fixture.componentInstance.transition.set('dim');
      fixture.componentInstance.transitionDriver.set('js');
      fixture.detectChanges();

      const slides = slideElements(fixture);

      // slide 0 fills the viewport exactly (0), slide 1 sits just past it (-1, clamped), and so does 2
      expect(progressOf(slides[0])).toBe('0.000');
      expect(progressOf(slides[1])).toBe('-1.000');
      expect(progressOf(slides[2])).toBe('-1.000');
    });

    it('recomputes the progress as the track scrolls, and clears it when the driver hands back off', async () => {
      const fixture = createHost();

      fakeLayout(CAROUSEL_LAYOUT);
      fixture.componentInstance.transition.set('dim');
      fixture.componentInstance.transitionDriver.set('js');
      fixture.detectChanges();

      const container = host(fixture).querySelector('.et-scrollable-container') as HTMLElement;
      const slides = slideElements(fixture);

      container.scrollLeft = SLIDE_SIZE;
      container.dispatchEvent(new Event('scroll'));
      await flushFrames();

      // slide 1 is now exactly where slide 0 was - centred in the viewport
      expect(progressOf(slides[1])).toBe('0.000');

      fixture.componentInstance.transitionDriver.set('none');
      fixture.detectChanges();

      // nothing is filling the property any more, so it must not be left behind stale
      expect(progressOf(slides[1])).toBe('');
    });
  });
});
