import {
  Component,
  Directive,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ProvideColorDirective, defineRootProvider, injectSemanticColorTheme, toInjectFn } from '@ethlete/core';
import { CANVAS_LABELS } from '../../../i18n/canvas-labels';
import { Subject, filter, map, switchMap, tap, timer } from 'rxjs';

export type ShotState = 'loading' | 'slow' | 'loaded' | 'failed';

export const SLOW_SHOT_MS = 2000;

export const SHOT_RETRY_MS = 1000;

export const FAILED_SHOT_SIZE = { width: 320, height: 160 };

const FAILED_SHOTS_DEF = /* @__PURE__ */ defineRootProvider(() => ({ count: signal(0) }));

export const injectFailedShots = /* @__PURE__ */ toInjectFn(FAILED_SHOTS_DEF);

@Directive({
  selector: 'img[ethleteShot]',
  exportAs: 'ethleteShot',
  host: {
    '[src]': 'src()',
    '[attr.data-shot-state]': 'state()',
    '(load)': 'settled.set("loaded")',
    '(error)': 'retryOrFail()',
  },
})
export class ShotStateDirective {
  private image = inject<ElementRef<HTMLImageElement>>(ElementRef);

  public src = input.required<string>();

  protected settled = linkedSignal<string, 'loaded' | 'failed' | null>({ source: this.src, computation: () => null });

  private retried = linkedSignal<string, boolean>({ source: this.src, computation: () => false });

  private retries$ = new Subject<string>();

  private slowSrc = signal<string | null>(null);

  public state = computed<ShotState>(() => this.settled() ?? (this.slowSrc() === this.src() ? 'slow' : 'loading'));

  constructor() {
    const failedShots = injectFailedShots();

    effect((onCleanup) => {
      if (this.state() !== 'failed') return;

      failedShots.count.update((count) => count + 1);
      onCleanup(() => failedShots.count.update((count) => count - 1));
    });

    this.retries$
      .pipe(
        switchMap((src) => timer(SHOT_RETRY_MS).pipe(map(() => src))),
        filter((src) => src === this.src()),
        tap(() => (this.image.nativeElement.src = this.src())),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.src)
      .pipe(
        switchMap((src) => timer(SLOW_SHOT_MS).pipe(map(() => src))),
        tap((src) => this.slowSrc.set(src)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected retryOrFail() {
    if (this.retried()) {
      this.settled.set('failed');

      return;
    }

    this.retried.set(true);
    this.retries$.next(this.src());
  }
}

@Component({
  selector: 'ethlete-shot-state',
  template: `
    @if (state() === 'failed') {
      <div
        [etProvideColor]="errorTheme()"
        class="absolute inset-0 flex items-center justify-center bg-(--et-surface-background-solid) p-[0.8em] text-center text-[calc(1.3rem*min(var(--et-design-canvas-label-scale,1),2))] text-(--et-theme-color-primary-solid)"
        role="alert"
        data-shot-failed
      >
        {{ LABELS.renderFailed }}
      </div>
    } @else if (state() === 'slow') {
      <span
        class="absolute top-[0.8em] right-[0.8em] flex items-center gap-[0.4em] rounded-full border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) px-[0.6em] py-[0.2em] text-[calc(1.1rem*min(var(--et-design-canvas-label-scale,1),2))] text-text-muted"
        data-shot-slow
      >
        <i class="size-[0.6em] shrink-0 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></i>
        Rendering
      </span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: { class: 'contents' },
})
export class ShotStateComponent {
  protected errorTheme = injectSemanticColorTheme('error');

  public state = input.required<ShotState>();

  protected readonly LABELS = CANVAS_LABELS;
}
