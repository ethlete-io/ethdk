import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { fakeElementScroll } from '../testing/fake-layout';
import { CAROUSEL_IMPORTS } from './carousel.imports';
import { CarouselComponent } from './carousel.component';
import { CarouselAutoplayDirective, CarouselDirective } from './headless';

type Slide = { title: string };

@Component({
  selector: 'et-test-carousel-edge-host',
  template: `
    <et-carousel [loop]="loop()" [autoplay]="autoplay()">
      <ng-template [etCarouselSlide]="slides()" let-slide>
        <span>{{ slide.title }}</span>
      </ng-template>
    </et-carousel>
  `,
  imports: [CAROUSEL_IMPORTS],
})
class CarouselEdgeHostComponent {
  public carousel = viewChild.required(CarouselComponent, { read: CarouselDirective });
  public autoplayDirective = viewChild.required(CarouselComponent, { read: CarouselAutoplayDirective });

  public slides = signal<Slide[]>([]);
  public loop = signal(true);
  public autoplay = signal(false);
}

const settle = async (fixture: ComponentFixture<CarouselEdgeHostComponent>) => {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
};

const createHost = async (slides: Slide[], loop = true) => {
  const fixture = TestBed.createComponent(CarouselEdgeHostComponent);

  fixture.componentInstance.slides.set(slides);
  fixture.componentInstance.loop.set(loop);
  fixture.detectChanges();
  await settle(fixture);

  return fixture;
};

const element = (fixture: ComponentFixture<CarouselEdgeHostComponent>) => fixture.nativeElement as HTMLElement;

describe('CarouselDirective edge cases', () => {
  describe.each([
    { name: 'no slides', slides: [] as Slide[] },
    { name: 'one slide', slides: [{ title: 'only' }] },
  ])('with $name', ({ slides }) => {
    it.each([true, false])('cannot move in either direction with loop %s', async (loop) => {
      const scroll = fakeElementScroll();
      const fixture = await createHost(slides, loop);
      const carousel = fixture.componentInstance.carousel();

      expect(carousel.count()).toBe(slides.length);
      expect(carousel.cloneCount()).toBe(0);
      expect(carousel.isLooping()).toBe(false);
      expect(carousel.canGoNext()).toBe(false);
      expect(carousel.canGoPrevious()).toBe(false);

      carousel.next();
      carousel.previous();
      carousel.goTo(1);
      carousel.goTo(-1);
      fixture.detectChanges();

      expect(scroll.calls()).toEqual([]);
      expect(element(fixture).querySelector('[etCarouselNext]')?.getAttribute('aria-disabled')).toBe('true');
      expect(element(fixture).querySelector('[etCarouselPrevious]')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not autoplay, and says why', async () => {
      const fixture = await createHost(slides);

      fixture.componentInstance.autoplay.set(true);
      fixture.detectChanges();

      expect(fixture.componentInstance.autoplayDirective().pauseReason()).toBe('no-slides');
      expect(fixture.componentInstance.autoplayDirective().isPlaying()).toBe(false);
    });

    it('renders a dot per slide and no clones', async () => {
      const fixture = await createHost(slides);

      expect(element(fixture).querySelectorAll('.et-carousel-dot').length).toBe(slides.length);
      expect(element(fixture).querySelectorAll('.et-carousel-item').length).toBe(slides.length);
    });
  });

  it('maps no track child onto a slide while there are none', async () => {
    const fixture = await createHost([]);
    const carousel = fixture.componentInstance.carousel();

    expect(carousel.slideIndexOf(0)).toBe(-1);
    expect(carousel.currentIndex()).toBe(-1);
  });

  it('drops its clones once the slides shrink to one, and grows them back', async () => {
    fakeElementScroll();
    const fixture = await createHost([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
    const carousel = fixture.componentInstance.carousel();

    expect(carousel.cloneCount()).toBe(2);

    fixture.componentInstance.slides.set([{ title: 'a' }]);
    await settle(fixture);

    expect(carousel.cloneCount()).toBe(0);
    expect(carousel.domCount()).toBe(1);
    expect(carousel.canGoNext()).toBe(false);

    fixture.componentInstance.slides.set([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
    await settle(fixture);

    expect(carousel.cloneCount()).toBe(2);
    expect(carousel.domCount()).toBe(7);
  });

  it('ignores goTo for an index past the last slide on a looping carousel', async () => {
    const scroll = fakeElementScroll();
    const fixture = await createHost([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
    const carousel = fixture.componentInstance.carousel();
    const callsBefore = scroll.calls().length;

    carousel.goTo(3);
    carousel.goTo(-1);

    expect(scroll.calls().length).toBe(callsBefore);
  });

  it.each([Number.NaN, 1.5, Number.POSITIVE_INFINITY])('ignores goTo(%s), which names no slide', async (index) => {
    const scroll = fakeElementScroll();
    const fixture = await createHost([{ title: 'a' }, { title: 'b' }, { title: 'c' }], false);
    const carousel = fixture.componentInstance.carousel();
    const callsBefore = scroll.calls().length;
    const currentBefore = carousel.currentIndex();

    carousel.goTo(index);
    fixture.detectChanges();

    expect(scroll.calls().length).toBe(callsBefore);
    expect(carousel.currentIndex()).toBe(currentBefore);
  });

  it.each([Number.NaN, 1.5])('snaps an activeIndex of %s back to the current slide', async (index) => {
    fakeElementScroll();
    const fixture = await createHost([{ title: 'a' }, { title: 'b' }, { title: 'c' }], false);
    const carousel = fixture.componentInstance.carousel();
    const currentBefore = carousel.currentIndex();

    carousel.activeIndex.set(index);
    fixture.detectChanges();

    expect(carousel.currentIndex()).toBe(currentBefore);
    expect(carousel.activeIndex()).toBe(currentBefore);
  });
});
