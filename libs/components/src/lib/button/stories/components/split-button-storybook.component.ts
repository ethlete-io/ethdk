import { booleanAttribute, Component, input, signal, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON, FLOPPY_DISK_ICON, ICON_IMPORTS, provideIcons } from '../../../icon';
import { MENU_IMPORTS } from '../../../menu';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../../button.component';
import { BUTTON_IMPORTS } from '../../button.imports';

const SPLIT_BUTTON_EXAMPLES = [
  { size: BUTTON_SIZES.XL, label: 'Save changes' },
  { size: BUTTON_SIZES.LG, label: 'Save changes' },
  { size: BUTTON_SIZES.MD, label: 'Save changes' },
  { size: BUTTON_SIZES.SM, label: 'Save' },
  { size: BUTTON_SIZES.XS, label: 'Save' },
] as const;

const SURFACE_VARIANTS = [
  BUTTON_VARIANTS.FILLED,
  BUTTON_VARIANTS.OUTLINE,
  BUTTON_VARIANTS.TONAL,
  BUTTON_VARIANTS.TRANSPARENT,
] as const;

@Component({
  selector: 'et-sb-split-button',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (variant of VARIANTS; track variant) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ variant }}</p>
          <div class="flex flex-wrap items-center gap-3">
            @for (example of SPLIT_BUTTON_EXAMPLES; track example.size) {
              <div etMenu>
                <et-split-button>
                  <button
                    [variant]="variant"
                    [size]="example.size"
                    [color]="color()"
                    [disabled]="disabled()"
                    [loading]="loading()"
                    (click)="lastAction.set('Save (' + example.size + ')')"
                    et-button
                    etSplitButtonAction
                    type="button"
                  >
                    <i etIcon="et-floppy-disk"></i>
                    {{ example.label }}
                  </button>

                  <button
                    [variant]="variant"
                    [size]="example.size"
                    [color]="color()"
                    [disabled]="disabled()"
                    et-icon-button
                    etSplitButtonTrigger
                    etMenuTrigger
                    type="button"
                    aria-label="More save options"
                  >
                    <i class="rotate-180" etIcon="et-chevron"></i>
                  </button>
                </et-split-button>

                <ng-template etMenuSurface>
                  <et-menu>
                    <button (click)="lastAction.set('Save as copy')" et-menu-item type="button">Save as copy</button>
                    <button (click)="lastAction.set('Save as template')" et-menu-item type="button">
                      Save as template
                    </button>
                    <button (click)="lastAction.set('Save and publish')" et-menu-item type="button">
                      Save and publish
                    </button>
                  </et-menu>
                </ng-template>
              </div>
            }
          </div>
        </div>
      }

      <p class="m-0 text-xs opacity-60">Last action: {{ lastAction() ?? '—' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, ...ICON_IMPORTS, ...MENU_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON, FLOPPY_DISK_ICON)],
})
export class SplitButtonStorybookComponent {
  public color = input('brand');
  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });

  public lastAction = signal<string | null>(null);

  public readonly VARIANTS = SURFACE_VARIANTS;
  public readonly SPLIT_BUTTON_EXAMPLES = SPLIT_BUTTON_EXAMPLES;
}
