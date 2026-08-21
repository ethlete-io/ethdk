import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TEST_COLOR_THEMES } from './color-themes';
import { directiveAt, hostDirective, hostElement, resetOverlays, tick } from './driver-core';

export const mountControl = <T>(component: Type<T>, providers: Provider[] = []) => {
  resetOverlays();

  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES), ...providers] });

  const fixture = TestBed.createComponent(component);

  fixture.detectChanges();

  return fixture;
};

export type ControlDriverOptions = {
  /** Matches the element carrying the directive, when the host template nests it. */
  directiveSelector?: string;
};

/** The host, the directive under test, and queries scoped to the fixture - what every driver needs. */
export const createControlDriver = <T, D>(
  fixture: ComponentFixture<T>,
  directiveType: Type<D>,
  { directiveSelector }: ControlDriverOptions = {},
) => {
  const control = directiveSelector
    ? directiveAt(fixture, directiveType, directiveSelector)
    : hostDirective(fixture, directiveType);

  const root = fixture.nativeElement as HTMLElement;

  const query = <E extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<E>(selector);
  const queryAll = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(root.querySelectorAll<E>(selector));

  return {
    fixture,
    host: fixture.componentInstance,
    control,
    detectChanges: () => fixture.detectChanges(),
    tick,

    element: () => hostElement(fixture),
    directive: <X>(type: Type<X>, selector?: string) =>
      selector ? directiveAt(fixture, type, selector) : hostDirective(fixture, type),
    query,
    queryAll,
    text: (selector: string) => query(selector)?.textContent?.trim() ?? null,

    click: (element: HTMLElement) => {
      element.click();
      tick();
    },
  };
};
