import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProvideColorDirective, injectSemanticColorTheme, signalHostElementIntersection } from '@ethlete/core';
import {
  EMPTY,
  Observable,
  Subject,
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { CanvasFrame, frameMessageOf } from '../canvas-frame';
import { RenderSlotState, injectFrameRenderQueue } from '../frame-render-queue';

const UNREPORTED_PAINT_MS = 1000;

type Wanted = { kind: 'page' | 'shot'; src: string };

const nextPaint$ = (view: Window) =>
  new Observable<void>((subscriber) => {
    let frame = view.requestAnimationFrame(() => {
      frame = view.requestAnimationFrame(() => {
        subscriber.next();
        subscriber.complete();
      });
    });

    return () => view.cancelAnimationFrame(frame);
  });

const painted$ = (iframe: HTMLIFrameElement) => {
  const host = iframe.ownerDocument.defaultView;

  if (!host) return of(true);

  const reported$ = fromEvent<MessageEvent>(host, 'message').pipe(
    filter((event) => event.source === iframe.contentWindow && frameMessageOf(event.data)?.type === 'height'),
  );
  const loadedSilently$ = fromEvent(iframe, 'load').pipe(switchMap(() => timer(UNREPORTED_PAINT_MS)));

  return merge(reported$, loadedSilently$).pipe(
    take(1),
    switchMap(() => nextPaint$(host)),
    map(() => true),
    startWith(false),
  );
};

@Component({
  selector: 'ethlete-canvas-frame',
  template: `
    <ng-template #caption>
      {{ frame().label }}
      @if (reload(); as state) {
        <span
          [class.animate-pulse]="state === 'rendering'"
          [title]="state === 'rendering' ? 'Rendering' : 'Waiting to render'"
          [attr.data-reload]="state"
          class="size-[0.6em] shrink-0 self-center rounded-full bg-[var(--et-theme-color-primary-solid)]"
        ></span>
      }
      @if (frame().width !== undefined) {
        <span class="et-canvas-frame__width">{{ width() }}</span>
      }
      @if (frame().note; as note) {
        <span class="et-canvas-frame__width" data-frame-note>{{ note }}</span>
      }
      @if (active()) {
        <span
          class="rounded-sm bg-[var(--et-theme-color-primary-solid)] px-[0.4em] text-[var(--et-theme-color-on-primary)]"
          data-live-badge
        >
          Live · Esc
        </span>
      }
    </ng-template>
    @if (captionPickable()) {
      <span
        [title]="'Comment on the state ' + frame().label"
        (click)="captionClick.emit($event)"
        (keydown.enter)="captionClick.emit($event)"
        class="et-canvas-frame__label cursor-crosshair"
        role="button"
        tabindex="0"
        data-comment-caption
      >
        <ng-container [ngTemplateOutlet]="caption" />
      </span>
    } @else {
      <span class="et-canvas-frame__label"><ng-container [ngTemplateOutlet]="caption" /></span>
    }
    @if (frame().empty; as empty) {
      <div
        class="absolute inset-0 box-border flex items-center justify-center rounded-md border-2 border-dashed border-[var(--et-surface-border-solid)] p-4 text-center text-[calc(1.3rem*var(--et-design-canvas-label-scale))] text-[var(--et-surface-color-muted-solid)]"
        data-empty-cell
      >
        {{ empty }}
      </div>
    } @else if (frame().error) {
      <div [etProvideColor]="errorTheme()" class="et-canvas-frame__error" role="alert">{{ frame().error }}</div>
    } @else {
      @if (!painted()) {
        @if (frame().screenshot) {
          <img
            [src]="live() ? frame().screenshot : (admittedShot() ?? frame().screenshot)"
            (load)="readScreenshotSize($event)"
            (error)="settleScreenshot($event)"
            class="et-canvas-frame__screenshot"
            alt=""
          />
        } @else {
          <div class="et-canvas-frame__placeholder"></div>
        }
      }
      @if (live()) {
        @for (source of sources(); track source.src) {
          <iframe
            #iframe
            [src]="source.url"
            [title]="frame().label"
            [class.et-canvas-frame__iframe--painted]="source.src === shown()"
            (load)="loadContent(iframe)"
            class="et-canvas-frame__iframe"
          ></iframe>
        }
      }
    }
    @if (!active()) {
      <div class="et-canvas-frame__shield"></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, ProvideColorDirective],
  host: {
    class: 'et-canvas-frame',
    '[class.et-canvas-frame--selected]': 'selected()',
    '[class.et-canvas-frame--active]': 'active()',
    '[class.et-canvas-frame--empty]': 'frame().empty !== undefined',
    '[class.et-canvas-frame--fitted]': 'frame().width === undefined',
    '[class.et-canvas-frame--caption-below]': 'captionBelow()',
    '[attr.data-frame-id]': 'frame().id',
    '[attr.data-live]': 'live()',
  },
})
export class CanvasFrameComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private sanitizer = inject(DomSanitizer);
  private queue = injectFrameRenderQueue();

  public frame = input.required<CanvasFrame>();
  public width = input.required<number>();
  public live = input(false);
  public active = input(false);
  public selected = input(false);
  public captionBelow = input(false);
  public captionPickable = input(false);

  public heightChange = output<number>();
  public widthChange = output<number>();
  public escapeKeydown = output();
  public captionClick = output<Event>();

  private iframes = viewChildren<ElementRef<HTMLIFrameElement>>('iframe');

  private drawn = computed(() => this.live() && this.frame().empty === undefined && !this.frame().error);

  /** The address of the iframe on show. A new address mounts a second iframe that replaces it once it painted. */
  protected shown = linkedSignal<boolean, string | null>({ source: () => this.drawn(), computation: () => null });

  protected painted = computed(() => this.shown() !== null);

  private admittedPage = linkedSignal<boolean, string | null>({ source: () => this.drawn(), computation: () => null });

  protected admittedShot = signal<string | null>(null);

  private loadedShot = linkedSignal<boolean, string | null>({
    source: () => this.live() || !!this.frame().error,
    computation: () => null,
  });

  private settled$ = new Subject<string>();

  /** Set while the frame waits for a render slot or renders a new address over the one it shows. */
  protected reload = signal<RenderSlotState | null>(null);

  private intersection = signalHostElementIntersection();

  private visible = computed(() => this.intersection()[0]?.isIntersecting ?? false);

  private wanted = computed<Wanted | null>(
    () => {
      const frame = this.frame();

      if (frame.empty !== undefined || frame.error) return null;
      if (this.live()) return { kind: 'page', src: frame.src };

      return frame.screenshot ? { kind: 'shot', src: frame.screenshot } : null;
    },
    { equal: (a, b) => a?.kind === b?.kind && a?.src === b?.src },
  );

  protected sources = linkedSignal<string[], { src: string; url: SafeResourceUrl }[]>({
    source: () => [...new Set([this.shown(), this.admittedPage()])].filter((src): src is string => src !== null),
    computation: (addresses, previous) =>
      addresses.map(
        (src) =>
          previous?.value.find((source) => source.src === src) ?? {
            src,
            url: this.sanitizer.bypassSecurityTrustResourceUrl(src),
          },
      ),
  });

  private newest = computed(() => this.iframes().at(-1)?.nativeElement ?? null);

  private contentLoad$ = new Subject<HTMLIFrameElement>();

  constructor() {
    toObservable(this.wanted)
      .pipe(
        switchMap((wanted) => (wanted ? this.admit$(wanted) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();

    merge(this.contentLoad$, toObservable(this.live).pipe(filter((live) => !live)))
      .pipe(
        switchMap((iframe) => (typeof iframe === 'boolean' ? EMPTY : this.watchContent$(iframe))),
        takeUntilDestroyed(),
      )
      .subscribe();

    // A cross-origin frame page posts its first size before its load event, so listen from the moment the iframe exists.
    toObservable(this.newest)
      .pipe(
        switchMap((iframe) => (iframe ? this.watchMessages$(iframe) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.newest)
      .pipe(
        switchMap((iframe) => {
          const src = iframe && this.sources().at(-1)?.src;

          return iframe && src
            ? painted$(iframe).pipe(
                filter(Boolean),
                map(() => src),
              )
            : EMPTY;
        }),
        tap((src) => {
          this.shown.set(src);
          this.settled$.next(src);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readScreenshotSize(event: Event) {
    const image = event.target as HTMLImageElement;

    this.settleScreenshot(event);

    if (this.frame().width === undefined) this.widthChange.emit(image.naturalWidth);
    if (this.frame().height === undefined) this.heightChange.emit(image.naturalHeight);
  }

  protected settleScreenshot(event: Event) {
    const src = (event.target as HTMLImageElement).getAttribute('src');

    if (this.live() || src === null) return;

    this.loadedShot.set(src);
    this.settled$.next(src);
  }

  protected loadContent(iframe: HTMLIFrameElement) {
    this.contentLoad$.next(iframe);
  }

  private admit$({ kind, src }: Wanted) {
    const admitted = kind === 'page' ? this.admittedPage : this.admittedShot;
    const current = kind === 'page' ? this.shown : this.loadedShot;
    const shown = current();

    if (shown === null || shown === src) {
      admitted.set(src);
      this.reload.set(null);

      return EMPTY;
    }

    return this.queue
      .slot$(() => this.visible())
      .pipe(
        tap((state) => {
          this.reload.set(state);
          if (state === 'rendering') admitted.set(src);
        }),
        takeUntil(this.settled$.pipe(filter((painted) => painted === src))),
        finalize(() => this.reload.set(null)),
      );
  }

  private watchContent$(iframe: HTMLIFrameElement) {
    const content = iframe.contentDocument;
    const view = content?.defaultView;

    if (!content || !view) return EMPTY;

    const root = content.documentElement;
    const height$ = new Observable<number>((subscriber) => {
      const observer = new view.ResizeObserver(() => subscriber.next(Math.ceil(root.getBoundingClientRect().height)));

      observer.observe(root);

      return () => observer.disconnect();
    });

    const fitted = content.body.firstElementChild;
    const width$ =
      this.frame().width === undefined && fitted
        ? new Observable<number>((subscriber) => {
            const observer = new view.ResizeObserver(() =>
              subscriber.next(Math.ceil(fitted.getBoundingClientRect().width)),
            );

            observer.observe(fitted);

            return () => observer.disconnect();
          })
        : EMPTY;

    return merge(
      height$.pipe(tap((height) => this.heightChange.emit(height))),
      width$.pipe(tap((width) => this.widthChange.emit(width))),
    );
  }

  private watchMessages$(iframe: HTMLIFrameElement) {
    const host = iframe.ownerDocument.defaultView;

    if (!host) return EMPTY;

    return fromEvent<MessageEvent>(host, 'message').pipe(
      filter((event) => !!iframe.contentWindow && event.source === iframe.contentWindow),
      tap(({ data }) => {
        const message = frameMessageOf(data);

        if (message?.type === 'height') this.heightChange.emit(message.height);
        if (message?.type === 'height' && message.width !== undefined) this.widthChange.emit(message.width);
        if (message?.type === 'escape') this.escapeKeydown.emit();
      }),
    );
  }
}
