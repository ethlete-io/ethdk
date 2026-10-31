import { Component, Directive, ViewEncapsulation, computed, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { map, switchMap, tap, timer } from 'rxjs';

export type ShotState = 'loading' | 'slow' | 'loaded' | 'failed';

export const SLOW_SHOT_MS = 2000;

export const FAILED_SHOT_SIZE = { width: 320, height: 160 };

@Directive({
  selector: 'img[ethleteShot]',
  exportAs: 'ethleteShot',
  host: {
    '[src]': 'src()',
    '[attr.data-shot-state]': 'state()',
    '(load)': 'settled.set("loaded")',
    '(error)': 'settled.set("failed")',
  },
})
export class ShotStateDirective {
  public src = input.required<string>();

  protected settled = linkedSignal<string, 'loaded' | 'failed' | null>({ source: this.src, computation: () => null });

  private slowSrc = signal<string | null>(null);

  public state = computed<ShotState>(() => this.settled() ?? (this.slowSrc() === this.src() ? 'slow' : 'loading'));

  constructor() {
    toObservable(this.src)
      .pipe(
        switchMap((src) => timer(SLOW_SHOT_MS).pipe(map(() => src))),
        tap((src) => this.slowSrc.set(src)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}

@Component({
  selector: 'ethlete-shot-state',
  template: `
    @if (state() === 'failed') {
      <div
        [etProvideColor]="errorTheme()"
        class="absolute inset-0 flex items-center justify-center bg-surface p-[0.8em] text-center text-[length:calc(1.3rem*min(var(--et-design-canvas-label-scale,1),2))] text-(--et-theme-color-primary-solid)"
        role="alert"
        data-shot-failed
      >
        Render failed
      </div>
    } @else if (state() === 'slow') {
      <span
        class="absolute top-[0.8em] right-[0.8em] flex items-center gap-[0.4em] rounded-full border border-surface-border bg-surface px-[0.6em] py-[0.2em] text-[length:calc(1.1rem*min(var(--et-design-canvas-label-scale,1),2))] text-text-muted"
        data-shot-slow
      >
        <i class="size-[0.6em] shrink-0 animate-pulse rounded-full bg-accent"></i>
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
}
