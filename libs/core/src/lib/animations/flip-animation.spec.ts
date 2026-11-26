import { createFlipAnimationGroup } from './flip-animation';

const fakeAnimations = new Map<HTMLElement, { finish: () => void; cancel: () => void }>();

const createElement = () => {
  const element = document.createElement('div');

  element.animate = (() => {
    const listeners: Record<string, Set<() => void>> = { finish: new Set(), cancel: new Set() };
    const emit = (type: string) => listeners[type]?.forEach((listener) => listener());

    fakeAnimations.set(element, { finish: () => emit('finish'), cancel: () => emit('cancel') });

    return {
      cancel: () => undefined,
      addEventListener: (type: string, listener: () => void) => listeners[type]?.add(listener),
      removeEventListener: (type: string, listener: () => void) => listeners[type]?.delete(listener),
    } as unknown as Animation;
  }) as HTMLElement['animate'];

  return element as HTMLElement & { animate: HTMLElement['animate'] };
};

describe('createFlipAnimationGroup', () => {
  beforeEach(() => {
    fakeAnimations.clear();
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as typeof window.matchMedia;
  });

  it('emits onFinish$ only once every element of a replayed group has finished', () => {
    const first = createElement();
    const second = createElement();
    const group = createFlipAnimationGroup({ elements: [first, second] });

    const finished: number[] = [];
    group.onFinish$.subscribe(() => finished.push(finished.length));

    group.play();
    fakeAnimations.get(first)!.finish();
    fakeAnimations.get(second)!.finish();

    expect(finished).toHaveLength(1);

    group.play();
    fakeAnimations.get(first)!.finish();

    expect(finished).toHaveLength(1);

    fakeAnimations.get(second)!.finish();

    expect(finished).toHaveLength(2);
  });

  it('emits onStart$ once per play', () => {
    const first = createElement();
    const second = createElement();
    const group = createFlipAnimationGroup({ elements: [first, second] });

    const started: number[] = [];
    group.onStart$.subscribe(() => started.push(started.length));

    group.play();

    expect(started).toHaveLength(1);

    fakeAnimations.get(first)!.finish();
    fakeAnimations.get(second)!.finish();
    group.play();

    expect(started).toHaveLength(2);
  });

  it('reports a group with a cancelled element as cancelled once it settles', () => {
    const first = createElement();
    const second = createElement();
    const group = createFlipAnimationGroup({ elements: [first, second] });

    const cancelled: number[] = [];
    group.onCancel$.subscribe(() => cancelled.push(cancelled.length));

    group.play();
    fakeAnimations.get(first)!.cancel();

    expect(cancelled).toHaveLength(0);

    fakeAnimations.get(second)!.cancel();

    expect(cancelled).toHaveLength(1);
  });

  it('reports a mixed outcome exactly once, as a cancel', () => {
    const first = createElement();
    const second = createElement();
    const group = createFlipAnimationGroup({ elements: [first, second] });

    const events: string[] = [];
    group.onFinish$.subscribe(() => events.push('finish'));
    group.onCancel$.subscribe(() => events.push('cancel'));

    group.play();
    fakeAnimations.get(first)!.finish();
    fakeAnimations.get(second)!.cancel();

    expect(events).toEqual(['cancel']);
  });

  it('settles an empty group on play', () => {
    const group = createFlipAnimationGroup({ elements: [] });

    const events: string[] = [];
    group.onStart$.subscribe(() => events.push('start'));
    group.onFinish$.subscribe(() => events.push('finish'));

    expect(events).toEqual([]);

    group.play();

    expect(events).toEqual(['start', 'finish']);
  });
});
