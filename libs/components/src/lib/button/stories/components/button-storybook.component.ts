import { booleanAttribute, ChangeDetectionStrategy, Component, input, signal, ViewEncapsulation } from '@angular/core';
import {
  ARROW_OUT_UP_RIGHT_ICON,
  ARROW_RIGHT_ICON,
  CLIPBOARD_CHECK_ICON,
  FLOPPY_DISK_ICON,
  FOCUS_FRAME_ICON,
  GRID_2X2_ICON,
  ICON_IMPORTS,
  PENCIL_ICON,
  PLUS_ICON,
  provideIcons,
  TIMES_ICON,
} from '../../../icon';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../../button.component';
import { BUTTON_IMPORTS } from '../../button.imports';
import { WINDOW_CONTROL_BUTTON_KINDS, WINDOW_CONTROL_BUTTON_SIZES } from '../../window-control-button.component';

const BUTTON_EXAMPLES = [
  {
    size: BUTTON_SIZES.XL,
    label: 'Continue to checkout',
    iconName: 'et-arrow-right',
    fabIconName: 'et-plus',
    fabLabel: 'Create project',
    iconLabel: 'Continue to checkout',
  },
  {
    size: BUTTON_SIZES.LG,
    label: 'Review order',
    iconName: 'et-clipboard-check',
    fabIconName: 'et-plus',
    fabLabel: 'Create issue',
    iconLabel: 'Review order',
  },
  {
    size: BUTTON_SIZES.MD,
    label: 'Save changes',
    iconName: 'et-floppy-disk',
    fabIconName: 'et-plus',
    fabLabel: 'Create post',
    iconLabel: 'Save changes',
  },
  {
    size: BUTTON_SIZES.SM,
    label: 'Save',
    iconName: 'et-floppy-disk',
    fabIconName: 'et-plus',
    fabLabel: 'New note',
    iconLabel: 'Save note',
  },
  {
    size: BUTTON_SIZES.XS,
    label: 'Edit',
    iconName: 'et-pencil',
    fabIconName: 'et-plus',
    fabLabel: 'New',
    iconLabel: 'Edit item',
  },
] as const;

const SURFACE_VARIANTS = [
  BUTTON_VARIANTS.FILLED,
  BUTTON_VARIANTS.OUTLINE,
  BUTTON_VARIANTS.TONAL,
  BUTTON_VARIANTS.TRANSPARENT,
] as const;

const ICON_ALIGNMENTS = ['start', 'end'] as const;

const WINDOW_CONTROL_BUTTON_EXAMPLES = [
  {
    size: WINDOW_CONTROL_BUTTON_SIZES.LG,
    iconName: 'et-arrow-out-up-right',
    label: 'Return to page',
  },
  {
    size: WINDOW_CONTROL_BUTTON_SIZES.MD,
    iconName: 'et-grid-2x2',
    label: 'Grid view',
  },
  {
    size: WINDOW_CONTROL_BUTTON_SIZES.SM,
    iconName: 'et-focus-frame',
    label: 'Focused view',
  },
] as const;

@Component({
  selector: 'et-sb-button-text',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-3">
        @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
          <button
            [size]="buttonExample.size"
            [color]="color()"
            [disabled]="disabled()"
            [loading]="loading()"
            et-text-button
            type="button"
          >
            {{ buttonExample.label }}
          </button>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS],
})
export class ButtonTextStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });

  public readonly BUTTON_EXAMPLES = BUTTON_EXAMPLES;
}

@Component({
  selector: 'et-sb-button-surface',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of VARIANTS; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
              <button
                [variant]="variant"
                [size]="buttonExample.size"
                [color]="color()"
                [disabled]="disabled()"
                [loading]="loading()"
                [pressed]="pressed()"
                et-button
                type="button"
              >
                {{ buttonExample.label }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS],
})
export class ButtonSurfaceStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });
  public pressed = input(false, { transform: booleanAttribute });

  public readonly VARIANTS = SURFACE_VARIANTS;
  public readonly BUTTON_EXAMPLES = BUTTON_EXAMPLES;
}

@Component({
  selector: 'et-sb-button-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of VARIANTS; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
              <button
                [variant]="variant"
                [size]="buttonExample.size"
                [color]="color()"
                [disabled]="disabled()"
                [loading]="loading()"
                [pressed]="pressed()"
                [attr.aria-label]="buttonExample.iconLabel"
                et-icon-button
                type="button"
              >
                <i [etIcon]="buttonExample.iconName"></i>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(ARROW_RIGHT_ICON, CLIPBOARD_CHECK_ICON, FLOPPY_DISK_ICON, PENCIL_ICON, PLUS_ICON)],
})
export class ButtonIconStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });
  public pressed = input(false, { transform: booleanAttribute });

  public readonly VARIANTS = SURFACE_VARIANTS;
  public readonly BUTTON_EXAMPLES = BUTTON_EXAMPLES;
}

@Component({
  selector: 'et-sb-button-fab',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of VARIANTS; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
              <button
                [variant]="variant"
                [size]="buttonExample.size"
                [color]="color()"
                [disabled]="disabled()"
                [loading]="loading()"
                [attr.aria-label]="buttonExample.iconLabel"
                et-fab
                type="button"
              >
                <i [etIcon]="buttonExample.fabIconName"></i>
              </button>
            }
          </div>
        </div>
      }

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">fab extended (click to toggle)</p>
        <div class="flex flex-wrap items-center gap-3">
          @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
            <button
              [size]="buttonExample.size"
              [color]="color()"
              [disabled]="disabled()"
              [loading]="loading()"
              [expanded]="expandedSize() === buttonExample.size"
              (click)="toggleExpanded(buttonExample.size)"
              et-fab
              type="button"
            >
              <i [etIcon]="buttonExample.fabIconName"></i>
              {{ buttonExample.fabLabel }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(ARROW_RIGHT_ICON, CLIPBOARD_CHECK_ICON, FLOPPY_DISK_ICON, PENCIL_ICON, PLUS_ICON)],
})
export class ButtonFabStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });

  public readonly VARIANTS = SURFACE_VARIANTS;
  public readonly BUTTON_EXAMPLES = BUTTON_EXAMPLES;

  public expandedSize = signal<string | null>(null);

  public toggleExpanded(size: string) {
    this.expandedSize.update((current) => (current === size ? null : size));
  }
}

@Component({
  selector: 'et-sb-button-window-control',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">default</p>
        <div class="flex flex-wrap items-center gap-3">
          @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.label) {
            <button
              [size]="buttonExample.size"
              [color]="color()"
              [disabled]="disabled()"
              [loading]="loading()"
              [pressed]="pressed()"
              [attr.aria-label]="buttonExample.label"
              et-window-control-button
              type="button"
            >
              <i [etIcon]="buttonExample.iconName"></i>
            </button>
          }
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">close</p>
        <div class="flex flex-wrap items-center gap-3">
          @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
            <button
              [size]="buttonExample.size"
              [kind]="CLOSE_KIND"
              [color]="color()"
              [disabled]="disabled()"
              [loading]="loading()"
              [pressed]="pressed()"
              [attr.aria-label]="'Close'"
              et-window-control-button
              type="button"
            >
              <i etIcon="et-times"></i>
            </button>
          }
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(ARROW_OUT_UP_RIGHT_ICON, FOCUS_FRAME_ICON, GRID_2X2_ICON, TIMES_ICON)],
})
export class ButtonWindowControlStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });
  public pressed = input(false, { transform: booleanAttribute });

  public readonly BUTTON_EXAMPLES = WINDOW_CONTROL_BUTTON_EXAMPLES;
  public readonly CLOSE_KIND = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;
}

@Component({
  selector: 'et-sb-button-surface-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of VARIANTS; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          @for (iconAlignment of ICON_ALIGNMENTS; track iconAlignment) {
            <div class="flex flex-col gap-2">
              <p class="m-0 text-[10px] font-semibold uppercase tracking-widest opacity-60">{{ iconAlignment }}</p>
              <div class="flex flex-wrap items-center gap-3">
                @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
                  <button
                    [variant]="variant"
                    [size]="buttonExample.size"
                    [color]="color()"
                    [disabled]="disabled()"
                    [loading]="loading()"
                    [iconAlignment]="iconAlignment"
                    et-button
                    type="button"
                  >
                    <i [etIcon]="buttonExample.iconName"></i>
                    {{ buttonExample.label }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(ARROW_RIGHT_ICON, CLIPBOARD_CHECK_ICON, FLOPPY_DISK_ICON, PENCIL_ICON, PLUS_ICON)],
})
export class ButtonSurfaceIconStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });

  public readonly VARIANTS = SURFACE_VARIANTS;
  public readonly BUTTON_EXAMPLES = BUTTON_EXAMPLES;
  public readonly ICON_ALIGNMENTS = ICON_ALIGNMENTS;
}

@Component({
  selector: 'et-sb-button-text-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (iconAlignment of ICON_ALIGNMENTS; track iconAlignment) {
        <div class="flex flex-col gap-2">
          <p class="m-0 text-[10px] font-semibold uppercase tracking-widest opacity-60">{{ iconAlignment }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (buttonExample of BUTTON_EXAMPLES; track buttonExample.size) {
              <button
                [size]="buttonExample.size"
                [color]="color()"
                [disabled]="disabled()"
                [loading]="loading()"
                [iconAlignment]="iconAlignment"
                et-text-button
                type="button"
              >
                <i [etIcon]="buttonExample.iconName"></i>
                {{ buttonExample.label }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(ARROW_RIGHT_ICON, CLIPBOARD_CHECK_ICON, FLOPPY_DISK_ICON, PENCIL_ICON, PLUS_ICON)],
})
export class ButtonTextIconStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });

  public readonly BUTTON_EXAMPLES = BUTTON_EXAMPLES;
  public readonly ICON_ALIGNMENTS = ICON_ALIGNMENTS;
}
