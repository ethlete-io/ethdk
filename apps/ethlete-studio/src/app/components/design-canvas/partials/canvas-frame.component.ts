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
  share,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { CanvasFrame, FrameMessage, MeasuredSide, followedSizes, frameMessageOf } from '../canvas-frame';
import { RenderSlotState, injectFrameRenderQueue } from '../frame-render-queue';

const UNREPORTED_PAINT_MS = 1000;

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

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
        <span class="tabular-nums text-[var(--et-surface-color-muted-solid)]">{{ width() }}</span>
      }
      @if (frame().note; as note) {
        <span class="tabular-nums text-[var(--et-surface-color-muted-solid)]" data-frame-note>{{ note }}</span>
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
        [class]="labelPlacement()"
        (click)="captionClick.emit($event)"
        (keydown.enter)="captionClick.emit($event)"
        class="absolute left-0 flex gap-[0.6em] whitespace-nowrap text-[var(--et-surface-color-solid)] text-[length:calc(1.2rem_*_var(--et-design-canvas-label-scale))] cursor-crosshair"
        role="button"
        tabindex="0"
        data-comment-caption
      >
        <ng-container [ngTemplateOutlet]="caption" />
      </span>
    } @else {
      <span
        [class]="labelPlacement()"
        class="absolute left-0 flex gap-[0.6em] whitespace-nowrap text-[var(--et-surface-color-solid)] text-[length:calc(1.2rem_*_var(--et-design-canvas-label-scale))]"
        ><ng-container [ngTemplateOutlet]="caption"
      /></span>
    }
    @if (frame().empty; as empty) {
      <div
        class="absolute inset-0 box-border flex items-center justify-center rounded-md border-2 border-dashed border-[var(--et-surface-border-solid)] p-4 text-center text-[calc(1.3rem*var(--et-design-canvas-label-scale))] text-[var(--et-surface-color-muted-solid)]"
        data-empty-cell
      >
        {{ empty }}
      </div>
    } @else if (frame().error) {
      <div
        [etProvideColor]="errorTheme()"
        class="absolute inset-0 box-border size-full overflow-hidden border-0 p-[1.6rem] font-[family-name:var(--font-mono)] text-[1.3rem] whitespace-pre-wrap text-[var(--et-theme-color-primary-solid)]"
        role="alert"
      >
        {{ frame().error }}
      </div>
    } @else {
      @if (!painted()) {
        @if (frame().screenshot) {
          <img
            [src]="live() ? frame().screenshot : (admittedShot() ?? frame().screenshot)"
            (load)="readScreenshotSize($event)"
            (error)="settleScreenshot($event)"
            class="absolute inset-0 size-full border-0 object-none object-left-top"
            alt=""
          />
        } @else {
          <div class="absolute inset-0 size-full border-0 bg-[var(--et-surface-interaction-solid)]"></div>
        }
      }
      @if (live()) {
        @for (source of sources(); track source.src) {
          <iframe
            #iframe
            [src]="source.url"
            [title]="frame().label"
            [class]="source.src !== shown() || !active() ? 'pointer-events-none' : ''"
            [class.opacity-0]="source.src !== shown()"
            (load)="loadContent(iframe)"
            class="absolute inset-0 size-full border-0 [color-scheme:normal] group-data-[dragging]/canvas:pointer-events-none"
          ></iframe>
        }
      }
    }
    @if (!active()) {
      <div class="absolute inset-0 size-full border-0"></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, ProvideColorDirective],
  host: {
    class:
      'absolute block bg-[var(--et-surface-background-solid)] outline-[length:calc(0.1rem_*_var(--et-design-canvas-label-scale))] outline-[color:var(--et-surface-border-solid)] outline-solid data-[active]:outline-dashed data-[empty]:bg-transparent data-[empty]:not-data-[selected]:outline-none data-[fitted]:not-data-[selected]:outline-none data-[selected]:outline-[length:calc(0.2rem_*_var(--et-design-canvas-label-scale))] data-[selected]:outline-[color:var(--et-theme-color-primary-solid)] data-[unsized]:pointer-events-none data-[unsized]:opacity-0',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-active]': 'active() || null',
    '[attr.data-empty]': 'frame().empty !== undefined || null',
    '[attr.data-fitted]': 'frame().width === undefined || null',
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

  protected labelPlacement = computed(() => (this.captionBelow() ? 'top-full pt-[0.4em]' : 'bottom-full pb-[0.4em]'));

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
    const height$ = new Observable<MeasuredSide>((subscriber) => {
      const observer = new view.ResizeObserver(() =>
        subscriber.next({ size: Math.ceil(root.getBoundingClientRect().height), viewport: iframe.clientHeight }),
      );

      observer.observe(root);

      return () => observer.disconnect();
    });

    const fitted = content.body.firstElementChild;
    const width$ =
      this.frame().width === undefined && fitted
        ? new Observable<MeasuredSide>((subscriber) => {
            const observer = new view.ResizeObserver(() =>
              subscriber.next({ size: Math.ceil(fitted.getBoundingClientRect().width), viewport: iframe.clientWidth }),
            );

            observer.observe(fitted);

            return () => observer.disconnect();
          })
        : EMPTY;

    return merge(
      height$.pipe(
        followedSizes,
        tap((height) => this.heightChange.emit(height)),
      ),
      width$.pipe(
        followedSizes,
        tap((width) => this.widthChange.emit(width)),
      ),
    );
  }

  private watchMessages$(iframe: HTMLIFrameElement) {
    const host = iframe.ownerDocument.defaultView;

    if (!host) return EMPTY;

    const messages$ = fromEvent<MessageEvent>(host, 'message').pipe(
      filter((event) => !!iframe.contentWindow && event.source === iframe.contentWindow),
      map(({ data }) => frameMessageOf(data)),
      share(),
    );
    const reports$ = messages$.pipe(filter((message): message is HeightMessage => message?.type === 'height'));

    return merge(
      reports$.pipe(
        map((report) => ({ size: report.height, viewport: report.viewport?.height })),
        followedSizes,
        tap((height) => this.heightChange.emit(height)),
      ),
      reports$.pipe(
        map((report) => (report.width === undefined ? null : { size: report.width, viewport: report.viewport?.width })),
        filter((measure) => measure !== null),
        followedSizes,
        tap((width) => this.widthChange.emit(width)),
      ),
      messages$.pipe(
        filter((message) => message?.type === 'escape'),
        tap(() => this.escapeKeydown.emit()),
      ),
    );
  }
}
