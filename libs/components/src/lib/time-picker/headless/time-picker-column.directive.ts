import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { createTypeahead } from '../../internals/typeahead';
import { TIME_PICKER_ERROR_CODES } from '../time-picker-errors';
import { TimePickerColumn, TimePickerDirective } from './time-picker.directive';

/**
 * One unit column (a vertical listbox): routes the keyboard model to the
 * picker - arrows move the selection (selection follows focus, wrapping),
 * typed characters jump to the matching option - and tracks whether focus is
 * inside (options only pull DOM focus along while the user is actually
 * keyboard-navigating the column).
 */
@Directive({
  selector: '[etTimePickerColumn]',
  exportAs: 'etTimePickerColumn',
  host: {
    role: 'listbox',
    'aria-orientation': 'vertical',
    '[attr.aria-label]': 'column().label',
    '(keydown)': 'handleKeydown($event)',
    '(focusin)': 'focusIsInside.set(true)',
    '(focusout)': 'handleFocusOut($event)',
  },
})
export class TimePickerColumnDirective {
  private timePicker = inject(TimePickerDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  public column = input.required<TimePickerColumn>();

  /** @internal */
  public focusIsInside = signal(false);

  private typeahead = createTypeahead();
  private hasScrolled = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.typeahead.destroy());

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.timePicker) {
          throw new RuntimeError(
            TIME_PICKER_ERROR_CODES.COLUMN_OUTSIDE_TIME_PICKER,
            'An [etTimePickerColumn] must be placed inside an [etTimePicker].',
          );
        }
      });
    }
  }

  protected handleKeydown(event: KeyboardEvent) {
    const timePicker = this.timePicker;

    if (!timePicker) {
      return;
    }

    const unit = this.column().unit;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        timePicker.selectRelative(unit, 1);

        return;
      case 'ArrowUp':
        event.preventDefault();
        timePicker.selectRelative(unit, -1);

        return;
      case 'Home':
        event.preventDefault();
        timePicker.selectEdge(unit, 'start');

        return;
      case 'End':
        event.preventDefault();
        timePicker.selectEdge(unit, 'end');

        return;
    }

    if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      timePicker.selectByQuery(unit, this.typeahead.append(event.key));
    }
  }

  protected handleFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    // the focused option can be removed mid-interaction (an off-step selection
    // leaving the list) with focus falling to body before the roving target pulls
    // it back - settle the tick first, then decide based on where focus ended up
    queueMicrotask(() => {
      const element = this.elementRef.nativeElement;
      const active = element.ownerDocument.activeElement;

      if (!(active instanceof Node) || !element.contains(active)) {
        this.focusIsInside.set(false);
        this.typeahead.reset();
      }
    });
  }

  /**
   * @internal Centers an option in the column's scrollport - instantly on the
   * first (mount) call, smoothly afterwards. Deliberately not `scrollIntoView`,
   * which would also scroll ancestors (the page, an overlay pane).
   */
  public scrollOptionIntoView(optionElement: HTMLElement) {
    const columnElement = this.elementRef.nativeElement;
    const columnRect = columnElement.getBoundingClientRect();
    const optionRect = optionElement.getBoundingClientRect();
    const optionTop = optionRect.top - columnRect.top + columnElement.scrollTop;
    const top = optionTop - (columnElement.clientHeight - optionRect.height) / 2;
    const behavior: ScrollBehavior = this.hasScrolled ? 'smooth' : 'auto';

    this.hasScrolled = true;
    columnElement.scrollTo?.({ top, behavior });
  }
}
