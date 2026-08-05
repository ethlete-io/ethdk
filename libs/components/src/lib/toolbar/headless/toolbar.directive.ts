import { DOCUMENT } from '@angular/common';
import { afterEveryRender, Directive, ElementRef, inject, input } from '@angular/core';
import { TOOLBAR_ORIENTATIONS, ToolbarOrientation } from './toolbar.types';

const CONTROL_SELECTOR = 'button, [href], input, select, textarea';
const TOOLBAR_SELECTOR = '[role="toolbar"]';

/**
 * Turns its host into an ARIA toolbar: a single tab stop that Tab enters and leaves, with the arrow
 * keys moving focus between the controls inside it. `Home`/`End` jump to the first/last control and
 * arrow navigation wraps around; in a horizontal toolbar the left/right keys follow the writing
 * direction.
 *
 * Every focusable control rendered inside the host is a toolbar control - projected content,
 * `@for` output and components that own their own button templates included - so nothing has to be
 * marked up per item. Natively disabled controls are skipped; controls belonging to a nested
 * toolbar stay with that toolbar.
 *
 * Pair it with an accessible name (`aria-label`, or `aria-labelledby` pointing at a visible
 * heading), which is what tells the user what the toolbar is for.
 *
 * @example
 * <div [attr.aria-label]="'Text formatting'" etToolbar>
 *   <button et-icon-button type="button">…</button>
 *   <button et-icon-button type="button">…</button>
 * </div>
 */
@Directive({
  selector: '[etToolbar]',
  host: {
    role: 'toolbar',
    '[attr.aria-orientation]': 'orientation()',
    '(keydown)': 'handleKeydown($event)',
    '(focusin)': 'handleFocusIn($event)',
  },
})
export class ToolbarDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);

  public orientation = input<ToolbarOrientation>(TOOLBAR_ORIENTATIONS.HORIZONTAL);

  private tabStop: HTMLElement | null = null;

  constructor() {
    afterEveryRender(() => this.syncTabStops());
  }

  /** Moves focus to the toolbar's first control, the tab stop a fresh Tab would land on. */
  public focusFirst() {
    this.focusableControls()[0]?.focus();
  }

  protected handleKeydown(event: KeyboardEvent) {
    const horizontal = this.orientation() === TOOLBAR_ORIENTATIONS.HORIZONTAL;
    const rtl = horizontal && getComputedStyle(this.elementRef.nativeElement).direction === 'rtl';
    const nextKey = horizontal ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
    const previousKey = horizontal ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';

    let target: HTMLElement | undefined;
    const controls = this.focusableControls();

    if (!controls.length) return;

    const current = controls.indexOf(this.document.activeElement as HTMLElement);

    switch (event.key) {
      case nextKey:
        target = controls[(current + 1) % controls.length];
        break;
      case previousKey:
        target = controls[current <= 0 ? controls.length - 1 : current - 1];
        break;
      case 'Home':
        target = controls[0];
        break;
      case 'End':
        target = controls[controls.length - 1];
        break;
      default:
        return;
    }

    if (!target) return;

    event.preventDefault();
    target.focus();
  }

  /** The last focused control keeps the tab stop, so Shift+Tab back re-enters where the user left. */
  protected handleFocusIn(event: FocusEvent) {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !this.focusableControls().includes(target)) return;

    this.tabStop = target;
    this.syncTabStops();
  }

  /** Every control this toolbar owns. Disabled ones are included: they must lose their tab stop too,
   *  or re-enabling one would leave the toolbar with two. */
  private controls() {
    const host = this.elementRef.nativeElement;

    // eslint-disable-next-line ethlete/no-dom-query -- any focusable descendant is a toolbar control, including those inside components that own their own button templates, which no directive token could reach
    const found = Array.from(host.querySelectorAll<HTMLElement>(`${CONTROL_SELECTOR}, ${TOOLBAR_SELECTOR}`));
    const nested = found.filter((element) => element.matches(TOOLBAR_SELECTOR));

    return found.filter((control) => !nested.includes(control) && !nested.some((toolbar) => toolbar.contains(control)));
  }

  private focusableControls() {
    return this.controls().filter((control) => !(control as HTMLElement & { disabled?: boolean }).disabled);
  }

  private syncTabStops() {
    const focusable = this.focusableControls();

    if (!this.tabStop || !focusable.includes(this.tabStop)) {
      this.tabStop = focusable[0] ?? null;
    }

    for (const control of this.controls()) {
      const tabIndex = control === this.tabStop ? 0 : -1;

      // written imperatively rather than as a binding: the controls are arbitrary projected content,
      // so only touch the DOM when the value changed to keep the per-render pass free
      if (control.tabIndex !== tabIndex) control.tabIndex = tabIndex;
    }
  }
}
