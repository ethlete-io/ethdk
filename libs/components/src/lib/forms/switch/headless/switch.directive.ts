import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  Renderer2,
  signal,
} from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { createComponentId } from '@ethlete/core';
import { FormCheckboxControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { FieldStateControlDirective } from '../../form-field/headless/field-state-control.directive';
import { controlTouches } from '../../../internals/touch-output';

@Directive({
  selector: '[etSwitch]',
  host: {
    role: 'switch',
    '[attr.aria-checked]': 'checked()',
    // role=switch does not support aria-checked="mixed" (ARIA treats it as false), so the
    // indeterminate/bulk-edit state is reflected for styling only - aria-checked stays boolean
    '[attr.data-indeterminate]': 'indeterminate() || null',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-readonly]': 'readonly() || null',
    '[attr.data-readonly]': 'readonly() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '(click)': 'toggle()',
    '(keydown.space)': 'handleSpaceKeydown($event)',
    '(blur)': 'touched.set(true)',
  },
})
export class SwitchDirective extends FieldStateControlDirective implements FormCheckboxControl, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = inject(Renderer2);
  public checked = model(false);

  /**
   * Bulk-edit state for a switch whose source records disagree (some on, some off), mirroring
   * checkbox's platform `indeterminate`. The committed `checked` value stays untouched while
   * indeterminate; the first user toggle resolves the flag and turns the switch on.
   */
  public indeterminate = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  /** View-only: keeps the normal look and focusability but blocks toggling (unlike `disabled`). */
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public touch = outputFromObservable(controlTouches(this.touched));
  private nativeLabelId = signal<string | null>(null);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SWITCH);

  constructor() {
    super();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    afterNextRender(() => this.connectNativeLabel());

    this.syncOwnedAttribute('aria-label', () => this.ariaLabel() || null);
    this.syncOwnedAttribute(
      'aria-labelledby',
      () => this.labelId() || (this.ariaLabel() ? null : this.nativeLabelId()),
    );
  }

  /** @internal */
  public handleSpaceKeydown(event: Event) {
    event.preventDefault();

    if (!(event as KeyboardEvent).repeat) this.toggle();
  }

  public toggle() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    if (this.indeterminate()) {
      this.indeterminate.set(false);
      this.checked.set(true);

      return;
    }

    this.checked.update((value) => !value);
  }

  public activate() {
    if (this.disabled()) return;

    // readonly stays focusable (view-only), it just cannot toggle
    this.toggle();
    this.focus({ focusVisible: false });
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) return;

    this.el.nativeElement.focus(options);
  }

  /** A host binding would remove a consumer's `[attr.aria-*]` binding whenever ours is null. */
  private syncOwnedAttribute(name: string, value: () => string | null) {
    let owned = false;

    afterRenderEffect({
      write: () => {
        const next = value();
        const host = this.el.nativeElement;

        if (next) {
          this.renderer.setAttribute(host, name, next);
          owned = true;
        } else if (owned) {
          this.renderer.removeAttribute(host, name);
          owned = false;
        }
      },
    });
  }

  private connectNativeLabel() {
    const host = this.el.nativeElement;
    // eslint-disable-next-line ethlete/no-dom-query -- a native <label> has no directive to inject
    const wrapping = host.closest('label');
    const linked = host.id
      ? // eslint-disable-next-line ethlete/no-dom-query -- a native <label for> has no directive to inject
        Array.from(host.ownerDocument.getElementsByTagName('label')).find((l) => l.htmlFor === host.id)
      : null;
    const label = wrapping ?? linked;

    // A label that already names a native control (an input inside it) is that control's, not ours.
    if (!label || label.control) return;

    if (!label.id) this.renderer.setAttribute(label, 'id', createComponentId('et-switch-native-label'));

    this.nativeLabelId.set(label.id);

    const unlisten = this.renderer.listen(label, 'click', (event: MouseEvent) => {
      if (host.contains(event.target as Node)) return;

      this.activate();
    });

    this.destroyRef.onDestroy(unlisten);
  }
}
