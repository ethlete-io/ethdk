import { booleanAttribute, ChangeDetectionStrategy, Component, input, signal, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON, ICON_IMPORTS, provideIcons, TIMES_ICON } from '../../../icon';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../../button.component';
import { BUTTON_IMPORTS } from '../../button.imports';

const SIZES = Object.values(BUTTON_SIZES).reverse();
const SURFACE_VARIANTS = [
  BUTTON_VARIANTS.FILLED,
  BUTTON_VARIANTS.OUTLINE,
  BUTTON_VARIANTS.TONAL,
  BUTTON_VARIANTS.TRANSPARENT,
] as const;

@Component({
  selector: 'et-sb-button-text',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-3">
        @for (size of sizes; track size) {
          <button [size]="size" [theme]="theme()" [disabled]="disabled()" et-text-button type="button">
            {{ size }}
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
  sizes = SIZES;
  theme = input('brand');
  disabled = input(false, { transform: booleanAttribute });
}

@Component({
  selector: 'et-sb-button-surface',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of variants; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (size of sizes; track size) {
              <button
                [variant]="variant"
                [size]="size"
                [theme]="theme()"
                [disabled]="disabled()"
                [pressed]="pressed()"
                et-button
                type="button"
              >
                {{ size }}
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
  variants = SURFACE_VARIANTS;
  sizes = SIZES;
  theme = input('brand');
  disabled = input(false, { transform: booleanAttribute });
  pressed = input(false, { transform: booleanAttribute });
}

@Component({
  selector: 'et-sb-button-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-3">
        @for (size of sizes; track size) {
          <button
            [size]="size"
            [theme]="theme()"
            [disabled]="disabled()"
            [pressed]="pressed()"
            [attr.aria-label]="size"
            et-icon-button
            type="button"
          >
            <i etIcon="et-times"></i>
          </button>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(TIMES_ICON)],
})
export class ButtonIconStorybookComponent {
  sizes = SIZES;
  theme = input('brand');
  disabled = input(false, { transform: booleanAttribute });
  pressed = input(false, { transform: booleanAttribute });
}

@Component({
  selector: 'et-sb-button-fab',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">fab</p>
        <div class="flex flex-wrap items-center gap-3">
          @for (size of sizes; track size) {
            <button [size]="size" [theme]="theme()" [disabled]="disabled()" [pressed]="pressed()" et-fab type="button">
              <i etIcon="et-chevron"></i>
            </button>
          }
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">fab extended (click to toggle)</p>
        <div class="flex flex-wrap items-center gap-3">
          @for (size of sizes; track size) {
            <button
              [size]="size"
              [theme]="theme()"
              [disabled]="disabled()"
              [pressed]="pressed()"
              [expanded]="expandedSize() === size"
              (click)="toggleExpanded(size)"
              et-fab
              type="button"
            >
              <i etIcon="et-chevron"></i>
              Click me ({{ size }})
            </button>
          }
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON)],
})
export class ButtonFabStorybookComponent {
  sizes = SIZES;
  theme = input('brand');
  disabled = input(false, { transform: booleanAttribute });
  pressed = input(false, { transform: booleanAttribute });

  expandedSize = signal<string | null>(null);

  toggleExpanded(size: string) {
    this.expandedSize.update((current) => (current === size ? null : size));
  }
}

@Component({
  selector: 'et-sb-button-surface-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of variants; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (size of sizes; track size) {
              <button
                [variant]="variant"
                [size]="size"
                [theme]="theme()"
                [disabled]="disabled()"
                et-button
                type="button"
              >
                <i etIcon="et-chevron"></i>
                {{ size }}
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
  providers: [provideIcons(CHEVRON_ICON)],
})
export class ButtonSurfaceIconStorybookComponent {
  variants = SURFACE_VARIANTS;
  sizes = SIZES;
  theme = input('brand');
  disabled = input(false, { transform: booleanAttribute });
}

@Component({
  selector: 'et-sb-button-text-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-3">
        @for (size of sizes; track size) {
          <button [size]="size" [theme]="theme()" [disabled]="disabled()" et-text-button type="button">
            <i etIcon="et-chevron"></i>
            {{ size }}
          </button>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON)],
})
export class ButtonTextIconStorybookComponent {
  sizes = SIZES;
  theme = input('brand');
  disabled = input(false, { transform: booleanAttribute });
}
