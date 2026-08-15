import { Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';

/**
 * A write-only field for an API token.
 *
 * The stored value is never read back into the window — the field starts empty however long a token has
 * been configured, and `connected` is all the app asks the keychain. So the only thing this can do is
 * replace a token or remove it, which is also all a settings screen needs to do.
 */
@Component({
  selector: 'ethlete-token-field',
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
        <et-input
          [(value)]="typed"
          [aria-label]="'API token for ' + provider()"
          [placeholder]="connected() ? 'Replace the stored token' : 'Paste the token'"
          type="password"
        />
      </et-form-field>

      <button [disabled]="!typed().trim()" (click)="store()" et-button variant="filled" size="sm">Save</button>

      @if (connected()) {
        <button (click)="forget.emit()" et-button variant="transparent" size="sm">{{ forgetLabel() }}</button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class TokenFieldComponent {
  public provider = input.required<string>();
  public connected = input(false);
  public forgetLabel = input('Disconnect');

  public save = output<string>();
  public forget = output<void>();

  protected typed = signal('');

  protected store() {
    this.save.emit(this.typed().trim());
    this.typed.set('');
  }
}
