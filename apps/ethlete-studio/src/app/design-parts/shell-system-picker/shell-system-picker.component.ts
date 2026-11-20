import { Component, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-shell-system-picker',
  template: `
    <div
      [open]="open()"
      [offset]="{ mainAxis: 12, crossAxis: 0 }"
      (openChange)="open.set($event)"
      class="flex min-w-0"
      etMenu
      arrow="false"
      placement="bottom-start"
    >
      <button
        class="h-control-md min-w-0 items-center justify-start gap-space-2 px-space-2 py-0 text-left"
        etMenuTrigger
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
      >
        <span class="min-w-0 overflow-hidden font-ui-strong text-ui-lg text-ellipsis whitespace-nowrap">{{
          product()
        }}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m5.5 6 2.5-2.5 2.5 2.5" />
          <path d="m5.5 10 2.5 2.5 2.5-2.5" />
        </svg>
      </button>
      <ng-template etMenuSurface>
        <div class="box-border w-58 [transform:translate3d(0,0,0)] shadow-[0_12px_32px_var(--surface-shadow)]">
          <et-menu class="box-border w-58 text-ui-md">
            <et-menu-radio-group [value]="product()" (valueChange)="selectProduct($event)">
              <et-menu-group-label>{{ LABELS.designSystem }}</et-menu-group-label>
              @for (name of products(); track name) {
                <et-menu-radio-item [value]="name" closeOnActivate>{{ name }}</et-menu-radio-item>
              }
            </et-menu-radio-group>
          </et-menu>
        </div>
      </ng-template>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS],
})
export class ShellSystemPickerComponent {
  public product = input('studio');
  public products = input<string[]>([]);
  public open = model(false);
  public productChange = output<string>();

  protected readonly LABELS = STUDIO_LABELS.shell;

  protected selectProduct(value: unknown) {
    if (typeof value === 'string' && value !== this.product()) this.productChange.emit(value);
  }
}
