import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inputBinding,
  input,
  model,
  output,
  TemplateRef,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { anchoredDialogOverlayStrategy, BUTTON_IMPORTS, injectOverlayManager } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { CanvasFramesComponent } from '../canvas-frames/canvas-frames.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { SystemEmptyComponent } from './system-empty.component';
import { OpenPointsPopoverComponent } from './open-points-popover.component';
import { MANY_STATES_LAYERS, OPEN_POINTS_SAMPLE, SYSTEM_LAYERS } from './system-page-sample';

const FRAME_CLASS = 'relative m-0 bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]';

const FRAME_HEAD_CLASS =
  'absolute bottom-full left-0 flex gap-[0.6em] pb-space-2 text-[1.2rem]/[1.6rem] whitespace-nowrap text-et-surface';

@Component({
  selector: 'ethlete-system-page',
  template: `
    <ethlete-shell-page [shell]="shell()" (action)="shellAction.emit($event)" section="System">
      @if (empty()) {
        <p class="m-0 px-space-3 py-space-2 text-ui-sm text-et-surface-muted" shellMainSide>{{ LABELS.none }}</p>
      } @else {
        <ethlete-part-tree
          [layers]="manyStates() ? manyStatesLayers() : layers()"
          (expandedChange)="expandedChange.emit($event)"
          (activate)="activate.emit($event)"
          shellMainSide
        />
      }
      @if (empty()) {
        <ethlete-system-empty [product]="shell().product" (copyPrompt)="copyPrompt.emit()" />
      } @else if (manyStates()) {
        <ethlete-canvas-frames
          (zoomOut)="zoomOut.emit()"
          (zoomReset)="zoomReset.emit()"
          (zoomIn)="zoomIn.emit()"
          (fit)="fit.emit()"
          zoom="75%"
        >
          <figure [class]="FRAME_CLASS">
            <figcaption [class]="FRAME_HEAD_CLASS">grid</figcaption>
            <div>
              <ng-container *ngTemplateOutlet="frameShot; context: { $implicit: 'grid' }" />
            </div>
          </figure>
          <figure [class]="FRAME_CLASS">
            <figcaption [class]="FRAME_HEAD_CLASS">
              tree<span class="text-et-surface-muted tabular-nums">280</span>
            </figcaption>
            <div class="w-md">
              <ng-container *ngTemplateOutlet="frameShot; context: { $implicit: 'tree' }" />
            </div>
          </figure>
        </ethlete-canvas-frames>
      } @else {
        <ethlete-canvas-frames
          (zoomOut)="zoomOut.emit()"
          (zoomReset)="zoomReset.emit()"
          (zoomIn)="zoomIn.emit()"
          (fit)="fit.emit()"
          class="w-250"
        >
          <figure [class]="FRAME_CLASS">
            <figcaption [class]="FRAME_HEAD_CLASS">{{ frame() }}</figcaption>
            <div>
              <ng-container *ngTemplateOutlet="frameShot; context: { $implicit: frame() }" />
            </div>
          </figure>
        </ethlete-canvas-frames>
        <div class="absolute top-space-3 right-space-3">
          <button
            #chip
            [pressed]="!closed()"
            (click)="closed.set(!closed())"
            et-button
            type="button"
            variant="outline"
            size="sm"
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
        </div>
      }
    </ethlete-shell-page>

    <ng-template #frameShot let-frame>
      @if (shot(); as shot) {
        <ng-container *ngTemplateOutlet="shot; context: { $implicit: frame }" />
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CanvasFramesComponent,
    NgTemplateOutlet,
    PartTreeComponent,
    ProvideColorDirective,
    ShellPageComponent,
    SystemEmptyComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class SystemPageComponent {
  private overlay = injectOverlayManager();
  protected warningTheme = injectSemanticColorTheme('warning');
  public shell = input<ShellState>(SHELL_SAMPLE);

  public empty = input(false);
  public manyStates = input(false);
  public nothingOpen = input(false);
  public closed = model(false);
  public layers = input(SYSTEM_LAYERS);
  public manyStatesLayers = input(MANY_STATES_LAYERS);
  public frame = input('button');
  public shot = input<TemplateRef<{ $implicit: string }> | null>(null);
  public part = input('components/button');
  public openPoints = input(OPEN_POINTS_SAMPLE);
  public shellAction = output<ShellAction>();

  public activate = output<string>();
  public expandedChange = output<readonly string[]>();
  public copyPrompt = output();
  public zoomOut = output();
  public zoomReset = output();
  public zoomIn = output();
  public fit = output();

  private chip = viewChild('chip', { read: ElementRef<HTMLElement> });
  protected readonly LABELS = STUDIO_LABELS.system;
  protected readonly FRAME_CLASS = FRAME_CLASS;
  protected readonly FRAME_HEAD_CLASS = FRAME_HEAD_CLASS;

  public groups = computed(() => (this.nothingOpen() ? [] : this.openPoints()));
  protected count = computed(() => this.groups().reduce((sum, group) => sum + group.lines.length, 0));

  constructor() {
    effect((onCleanup) => {
      const origin = this.chip()?.nativeElement;

      if (!origin || this.closed()) return;

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
