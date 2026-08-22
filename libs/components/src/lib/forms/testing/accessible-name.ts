import { Component, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * The accessible name an element actually exposes: `aria-labelledby` wins when every id it names
 * resolves, otherwise `aria-label`. An attribute that resolves to nothing is not a name - the
 * browser falls back to name-from-contents and the author's string is simply lost.
 */
export const resolveAccessibleName = (element: Element) => {
  const labelledBy = element.getAttribute('aria-labelledby');
  const ids = labelledBy?.split(/\s+/).filter(Boolean) ?? [];

  if (ids.length > 0) {
    const root = element.getRootNode() as Document | ShadowRoot;
    const targets = ids.map((id) => root.querySelector(`[id="${id}"]`));

    if (targets.every((target) => target !== null)) {
      return targets.map((target) => target?.textContent?.trim() ?? '').join(' ');
    }
  }

  return element.getAttribute('aria-label');
};

/** One control under the accessible-name contract. */
export type AccessibleNameCase = {
  /** How the control is named in the test titles - use the consumer-facing selector. */
  selector: string;
  /** Everything the host template needs to render the control. */
  imports: readonly unknown[];
  /**
   * The host template. `naming` is the attribute under test, to splice into the control's opening
   * tag; the control must sit in a form field that projects **no** `<et-label>`, so the labelling
   * guard has nothing but the attribute to find.
   */
  template: (naming: string) => string;
  /** The element assistive tech reads the name from - the native input, the trigger, the editable. */
  namedElement: (host: HTMLElement) => Element | null;
  /** Values the template binds, for a control with required inputs. */
  state?: Record<string, unknown>;
};

const mount = async (
  template: string,
  imports: readonly unknown[],
  providers: readonly unknown[],
  state: Record<string, unknown>,
) => {
  const errors: unknown[] = [];

  const Host = Component({ template, imports: imports as never[] })(class {});

  Object.assign(Host.prototype, state);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      ...(providers as never[]),
      { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
    ],
  });

  const fixture = TestBed.createComponent(Host);

  fixture.detectChanges();
  await fixture.whenStable();

  return { errors, host: fixture.nativeElement as HTMLElement };
};

/**
 * Executable contract for naming a form control from the outside. Every control that registers with
 * a form field has to accept `aria-label` / `aria-labelledby` on itself, because a form field is
 * regularly labelled by something other than a projected `<et-label>` - a shared caption over a
 * filter row, a table column header, a dense toolbar.
 *
 * Two things have to be true at once, and each has failed on its own:
 *
 * 1. The attribute reaches the element that carries the control's role. Left on the wrapper it dies
 *    there - a custom element with no role is not exposed to assistive tech at all.
 * 2. The control reports `hasCustomAccessibleName`, so the field's dev-time labelling guard
 *    (ET2201) accepts the name instead of throwing at a control that *is* labelled.
 */
export const describeAccessibleNameContract = (
  cases: readonly AccessibleNameCase[],
  providers: readonly unknown[] = [],
) => {
  describe('accessible name contract', () => {
    for (const { selector, imports, template, namedElement, state = {} } of cases) {
      const named = (host: HTMLElement) => {
        const element = namedElement(host);

        if (!element) {
          throw new Error(`${selector} rendered no element that could carry an accessible name`);
        }

        return element;
      };

      it(`${selector} takes an aria-label`, async () => {
        const { errors, host } = await mount(template('aria-label="Booking reference"'), imports, providers, state);

        expect(resolveAccessibleName(named(host))).toBe('Booking reference');
        expect(errors.map(String).filter((error) => error.includes('ET2201'))).toEqual([]);
      });

      it(`${selector} takes an aria-labelledby`, async () => {
        const { errors, host } = await mount(
          `<span id="external-caption">Booking reference</span>${template('aria-labelledby="external-caption"')}`,
          imports,
          providers,
          state,
        );

        expect(resolveAccessibleName(named(host))).toContain('Booking reference');
        expect(errors.map(String).filter((error) => error.includes('ET2201'))).toEqual([]);
      });
    }
  });
};
