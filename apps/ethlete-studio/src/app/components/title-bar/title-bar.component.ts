import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  TOOLTIP_IMPORTS,
  WINDOW_CONTROL_BUTTON_KINDS,
  WINDOW_CONTROL_BUTTON_SHAPES,
  WINDOW_CONTROL_BUTTON_SIZES,
} from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { catchError, EMPTY, fromEvent, startWith, switchMap } from 'rxjs';
import { isWindowMaximized$, WindowButton, WindowChrome } from '../../../host/window';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { ErrorToastComponent } from '../../design-parts/error-toast/error-toast.component';
import { TitleSearchComponent } from '../title-search/title-search.component';

export type TitleBarPush = { unpushed: number; age: string; gate: 'green' | 'red' | 'unknown' };

@Component({
  selector: 'ethlete-title-bar',
  template: `
    <div
      [class]="caption() ? 'pl-1.5' : 'px-1.5'"
      class="st-title-bar grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-et-surface-border bg-et-surface-bg font-ui text-ui-sm text-et-surface"
      data-et-surface
      data-tauri-drag-region="deep"
    >
      <div class="flex items-center gap-2">
        @if (os() === 'macos') {
          <div class="w-19.5 shrink-0" data-tauri-drag-region></div>
        }
        <ng-container *ngTemplateOutlet="caption() ? captionControls : controls; context: { $implicit: left() }" />
      </div>

      <ethlete-title-search [product]="product()" [part]="part()" [os]="os()" />

      <div [class.self-stretch]="caption()" class="flex items-center justify-end gap-2">
        @if (push(); as push) {
          <span [etProvideColor]="pushTheme()" [attr.title]="pushTitle()" class="inline-flex" data-push-state>
            <et-badge [variant]="push.gate === 'red' ? 'filled' : 'tonal'" size="sm">
              <span class="inline-flex items-center gap-1 whitespace-nowrap">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  @switch (push.gate) {
                    @case ('green') {
                      <path d="m3.5 8.5 3 3 6-7" />
                    }
                    @case ('red') {
                      <circle cx="8" cy="8" r="5.5" />
                      <path d="m6 6 4 4m0-4-4 4" />
                    }
                    @default {
                      <path d="M8 2.5 14 13H2z" />
                      <path d="M8 6.5v3" />
                      <path d="M8 11.25v.01" />
                    }
                  }
                </svg>
                {{ CODE_LABELS.push(push) }}
              </span>
            </et-badge>
          </span>
        }
        @if (!notice() && noticeText(); as text) {
          <span class="whitespace-nowrap text-et-surface-muted" data-code-notice>{{ text }}</span>
        }
        @if (notice()) {
          <button
            [etTooltip]="restarting() ? null : noticeText()"
            [loading]="restarting()"
            (click)="restartPress.emit()"
            et-button
            type="button"
            variant="tonal"
            color="brand"
            size="xs"
            placement="bottom-end"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              etIcon
            >
              <path d="m5.5 6 2.5-2.5 2.5 2.5" />
              <path d="m5.5 10 2.5 2.5 2.5-2.5" />
            </svg>
            {{ CODE_LABELS.restart }}
          </button>
        }
        @if (update()) {
          <button (click)="updatePress.emit($event)" et-button type="button" variant="filled" color="brand" size="xs">
            {{ LABELS.update }}
          </button>
        }
        <ng-container *ngTemplateOutlet="caption() ? captionControls : controls; context: { $implicit: right() }" />
      </div>
    </div>

    @if (restart() === 'failed') {
      <ethlete-error-toast
        [heading]="CODE_LABELS.restartFailedTitle"
        [message]="CODE_LABELS.restartFailedMessage"
        (dismiss)="dismiss.emit()"
        class="px-space-3 pt-space-3"
      />
    }

    <ng-template #captionControls let-buttons>
      @if (buttons.length) {
        <div class="flex self-stretch">
          @for (button of buttons; track button) {
            @switch (button) {
              @case ('minimize') {
                <button
                  [shape]="CAPTION_SHAPE"
                  [size]="SIZE"
                  [attr.aria-label]="LABELS.window.minimize"
                  (click)="minimize.emit()"
                  et-window-control-button
                  type="button"
                  color="surface"
                  data-window-button="minimize"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    aria-hidden="true"
                  >
                    <path d="M0 5.5H10" />
                  </svg>
                </button>
              }
              @case ('maximize') {
                <button
                  [shape]="CAPTION_SHAPE"
                  [size]="SIZE"
                  [attr.aria-label]="isMaximized() ? LABELS.window.restore : LABELS.window.maximize"
                  (click)="maximize.emit()"
                  et-window-control-button
                  type="button"
                  color="surface"
                  data-window-button="maximize"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    aria-hidden="true"
                  >
                    @if (isMaximized()) {
                      <path d="M2.5 0.5h6c.55 0 1 .45 1 1v6" />
                      <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
                    } @else {
                      <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
                    }
                  </svg>
                </button>
              }
              @case ('close') {
                <span
                  [etProvideColor]="errorTheme()"
                  class="contents [--et-window-control-button-close-background-active:rgb(var(--et-color-primary-active))] [--et-window-control-button-close-background:var(--et-theme-color-primary-solid)] [--et-window-control-button-close-color:var(--et-theme-color-on-primary-solid)]"
                >
                  <button
                    [shape]="CAPTION_SHAPE"
                    [size]="SIZE"
                    [kind]="CLOSE_KIND"
                    [attr.aria-label]="LABELS.window.close"
                    (click)="close.emit()"
                    et-window-control-button
                    type="button"
                    color="surface"
                    data-window-button="close"
                  >
                    <svg
                      width="1em"
                      height="1em"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1"
                      aria-hidden="true"
                    >
                      <path d="M0.35 0.35L9.65 9.65M9.65 0.35L0.35 9.65" />
                    </svg>
                  </button>
                </span>
              }
            }
          }
        </div>
      }
    </ng-template>

    <ng-template #controls let-buttons>
      @if (buttons.length) {
        <div [class]="round() ? 'gap-1.5' : 'gap-0.5'" class="flex items-center">
          @for (button of buttons; track button) {
            @switch (button) {
              @case ('minimize') {
                <button
                  [shape]="shape()"
                  [size]="SIZE"
                  [attr.aria-label]="LABELS.window.minimize"
                  (click)="minimize.emit()"
                  et-window-control-button
                  type="button"
                  color="surface"
                  data-window-button="minimize"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    aria-hidden="true"
                  >
                    <path d="M4 8h8" stroke-linecap="round" />
                  </svg>
                </button>
              }
              @case ('maximize') {
                <button
                  [shape]="shape()"
                  [size]="SIZE"
                  [attr.aria-label]="isMaximized() ? LABELS.window.restore : LABELS.window.maximize"
                  (click)="maximize.emit()"
                  et-window-control-button
                  type="button"
                  color="surface"
                  data-window-button="maximize"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    aria-hidden="true"
                  >
                    @if (isMaximized()) {
                      <path d="M6 4.5h4.75c.7 0 1.25.55 1.25 1.25V10.5" stroke-linecap="round" />
                      <rect x="4" y="6.5" width="5.5" height="5.5" rx="1" />
                    } @else {
                      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1" />
                    }
                  </svg>
                </button>
              }
              @case ('close') {
                <button
                  [shape]="shape()"
                  [size]="SIZE"
                  [kind]="CLOSE_KIND"
                  [attr.aria-label]="LABELS.window.close"
                  (click)="close.emit()"
                  et-window-control-button
                  type="button"
                  color="surface"
                  data-window-button="close"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    aria-hidden="true"
                  >
                    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke-linecap="round" />
                  </svg>
                </button>
              }
            }
          }
        </div>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    TOOLTIP_IMPORTS,
    NgTemplateOutlet,
    ProvideColorDirective,
    TitleSearchComponent,
    ErrorToastComponent,
  ],
  host: { class: 'block shrink-0' },
})
export class TitleBarComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private warningTheme = injectSemanticColorTheme('warning');
  public os = input.required<WindowChrome['os']>();
  public left = input<WindowButton[]>([]);
  public right = input<WindowButton[]>([]);
  public update = input(false);
  public notice = input(false);
  public noticeText = input<string | null>(null);
  public restart = input<'pending' | 'failed' | null>(null);
  public push = input<TitleBarPush | null>(null);
  public product = input('');

  public part = input('');
  // eslint-disable-next-line @angular-eslint/no-output-rename -- the design's update output shares its name with the update input
  public updatePress = output<MouseEvent>({ alias: 'update' });
  // eslint-disable-next-line @angular-eslint/no-output-rename -- the design's restart output shares its name with the restart input
  public restartPress = output({ alias: 'restart' });
  public dismiss = output();
  public minimize = output();
  public maximize = output();

  // eslint-disable-next-line @angular-eslint/no-output-native -- the design declares emit:close
  public close = output();
  protected readonly LABELS = STUDIO_LABELS.titleBar;
  protected readonly CODE_LABELS = STUDIO_LABELS.code;
  protected readonly CAPTION_SHAPE = WINDOW_CONTROL_BUTTON_SHAPES.CAPTION;
  protected readonly SIZE = WINDOW_CONTROL_BUTTON_SIZES.MD;

  protected readonly CLOSE_KIND = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;

  protected pushTheme = computed(() => {
    const gate = this.push()?.gate;

    return gate === 'red' ? this.errorTheme() : gate === 'unknown' ? this.warningTheme() : undefined;
  });

  protected pushTitle = computed(() => {
    const gate = this.push()?.gate;

    if (!gate) return null;

    const label = this.CODE_LABELS.pushGate[gate];

    return gate === 'red' ? `${label} - ${this.CODE_LABELS.pushRedAdvice}` : label;
  });

  protected restarting = computed(() => this.restart() === 'pending');
  protected round = computed(() => this.os() === 'linux');
  protected caption = computed(() => this.os() === 'windows');

  protected shape = computed(() =>
    this.round() ? WINDOW_CONTROL_BUTTON_SHAPES.ROUND : WINDOW_CONTROL_BUTTON_SHAPES.SQUARE,
  );

  protected isMaximized = toSignal(
    fromEvent(globalThis, 'resize').pipe(
      startWith(null),
      // eslint-disable-next-line ethlete/no-silent-catch-error -- a failed maximize probe leaves the previous maximized state in place
      switchMap(() => isWindowMaximized$().pipe(catchError(() => EMPTY))),
    ),
    { initialValue: false },
  );
}
