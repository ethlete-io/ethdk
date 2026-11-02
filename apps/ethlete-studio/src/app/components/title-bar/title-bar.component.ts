import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  BUTTON_IMPORTS,
  WINDOW_CONTROL_BUTTON_KINDS,
  WINDOW_CONTROL_BUTTON_SHAPES,
  WINDOW_CONTROL_BUTTON_SIZES,
  KBD_IMPORTS,
} from '@ethlete/components';
import { catchError, EMPTY, fromEvent, Observable, startWith, switchMap } from 'rxjs';
import {
  closeWindow$,
  isWindowMaximized$,
  minimizeWindow$,
  toggleMaximizeWindow$,
  WindowButton,
  WindowChrome,
} from '../../../host/window';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-title-bar',
  template: `
    <div
      class="grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-et-surface-border bg-et-surface-bg px-1.5 font-ui text-ui-sm text-et-surface"
      data-et-surface
      data-tauri-drag-region="deep"
    >
      <div class="flex items-center gap-2">
        @if (os() === 'macos') {
          <div class="w-19.5 shrink-0" data-tauri-drag-region></div>
        }
        <ng-container *ngTemplateOutlet="controls; context: { $implicit: left() }" />
      </div>

      <button
        [attr.aria-label]="LABELS.search(product(), part())"
        class="w-2xl justify-start px-space-2 text-et-surface-muted [--et-button-gap:var(--space-2)]"
        et-button
        stretchContents
        type="button"
        variant="tonal"
        color="surface"
        size="xs"
        aria-haspopup="dialog"
      >
        <svg
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
          <circle cx="7" cy="7" r="4.25" />
          <path d="M10.25 10.25 13.5 13.5" />
        </svg>
        <span class="flex flex-1 justify-center gap-1 truncate font-ui">
          <span>{{ product() }}</span>
          <span aria-hidden="true">/</span>
          <span class="font-ui-strong text-et-surface">{{ part() }}</span>
        </span>
        <et-kbd [platform]="os() === 'macos' ? 'apple' : 'other'" keys="mod+k" />
      </button>

      <div class="flex items-center justify-end gap-2">
        @if (update()) {
          <button et-button type="button" variant="filled" color="brand" size="xs">{{ LABELS.update }}</button>
        }
        <ng-container *ngTemplateOutlet="controls; context: { $implicit: right() }" />
      </div>
    </div>

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
                  (click)="run(minimize$())"
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
                  (click)="run(toggleMaximize$())"
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
                  (click)="run(close$())"
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
  imports: [BUTTON_IMPORTS, KBD_IMPORTS, NgTemplateOutlet],
  host: { class: 'block shrink-0' },
})
export class TitleBarComponent {
  private destroyRef = inject(DestroyRef);

  public os = input.required<WindowChrome['os']>();
  public left = input<WindowButton[]>([]);
  public right = input<WindowButton[]>([]);
  public update = input(false);
  public product = input('');
  public part = input('');

  protected readonly LABELS = STUDIO_LABELS.titleBar;
  protected readonly SIZE = WINDOW_CONTROL_BUTTON_SIZES.MD;
  protected readonly CLOSE_KIND = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;

  protected round = computed(() => this.os() === 'linux');

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

  protected minimize$ = minimizeWindow$;
  protected toggleMaximize$ = toggleMaximizeWindow$;
  protected close$ = closeWindow$;

  protected run(action$: Observable<void>) {
    action$
      .pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a failed window control click has nothing to recover or show
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
