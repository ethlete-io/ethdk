import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inputBinding,
  input,
  model,
  output,
  outputBinding,
  twoWayBinding,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  anchoredDialogOverlayStrategy,
  AnchoredDialogOverlayStrategyOptions,
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  injectOverlayManager,
  TOOLTIP_IMPORTS,
} from '@ethlete/components';
import { defer, EMPTY, finalize, switchMap, tap } from 'rxjs';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { BuildBlocker, BuildReadyStatus } from './build-ready-footer.component';
import { OpenPointsPopoverComponent } from './open-points-popover.component';
import { OpenPointGroup, OpenPointTarget, PartException } from './system-page-sample';

@Component({
  selector: 'ethlete-open-points-chip',
  template: `
    <span class="relative flex">
      <button
        #chip
        [pressed]="!closed()"
        [attr.aria-label]="label()"
        [etTooltip]="label()"
        (click)="closed.set(!closed())"
        et-icon-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        data-open-points-chip
      >
        <svg
          class="et-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          data-open-points-icon
        >
          <path d="M3 4.5h10v6H7.5L5 12.5v-2H3z" />
          <path d="M5.5 6.5h5" />
          <path d="M5.5 8.5h3" />
        </svg>
      </button>
      @if (badgeCount()) {
        <span class="pointer-events-none absolute -top-space-1 -right-space-1 flex" aria-hidden="true">
          <et-badge variant="filled" size="sm" color="brand">{{ badgeCount() }}</et-badge>
        </span>
      }
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, TOOLTIP_IMPORTS],
  host: { class: 'contents' },
})
export class OpenPointsChipComponent {
  private overlay = injectOverlayManager();
  public part = input.required<string>();
  public groups = input.required<OpenPointGroup[]>();
  public exceptions = input<PartException[]>([]);
  public buildReady = input<BuildReadyStatus | null>(null);
  public missingShots = input(0);
  public dividers = input(true, { transform: booleanAttribute });
  public popoverOrigin = input<HTMLElement | null>(null);
  public popoverPlacement = input<AnchoredDialogOverlayStrategyOptions['placement']>();
  public closed = model(true);
  public blockersOpen = model(false);
  public openEditSketch = output<BuildBlocker>();
  public approveException = output<string>();
  public openPoint = output<OpenPointTarget>();

  private chip = viewChild.required('chip', { read: ElementRef<HTMLElement> });
  public readonly LABELS = SYSTEM_LABELS;

  public count = computed(() =>
    this.groups().reduce((sum, group) => sum + group.lines.length, this.exceptions().length),
  );

  protected badgeCount = computed(() => this.count() || this.missingShots());

  protected label = computed(() =>
    this.count()
      ? this.LABELS.openCount(this.count())
      : this.missingShots()
        ? this.LABELS.shotsMissing(this.missingShots())
        : this.LABELS.nothingOpen,
  );

  constructor() {
    toObservable(this.closed)
      .pipe(
        switchMap((closed) =>
          closed
            ? EMPTY
            : defer(() => {
                const ref = this.overlay.open(OpenPointsPopoverComponent, {
                  origin: this.popoverOrigin() ?? this.chip().nativeElement,
                  mode: 'non-modal',
                  role: 'dialog',
                  ariaLabel: this.LABELS.openPoints,
                  autoFocus: false,
                  strategies: anchoredDialogOverlayStrategy({
                    placement: this.popoverPlacement(),
                    arrowAnchor: this.chip().nativeElement,
                  }),
                  bindings: [
                    inputBinding('part', this.part),
                    inputBinding('groups', this.groups),
                    inputBinding('exceptions', this.exceptions),
                    inputBinding('missingShots', this.missingShots),
                    inputBinding('dividers', this.dividers),
                    inputBinding('buildReady', this.buildReady),
                    twoWayBinding('blockersOpen', this.blockersOpen),
                    outputBinding<BuildBlocker>('openEditSketch', (blocker) => this.openEditSketch.emit(blocker)),
                    outputBinding<string>('approveException', (rule) => this.approveException.emit(rule)),
                    outputBinding<OpenPointTarget>('openPoint', (target) => {
                      this.closed.set(true);
                      this.openPoint.emit(target);
                    }),
                  ],
                });

                return ref.beforeClosed().pipe(finalize(() => ref.close()));
              }),
        ),
        tap(() => this.closed.set(true)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
