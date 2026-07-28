import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { CarouselComponent } from './carousel.component';
import { CAROUSEL_IMPORTS } from './carousel.imports';
import { provideCarouselLabels } from './carousel-labels';
import { CarouselAutoplayDirective, CarouselDirective } from './headless';

@Component({
  selector: 'et-test-carousel-host',
  template: `
    <et-carousel [autoplay]="autoplay()" [autoplayTime]="autoplayTime()" [loop]="loop()">
      @for (slide of slides(); track slide) {
        <div etCarouselItem>{{ slide }}</div>
      }
    </et-carousel>
  `,
  imports: [CAROUSEL_IMPORTS],
})
class CarouselHostComponent {
  public carouselComponent = viewChild.required(CarouselComponent);
  public carousel = viewChild.required(CarouselComponent, { read: CarouselDirective });
  public autoplayDirective = viewChild.required(CarouselComponent, { read: CarouselAutoplayDirective });

  public slides = signal(['one', 'two', 'three']);
  public autoplay = signal(false);
  public autoplayTime = signal(5000);
  public loop = signal(true);
}

const createHost = (): ComponentFixture<CarouselHostComponent> => {
  const fixture = TestBed.createComponent(CarouselHostComponent);
  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<CarouselHostComponent>) => fixture.nativeElement as HTMLElement;

/**
 * The slide count comes from the scrollable's mutation observer, which reports asynchronously — so a
 * change to the slide list needs a turn of the event loop before the carousel has seen it.
 */
const settleSlides = async (fixture: ComponentFixture<CarouselHostComponent>) => {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
};

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

  it('gives every slide the slide role, and finds its slides through the scrollable', () => {
    const fixture = createHost();
    const slides = host(fixture).querySelectorAll('.et-carousel-item');

    expect(slides.length).toBe(3);
    expect(slides[0]?.getAttribute('role')).toBe('group');
    expect(slides[0]?.getAttribute('aria-roledescription')).toBe('slide');
    expect(fixture.componentInstance.carousel().count()).toBe(3);
  });

  it('renders a labelled dot per slide', async () => {
    const fixture = createHost();
    const dots = host(fixture).querySelectorAll('.et-carousel-dot');

    expect(dots.length).toBe(3);
    expect(dots[1]?.getAttribute('aria-label')).toBe('Go to slide 2');

    fixture.componentInstance.slides.set(['one', 'two']);
    await settleSlides(fixture);

    expect(host(fixture).querySelectorAll('.et-carousel-dot').length).toBe(2);
  });

  it('keeps both controls operable while looping, and marks them aria-disabled without it', () => {
    const fixture = createHost();
    const carousel = fixture.componentInstance.carousel();

    expect(carousel.canGoNext()).toBe(true);
    expect(carousel.canGoPrevious()).toBe(true);

    fixture.componentInstance.loop.set(false);
    fixture.detectChanges();

    // jsdom has no layout, so the active slide stays at the start — which is where `previous` runs out
    expect(carousel.canGoPrevious()).toBe(false);
    expect(host(fixture).querySelector('[etCarouselPrevious]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('takes localized labels from the provider', () => {
    TestBed.configureTestingModule({ providers: [provideCarouselLabels({ carousel: 'Karussell' })] });

    const fixture = createHost();

    expect(host(fixture).querySelector('et-carousel')?.getAttribute('aria-label')).toBe('Karussell');
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

  it('reports why autoplay is not running', async () => {
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
    fixture.componentInstance.slides.set(['only one']);
    await settleSlides(fixture);

    // a single slide has nowhere to advance to
    expect(autoplay.pauseReason()).toBe('no-slides');
  });

  it('takes a slide’s own autoplayTime over the carousel’s', () => {
    const fixture = createHost();
    fixture.componentInstance.autoplay.set(true);
    fixture.componentInstance.autoplayTime.set(4000);
    fixture.detectChanges();

    expect(fixture.componentInstance.autoplayDirective().duration()).toBe(4000);
  });
});
