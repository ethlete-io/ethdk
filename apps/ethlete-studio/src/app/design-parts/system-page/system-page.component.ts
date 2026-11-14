import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, TemplateRef, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { CanvasFramesComponent } from '../canvas-frames/canvas-frames.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { ShellSection } from '../shell-main/shell-main.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { SystemEmptyComponent } from './system-empty.component';
import { AgentProgress, BuildBlocker, BuildReadyStatus } from './build-ready-footer.component';
import { CommentDraftComponent, CommentSendPhase } from './comment-draft.component';
import { OpenPointsChipComponent } from './open-points-chip.component';
import {
  LegacyCall,
  MANY_STATES_LAYERS,
  OpenPointTarget,
  OPEN_POINTS_SAMPLE,
  PartException,
  SYSTEM_TREE,
  ThemePick,
  ThemeSwitch,
} from './system-page-sample';

export const FRAME_CLASS = 'relative m-0 bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]';

export const FRAME_HEAD_CLASS =
  'absolute bottom-full left-0 flex gap-[0.6em] pb-space-2 text-[1.2rem]/[1.6rem] whitespace-nowrap text-et-surface';

@Component({
  selector: 'ethlete-system-page',
  template: `
    <ethlete-shell-page [shell]="shell()" [section]="section()" (action)="shellAction.emit($event)">
      <ng-container ngProjectAs="[shellMainSide]">
        <ng-content select="[systemSide]">
          @if (empty()) {
            <p class="m-0 px-space-3 py-space-2 text-ui-sm text-et-surface-muted">{{ LABELS.none }}</p>
          } @else if (listingError() === null) {
            <ethlete-part-tree
              [layers]="manyStates() ? manyStatesLayers() : tree().layers"
              [sketches]="manyStates() ? undefined : tree().sketches"
              [legacy]="manyStates() ? undefined : tree().legacy"
              (expandedChange)="expandedChange.emit($event)"
              (activate)="activate.emit($event)"
            />
          }
        </ng-content>
      </ng-container>
      @if (listingError(); as message) {
        <div class="flex h-full items-center justify-center ps-(--st-shell-inset-left)" data-listing-error>
          <div class="flex w-2xl flex-col items-center gap-space-4 text-center text-ui-sm">
            <span [etProvideColor]="errorTheme()" class="contents">
              <svg
                class="text-et-theme"
                width="24"
                height="24"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="5.5" />
                <path d="m6 6 4 4m0-4-4 4" />
              </svg>
            </span>
            <p class="m-0 text-ui-md font-ui-strong text-et-surface">{{ LABELS.listingFailed }}</p>
            <p class="m-0 text-et-surface-muted">{{ message }}</p>
            <button (click)="reload.emit()" et-button type="button" variant="outline" size="sm">
              {{ LABELS.reload }}
            </button>
          </div>
        </div>
      } @else if (call(); as shown) {
        <ng-content select="[systemCallCanvas]">
          <ethlete-canvas-frames
            (zoomOut)="zoomOut.emit()"
            (zoomReset)="zoomReset.emit()"
            (zoomIn)="zoomIn.emit()"
            (fit)="fitAll.emit()"
            class="w-full pt-16"
          >
            <figure [class]="FRAME_CLASS">
              <figcaption [class]="FRAME_HEAD_CLASS">{{ callFrame() }}</figcaption>
              <div class="h-45 w-md">
                <ng-container *ngTemplateOutlet="frameShot; context: { $implicit: callFrame() }" />
              </div>
            </figure>
          </ethlete-canvas-frames>
        </ng-content>
        <header
          class="absolute inset-x-0 top-0 flex items-center gap-space-3 border-b border-(--et-surface-border-solid) bg-(--et-surface-background-solid) py-space-3 ps-[calc(var(--st-shell-inset-left)+var(--spacing-space-4))] pe-space-4"
        >
          <div class="min-w-0 flex-1">
            <span class="font-code text-ui-xs text-et-surface-muted">{{ shown.slug }}</span>
            <h2 class="m-0 truncate font-ui-strong text-ui-md text-et-surface">{{ shown.headline }}</h2>
          </div>
          @for (themeSwitch of themeSwitches(); track themeSwitch.kind) {
            <div
              [attr.aria-label]="themeSwitch.kind === 'surface' ? SHELL_LABELS.surfaceTheme : SHELL_LABELS.colorTheme"
              class="flex gap-0.5 rounded-control-lg border border-(--et-surface-border-solid) p-0.5"
              role="group"
            >
              @for (name of themeSwitch.names; track name) {
                <button
                  [pressed]="name === themeSwitch.current"
                  (click)="pickTheme.emit({ kind: themeSwitch.kind, name })"
                  et-button
                  type="button"
                  variant="transparent"
                  color="surface"
                  size="xs"
                >
                  {{ name }}
                </button>
              }
            </div>
          }
          @if (shown.transferred) {
            <div class="flex flex-wrap items-center">
              <et-badge variant="tonal" size="sm">{{ SHELL_LABELS.transferred }}</et-badge>
            </div>
          } @else {
            <button
              (click)="markTransferred.emit(shown.slug)"
              et-button
              type="button"
              variant="outline"
              color="surface"
              size="sm"
            >
              {{ SHELL_LABELS.markTransferred }}
            </button>
          }
        </header>
      } @else if (noted()) {
        <div class="grid h-full ps-(--st-shell-inset-left)">
          <ng-content select="[systemNote]" />
        </div>
      } @else if (empty()) {
        <ethlete-system-empty [product]="shell().product" (copyPrompt)="copyPrompt.emit()" />
      } @else if (manyStates()) {
        <ethlete-canvas-frames
          (zoomOut)="zoomOut.emit()"
          (zoomReset)="zoomReset.emit()"
          (zoomIn)="zoomIn.emit()"
          (fit)="fitAll.emit()"
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
        <ng-content select="[systemCanvas]">
          <ethlete-canvas-frames
            [fitted]="fit()"
            (zoomOut)="zoomOut.emit()"
            (zoomReset)="zoomReset.emit()"
            (zoomIn)="zoomIn.emit()"
            (fit)="fitAll.emit()"
            class="w-full"
          >
            <figure [class]="FRAME_CLASS">
              <figcaption [class]="FRAME_HEAD_CLASS">{{ frame() }}</figcaption>
              <div class="relative">
                <div [class.w-md]="fit()" [class.h-45]="fit()">
                  <ng-container *ngTemplateOutlet="frameShot; context: { $implicit: frame() }" />
                </div>
                @if (commentMode()) {
                  <div
                    [etTooltip]="LABELS.commentOn(frame())"
                    [attr.aria-label]="LABELS.commentOn(frame())"
                    (click)="draft.set('')"
                    (keydown.enter)="draft.set('')"
                    class="absolute inset-0 cursor-crosshair bg-(--et-theme-color-primary-solid)/6"
                    role="button"
                    tabindex="0"
                  ></div>
                  @if (draft() !== null) {
                    <ethlete-comment-draft
                      [text]="draft() ?? ''"
                      [phase]="send()"
                      [reason]="reason()"
                      (textChange)="draft.set($event)"
                      (send)="sendComment.emit($event)"
                      (discard)="draft.set(null)"
                      class="absolute top-[42%] left-[38%] z-4"
                    />
                  }
                }
              </div>
            </figure>
          </ethlete-canvas-frames>
        </ng-content>
        <div class="absolute top-space-3 right-space-3 z-1 flex gap-space-2">
          <ng-content select="[systemActions]" />
          <button
            [pressed]="commentMode()"
            (click)="toggleComments()"
            et-button
            type="button"
            variant="outline"
            size="sm"
          >
            {{ LABELS.comment }}
          </button>
          <ethlete-open-points-chip
            [(closed)]="closed"
            [(blockersOpen)]="blockersOpen"
            [part]="part()"
            [groups]="groups()"
            [exceptions]="openExceptions()"
            [buildReady]="buildReady()"
            [agent]="agent()"
            [missingShots]="missingShots()"
            (openPoint)="openPoint.emit($event)"
            (openEditSketch)="openEditSketch.emit($event)"
            (approveException)="approveException.emit($event)"
          />
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
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    TOOLTIP_IMPORTS,
    CanvasFramesComponent,
    CommentDraftComponent,
    NgTemplateOutlet,
    OpenPointsChipComponent,
    PartTreeComponent,
    ProvideColorDirective,
    ShellPageComponent,
    SystemEmptyComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class SystemPageComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public section = input<ShellSection>('System');
  public noted = input(false);
  public missingShots = input(0);

  public empty = input(false);
  public listingError = input<string | null>(null);
  public manyStates = input(false);
  public nothingOpen = input(false);
  public fit = input(false);
  public closed = model(false);
  public commentMode = model(false);
  public draft = model<string | null>(null);
  public send = input<CommentSendPhase | null>(null);
  public reason = input('');
  public tree = input(SYSTEM_TREE);
  public manyStatesLayers = input(MANY_STATES_LAYERS);
  public frame = input('button');
  public shot = input<TemplateRef<{ $implicit: string }> | null>(null);
  public part = input('components/button');
  public openPoints = input(OPEN_POINTS_SAMPLE);
  public exceptions = input<PartException[]>([]);
  public buildReady = input<BuildReadyStatus | null>(null);
  public agent = input<AgentProgress | null>(null);
  public call = input<LegacyCall | null>(null);
  public themeSwitches = input<ThemeSwitch[]>([]);
  public blockersOpen = model(false);
  public shellAction = output<ShellAction>();

  public activate = output<string>();
  public expandedChange = output<readonly string[]>();
  public copyPrompt = output();
  public reload = output();
  public zoomOut = output();
  public zoomReset = output();
  public zoomIn = output();
  public fitAll = output();
  public sendComment = output<string>();
  public openEditSketch = output<BuildBlocker>();
  public approveException = output<string>();
  public openPoint = output<OpenPointTarget>();
  // eslint-disable-next-line ethlete/prefer-present-tense-output -- the design action emit:markTransferred fixes this name
  public markTransferred = output<string>();
  public pickTheme = output<ThemePick>();

  protected readonly LABELS = STUDIO_LABELS.system;
  protected readonly SHELL_LABELS = STUDIO_LABELS.shell;
  protected readonly FRAME_CLASS = FRAME_CLASS;
  protected readonly FRAME_HEAD_CLASS = FRAME_HEAD_CLASS;

  public groups = computed(() => (this.nothingOpen() ? [] : this.openPoints()));
  public openExceptions = computed(() => (this.nothingOpen() ? [] : this.exceptions()));
  protected callFrame = computed(() => this.call()?.slug.split('/').pop() ?? '');

  protected toggleComments() {
    const on = !this.commentMode();

    this.commentMode.set(on);
    if (on) this.closed.set(true);
    else this.draft.set(null);
  }
}
