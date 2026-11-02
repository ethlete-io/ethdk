import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  BUTTON_IMPORTS,
  WINDOW_CONTROL_BUTTON_KINDS,
  WINDOW_CONTROL_BUTTON_SHAPES,
  WINDOW_CONTROL_BUTTON_SIZES,
} from '@ethlete/components';
import { catchError, EMPTY, fromEvent, Observable, of, startWith, switchMap } from 'rxjs';
import {
  closeWindow$,
  isWindowMaximized$,
  minimizeWindow$,
  toggleMaximizeWindow$,
  windowChrome$,
} from '../../../host/window';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-title-bar',
  template: `
    @if (chrome(); as chrome) {
      <div class="flex h-9 shrink-0 items-center gap-2 px-1.5" data-tauri-drag-region="deep">
        @if (chrome.os === 'macos') {
          <div class="w-19.5 shrink-0" data-tauri-drag-region></div>
        }

        <ng-container *ngTemplateOutlet="controls; context: { $implicit: chrome.left }" />

        <div class="h-full grow" data-tauri-drag-region></div>

        <ng-container *ngTemplateOutlet="controls; context: { $implicit: chrome.right }" />
      </div>
    }

    <ng-template #controls let-buttons>
      @if (buttons.length) {
        <div [class]="round() ? 'gap-1.5' : 'gap-0.5'" class="flex items-center">
          @for (button of buttons; track button) {
            @switch (button) {
              @case ('minimize') {
                <button
                  [shape]="shape()"
                  [size]="SIZE"
                  [attr.aria-label]="LABELS.minimize"
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
                  [attr.aria-label]="isMaximized() ? LABELS.restore : LABELS.maximize"
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
                  [attr.aria-label]="LABELS.close"
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
  imports: [BUTTON_IMPORTS, NgTemplateOutlet],
  host: { class: 'block shrink-0' },
})
export class TitleBarComponent {
  private destroyRef = inject(DestroyRef);

  protected readonly LABELS = STUDIO_LABELS.window;
  protected readonly SIZE = WINDOW_CONTROL_BUTTON_SIZES.MD;
  protected readonly CLOSE_KIND = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;

  protected chrome = toSignal(windowChrome$().pipe(catchError(() => of(null))), { initialValue: null });

  protected round = computed(() => this.chrome()?.os === 'linux');

  protected shape = computed(() =>
    this.round() ? WINDOW_CONTROL_BUTTON_SHAPES.ROUND : WINDOW_CONTROL_BUTTON_SHAPES.SQUARE,
  );

  protected isMaximized = toSignal(
    fromEvent(globalThis, 'resize').pipe(
      startWith(null),
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
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
