import { Component, ErrorHandler, signal } from '@angular/core';
import '../../../test-helpers';
import { FLOATING_ACTION_ERROR_CODES } from '../floating-action-errors';
import { FLOATING_ACTION_IMPORTS } from '../floating-action.imports';
import { FLOATING_ACTION_STATES } from '../floating-action.types';
import { mountFloatingAction } from '../testing/floating-action-driver';

@Component({
  template: `
    <div [disabled]="disabled()" etFloatingAction>
      <div etFloatingActionAnchor>
        <button etFloatingActionTrigger>Filter</button>
      </div>
      @if (withScope()) {
        <ul etFloatingActionScope>
          <li>Result</li>
        </ul>
      }
    </div>
  `,
  imports: [FLOATING_ACTION_IMPORTS],
})
class FloatingActionTestHost {
  disabled = signal(false);
  withScope = signal(true);
}

@Component({
  template: `
    <div etFloatingAction>
      <div etFloatingActionAnchor>
        <button etFloatingActionTrigger>Filter</button>
      </div>
      <h2 etFloatingActionTop>Results</h2>
    </div>
  `,
  imports: [FLOATING_ACTION_IMPORTS],
})
class FloatingActionWithTopTestHost {}

@Component({
  template: `<div etFloatingAction><button etFloatingActionTrigger>Filter</button></div>`,
  imports: [FLOATING_ACTION_IMPORTS],
})
class FloatingActionMissingAnchorTestHost {}

describe('FloatingActionDirective', () => {
  it('starts inline while the anchor is on screen', async () => {
    const driver = await mountFloatingAction(FloatingActionTestHost);

    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.INLINE);
    expect(driver.floatingAction.isFloating()).toBe(false);
  });

  it('floats once the anchor has scrolled above the viewport', async () => {
    const driver = await mountFloatingAction(FloatingActionTestHost);

    driver.scrollAnchorAbove();

    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.FLOATING);
    expect(driver.floatingAction.isFloating()).toBe(true);
  });

  it('hides once the scope has scrolled above the viewport too', async () => {
    const driver = await mountFloatingAction(FloatingActionTestHost);

    driver.scrollAnchorAbove();
    driver.scrollScopeAbove();

    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.HIDDEN);
  });

  it('returns to inline once the anchor scrolls back into view', async () => {
    const driver = await mountFloatingAction(FloatingActionTestHost);

    driver.scrollAnchorAbove();
    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.FLOATING);

    driver.scrollAnchorIntoView();
    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.INLINE);
  });

  it('keeps floating for the rest of the page when there is no scope to bound it', async () => {
    const driver = await mountFloatingAction(FloatingActionTestHost);

    driver.host.withScope.set(false);
    driver.detectChanges();
    driver.scrollAnchorAbove();

    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.FLOATING);
  });

  it('stays inline while disabled, whatever the scroll position', async () => {
    const driver = await mountFloatingAction(FloatingActionTestHost);

    driver.host.disabled.set(true);
    driver.detectChanges();
    driver.scrollAnchorAbove();
    driver.scrollScopeAbove();

    expect(driver.floatingAction.state()).toBe(FLOATING_ACTION_STATES.INLINE);
  });

  describe('scrollToTop', () => {
    let scrollIntoView: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      scrollIntoView = vi.fn();

      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
        writable: true,
      });
    });

    it('targets its own element without an etFloatingActionTop', async () => {
      const driver = await mountFloatingAction(FloatingActionTestHost);

      driver.floatingAction.scrollToTop();

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(driver.element());
    });

    it('targets the etFloatingActionTop element when there is one', async () => {
      const driver = await mountFloatingAction(FloatingActionWithTopTestHost);

      driver.floatingAction.scrollToTop();

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(driver.topEl());
    });
  });

  it('throws in dev mode when there is no anchor to tell it when it has scrolled away', async () => {
    const errors: unknown[] = [];

    const driver = await mountFloatingAction(FloatingActionMissingAnchorTestHost, {}, [
      { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
    ]);

    await driver.fixture.whenStable();

    expect(errors).toEqual([expect.objectContaining({ code: FLOATING_ACTION_ERROR_CODES.MISSING_ANCHOR })]);
  });
});
