import { AfterViewInit, Component, DestroyRef, inject, signal, ViewChild, ViewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, startWith, switchMap } from 'rxjs';
import {
  ANIMATABLE_TOKEN,
  AnimatableDirective,
  AnimationEndEvent,
  createFlipAnimation,
  forceReflow,
  nextFrame,
  TypedQueryList,
} from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-header',
  imports: [AnimatableDirective],
  template: `
    <div #body class="body" etAnimatable>
      @if (zone() === 'account') {
        <section #zone class="account" etAnimatable></section>
      }
      @if (zone() === 'shop') {
        <section #zone class="shop" etAnimatable></section>
      }
    </div>
  `,
})
class HeaderComponent implements AfterViewInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild('body', { read: ANIMATABLE_TOKEN })
  readonly body: AnimatableDirective | null = null;

  @ViewChildren('zone', { read: ANIMATABLE_TOKEN })
  readonly zones: TypedQueryList<AnimatableDirective> | null = null;

  zone = signal<'account' | 'shop' | null>('account');
  isExpanded = signal(false);
  bodyAnimating: boolean[] = [];
  zoneAnimating: boolean[] = [];
  bodyEnds: AnimationEndEvent[] = [];

  ngAfterViewInit() {
    const body = this.body;
    const zones = this.zones;

    if (!body || !zones) return;

    const bodySub = body.isAnimating$.subscribe((value) => this.bodyAnimating.push(value));
    const endSub = body.animationEnd$.subscribe((event) => this.bodyEnds.push(event));
    const zoneSub = zones.changes
      .pipe(
        startWith(zones),
        switchMap((items) => items.first?.isAnimating$ ?? of(false)),
      )
      .subscribe((value) => this.zoneAnimating.push(value));

    this.destroyRef.onDestroy(() => {
      bodySub.unsubscribe();
      endSub.unsubscribe();
      zoneSub.unsubscribe();
    });
  }

  expand() {
    nextFrame(() => this.isExpanded.set(true));
  }
}

const fire = (element: Element, type: string) => element.dispatchEvent(new Event(type));

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

const placeAt = (element: HTMLElement, value: DOMRect) => {
  element.getBoundingClientRect = () => value;
};

class FakeAnimation extends EventTarget {
  cancelled = false;

  constructor(
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions,
  ) {
    super();
  }

  cancel() {
    this.cancelled = true;
    this.dispatchEvent(new Event('cancel'));
  }

  finish() {
    this.dispatchEvent(new Event('finish'));
  }
}

const recordAnimations = (element: HTMLElement) => {
  const animations: FakeAnimation[] = [];

  element.animate = ((keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = new FakeAnimation(keyframes, options);
    animations.push(animation);

    return animation as unknown as Animation;
  }) as HTMLElement['animate'];

  return animations;
};

const stubReducedMotion = (reduce: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({ media, matches: reduce }),
  });

  return () => Reflect.deleteProperty(window, 'matchMedia');
};

describe('animation scenarios', () => {
  const scenario = useScenario();

  it('reports when a header body and its active navigation zone animate', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeaderComponent);
    const header = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    s.flush();

    const body = root.querySelector('.body') as HTMLElement;

    expect(header.bodyAnimating).toEqual([false]);
    expect(header.zoneAnimating).toEqual([false]);

    header.body?.setTransitionId('open');
    fire(body, 'transitionrun');
    fire(body, 'animationstart');
    fire(body, 'transitionend');

    expect(header.bodyAnimating).toEqual([false, true, true, true]);

    fire(body, 'animationend');
    s.tick(0);

    expect(header.bodyAnimating.at(-1)).toBe(false);
    expect(header.bodyEnds).toEqual([{ cancelled: false, transitionId: 'open' }]);
    expect(header.zoneAnimating).toEqual([false, true, true, true, false]);

    header.zone.set('shop');
    s.flush();

    const shop = root.querySelector('.shop') as HTMLElement;
    fire(shop, 'transitionrun');

    expect(header.zoneAnimating.at(-1)).toBe(true);

    fire(shop, 'transitioncancel');
    fire(body, 'transitionrun');
    fire(body, 'transitioncancel');
    s.tick(0);

    expect(header.zoneAnimating.at(-1)).toBe(false);
    expect(header.bodyEnds.at(-1)).toEqual({ cancelled: true, transitionId: undefined });

    fixture.destroy();
  });

  it('runs nextFrame work two frames later', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeaderComponent);
    const header = fixture.componentInstance;

    s.flush();
    header.expand();

    s.frame();
    expect(header.isExpanded()).toBe(false);

    s.frame();
    expect(header.isExpanded()).toBe(true);

    fixture.destroy();
  });

  it('reads layout when forcing a reflow', () => {
    scenario();
    const element = document.createElement('div');
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 120 });

    expect(forceReflow(element)).toBe(120);
    expect(forceReflow()).toBe(document.body.offsetHeight);
  });

  it('slides an active-link indicator from the previous link and reports how it ended', () => {
    scenario();
    const restore = stubReducedMotion(false);
    const previous = document.createElement('span');
    const next = document.createElement('span');
    const animations = recordAnimations(next);
    placeAt(previous, rect(0, 0, 50, 4));
    placeAt(next, rect(100, 0, 100, 4));

    try {
      const flip = createFlipAnimation({ originElement: previous, element: next });
      const events: string[] = [];
      flip.onStart$.subscribe(() => events.push('start'));
      flip.onFinish$.subscribe(() => events.push('finish'));
      flip.onCancel$.subscribe(() => events.push('cancel'));

      flip.play();

      const [first] = animations;

      expect(first?.options).toEqual(expect.objectContaining({ duration: 250, fill: 'both' }));
      expect(String(first?.keyframes[0]?.['transform']).replace(/\s+/g, ' ').trim()).toBe(
        'translate(-100px, 0px) scale(0.5, 1)',
      );

      flip.play();

      expect(first?.cancelled).toBe(true);
      expect(events).toEqual(['start', 'cancel', 'start']);

      animations[1]?.finish();

      expect(events).toEqual(['start', 'cancel', 'start', 'finish']);
      expect(animations[1]?.cancelled).toBe(true);

      flip.cancel();

      expect(events).toHaveLength(4);
    } finally {
      restore();
    }
  });

  it('jumps without motion when the user prefers reduced motion', () => {
    scenario();
    const restore = stubReducedMotion(true);
    const element = document.createElement('span');
    const animations = recordAnimations(element);

    try {
      createFlipAnimation({ element }).play();
      createFlipAnimation({ element, ignoreReducedMotion: true }).play();

      expect(animations.map((animation) => animation.options.duration)).toEqual([0, 250]);
    } finally {
      restore();
    }
  });
});
