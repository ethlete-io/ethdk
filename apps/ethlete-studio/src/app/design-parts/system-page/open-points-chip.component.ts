import {
  Component,
  computed,
  effect,
  ElementRef,
  inputBinding,
  input,
  model,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { anchoredDialogOverlayStrategy, BUTTON_IMPORTS, injectOverlayManager } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { OpenPointsPopoverComponent } from './open-points-popover.component';
import { OpenPointGroup } from './system-page-sample';

@Component({
  selector: 'ethlete-open-points-chip',
  template: `
    <button
      #chip
      [pressed]="!closed()"
      (click)="closed.set(!closed())"
      et-button
      type="button"
      variant="outline"
      size="sm"
      data-open-points-chip
    >
      @if (count()) {
        <span [etProvideColor]="warningTheme()" class="contents" etIcon>
          <svg
            class="text-et-theme"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M8 2.5 14 13H2z" />
            <path d="M8 6.5v3" />
            <path d="M8 11.25v.01" />
          </svg>
        </span>
      } @else {
        <svg
          class="flex-none text-et-theme-ink"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          etIcon
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      }
      {{ count() ? LABELS.openCount(count()) : LABELS.nothingOpen }}
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective],
  host: { class: 'contents' },
})
export class OpenPointsChipComponent {
  private overlay = injectOverlayManager();
  protected warningTheme = injectSemanticColorTheme('warning');
  public part = input.required<string>();
  public groups = input.required<OpenPointGroup[]>();
  public closed = model(true);

  private chip = viewChild.required('chip', { read: ElementRef<HTMLElement> });
  protected readonly LABELS = STUDIO_LABELS.system;

  protected count = computed(() => this.groups().reduce((sum, group) => sum + group.lines.length, 0));

  constructor() {
    effect((onCleanup) => {
      const origin = this.chip().nativeElement;

      if (this.closed()) return;

      const ref = untracked(() =>
        this.overlay.open(OpenPointsPopoverComponent, {
          origin,
          mode: 'non-modal',
          role: 'dialog',
          ariaLabel: this.LABELS.openPoints,
          autoFocus: false,
          strategies: anchoredDialogOverlayStrategy(),
          bindings: [inputBinding('part', this.part), inputBinding('groups', this.groups)],
        }),
      );

      onCleanup(() => ref.close());
    });
  }
}
