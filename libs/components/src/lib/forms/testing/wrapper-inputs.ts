import { Component, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

export type WrapperUnderTest = {
  /** The wrapper's element selector, e.g. `et-input`. */
  selector: string;
  component: Type<unknown>;
};

/**
 * Asserts that a wrapper component re-exposes every input of the base directive it wraps: mounts
 * `<wrapper.selector>` with all of `base` bound at once and requires it to render. A name the
 * wrapper dropped from its `hostDirectives` inputs list is not a type error - it is an
 * unknown-property error (NG0303) the first time a consumer binds it, which is what this catches.
 *
 * Pass the base's exported input-name list (e.g. `TEXT_FIELD_CONTROL_INPUTS`), never a copy.
 */
export const expectWrapperExposesBaseInputs = (wrapper: WrapperUnderTest, base: readonly string[]) => {
  expect(base.length, 'the base input list is empty - there is nothing to assert').toBeGreaterThan(0);

  const bindings = base.map((name) => `[${name}]="v"`).join(' ');

  const Host = Component({
    template: `<${wrapper.selector} ${bindings} />`,
    imports: [wrapper.component],
  })(
    class {
      v = null;
    },
  );

  // without `errorOnUnknownProperties` TestBed downgrades NG0303 to a console warning and this
  // assertion can never fail
  TestBed.configureTestingModule({ imports: [Host], errorOnUnknownProperties: true });

  const fixture = TestBed.createComponent(Host);

  let thrown: Error | null = null;

  try {
    fixture.detectChanges();
  } catch (error) {
    thrown = error as Error;
  }

  expect(thrown?.message ?? null, `<${wrapper.selector}> must expose every input of its base directive`).toBeNull();
};
