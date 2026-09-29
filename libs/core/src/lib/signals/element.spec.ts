import { ElementRef, Injector, QueryList, Signal, computed, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import {
  ElementSignalValue,
  SignalElementBindingComplexType,
  buildElementSignal,
  createEmptyElementSignal,
  firstElementSignal,
  isElementSignal,
} from './element';

describe('element signals', () => {
  let injector: Injector;
  let a: HTMLElement;
  let b: HTMLElement;

  const build = (...args: Parameters<typeof buildElementSignal>) =>
    runInInjectionContext(injector, () => buildElementSignal(...args));

  beforeEach(() => {
    injector = TestBed.inject(Injector);
    a = document.createElement('div');
    b = document.createElement('span');
  });

  afterEach(() => vi.restoreAllMocks());

  describe('buildElementSignal', () => {
    it('is empty for null and undefined', () => {
      expect(build(null)()).toEqual({ currentElements: [], previousElements: [] });
      expect(build(undefined)()).toEqual({ currentElements: [], previousElements: [] });
    });

    it('wraps an HTMLElement', () => {
      expect(build(a)()).toEqual({ currentElements: [a], previousElements: [] });
    });

    it('unwraps an ElementRef', () => {
      expect(build(new ElementRef(a))()).toEqual({ currentElements: [a], previousElements: [] });
    });

    it('is empty for an ElementRef without a native element', () => {
      expect(build(new ElementRef(null as unknown as HTMLElement))()).toEqual({
        currentElements: [],
        previousElements: [],
      });
    });

    describe('from a signal', () => {
      const queryList = () => {
        const list = new QueryList<HTMLElement | ElementRef<HTMLElement>>();
        list.reset([new ElementRef(a), b]);
        return list;
      };

      const cases: [string, () => SignalElementBindingComplexType, () => HTMLElement[]][] = [
        ['an element', () => a, () => [a]],
        ['an ElementRef', () => new ElementRef(a), () => [a]],
        ['an array of elements and ElementRefs', () => [a, new ElementRef(b)], () => [a, b]],
        ['a QueryList', queryList, () => [a, b]],
        ['null', () => null, () => []],
        ['undefined', () => undefined, () => []],
        ['an empty array', () => [], () => []],
      ];

      for (const [name, value, expected] of cases) {
        it(`coerces ${name}`, () => {
          const source = signal<SignalElementBindingComplexType>(value());

          expect(build(source)().currentElements).toEqual(expected());
        });
      }

      it('tracks the previous elements across changes', () => {
        const source = signal<SignalElementBindingComplexType>(a);
        const result = build(source);
        result();

        source.set(b);

        expect(result()).toEqual({ currentElements: [b], previousElements: [a] });

        source.set(null);

        expect(result()).toEqual({ currentElements: [], previousElements: [b] });
      });

      it('does not emit again for an equivalent value', () => {
        const source = signal<SignalElementBindingComplexType>([a, b]);
        const result = build(source);
        result();
        source.set([a, b]);
        const first = result();

        source.set([a, b]);

        expect(result()).toBe(first);
      });

      it('passes an element signal value through unchanged', () => {
        const value: ElementSignalValue = { currentElements: [a], previousElements: [b] };
        const source = signal<SignalElementBindingComplexType>(value as unknown as SignalElementBindingComplexType);

        expect(build(source)()).toBe(value);
      });

      it('passes an existing element signal through unchanged', () => {
        const source = signal<ElementSignalValue>({ currentElements: [a], previousElements: [b] });
        const result = build(source as unknown as Signal<SignalElementBindingComplexType>);

        source.set({ currentElements: [b], previousElements: [a] });

        expect(result()).toEqual({ currentElements: [b], previousElements: [a] });
      });

      it('is a fresh signal when computed from other signals', () => {
        const visible = signal(true);
        const source = computed<SignalElementBindingComplexType>(() => (visible() ? a : null));
        const result = build(source);
        result();

        visible.set(false);

        expect(result()).toEqual({ currentElements: [], previousElements: [a] });
      });
    });

    describe('from an observable', () => {
      it('starts empty and follows emissions with previous elements', () => {
        const source$ = new BehaviorSubject<SignalElementBindingComplexType>(null);
        const result = build(source$);

        expect(result()).toEqual({ currentElements: [], previousElements: [] });

        source$.next(a);

        expect(result()).toEqual({ currentElements: [a], previousElements: [] });

        source$.next([new ElementRef(b)]);

        expect(result()).toEqual({ currentElements: [b], previousElements: [a] });
      });

      it('coerces a synchronously emitting observable', () => {
        expect(build(of(new ElementRef(a)))()).toEqual({ currentElements: [a], previousElements: [] });
      });

      it('logs an error for a non-HTMLElement value', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const component = { not: 'an element' } as unknown as HTMLElement;

        build(of(component));

        expect(error).toHaveBeenCalledTimes(1);
      });
    });

    describe('from a QueryList', () => {
      it('starts with the current items and follows changes', () => {
        const list = new QueryList<ElementRef<HTMLElement> | HTMLElement>();
        list.reset([a]);
        const result = build(list);

        expect(result().currentElements).toEqual([a]);

        list.reset([new ElementRef(b), a]);
        list.notifyOnChanges();

        expect(result()).toEqual({ currentElements: [b, a], previousElements: [a] });
      });
    });
  });

  describe('firstElementSignal', () => {
    it('is null for an empty binding', () => {
      const first = firstElementSignal(createEmptyElementSignal());

      expect(first()).toEqual({ currentElement: null, previousElement: null });
    });

    it('resolves the first current and first previous element', () => {
      const source = signal<SignalElementBindingComplexType>([a, b]);
      const first = runInInjectionContext(injector, () => firstElementSignal(buildElementSignal(source)));

      first();
      source.set([b, a]);

      expect(first()).toEqual({ currentElement: b, previousElement: a });
    });

    it('warns when more than one element is bound', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const first = firstElementSignal(buildElementSignal(signal([a, b])));

      first();

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('keeps its identity when the first elements did not change', () => {
      const source = signal<SignalElementBindingComplexType>([a, b]);
      const first = runInInjectionContext(injector, () => firstElementSignal(buildElementSignal(source)));
      first();
      source.set([a, b]);
      const before = first();

      source.set([a]);

      expect(first()).toBe(before);
    });
  });

  describe('isElementSignal', () => {
    it('accepts an element signal', () => {
      expect(isElementSignal(createEmptyElementSignal())).toBe(true);
    });

    it('rejects plain values, other signals and throwing signals', () => {
      expect(isElementSignal(null)).toBe(false);
      expect(isElementSignal(a)).toBe(false);
      expect(isElementSignal(signal(a))).toBe(false);
      expect(isElementSignal(signal(null))).toBe(false);
      expect(
        isElementSignal(
          computed(() => {
            throw new Error('boom');
          }),
        ),
      ).toBe(false);
    });
  });
});
