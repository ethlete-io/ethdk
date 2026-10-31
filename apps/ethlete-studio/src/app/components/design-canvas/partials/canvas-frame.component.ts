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
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProvideColorDirective, injectSemanticColorTheme, signalHostElementIntersection } from '@ethlete/core';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  of,
  share,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import {
  CanvasFrame,
  ColorScheme,
  FOLLOWED_VIEWPORT_HEIGHT,
  FrameMessage,
  MeasuredSide,
  SCHEME_LABELS,
  croppedLayoutOf,
  followedSizes,
  frameMessageOf,
  schemeCopiesOf,
  withScheme,
} from '../canvas-frame';
import { Rect, Size } from '../canvas-math';
import { paintedFrame$ } from '../frame-paint';
import { RenderSlotState, injectFrameRenderQueue } from '../frame-render-queue';
import { CanvasFrameGridComponent } from './canvas-frame-grid.component';
import { FAILED_SHOT_SIZE, ShotStateComponent, ShotStateDirective } from './shot-state';

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

type Wanted = { kind: 'page' | 'shot'; src: string };

@Component({
  selector: 'ethlete-canvas-frame',
  template: `
    <ng-template #caption>
      @if (!captionBelow() && labelsSchemes() && copies()[0]; as copy) {
        <span class="shrink-0 uppercase tracking-[0.04em] text-text-muted" data-scheme-label>{{
          labelOf(copy.scheme)
        }}</span>
      }
      <span class="min-w-0 truncate" data-frame-label>{{ frame().label }}</span>
      @if (reload(); as state) {
        <span
          [class.animate-pulse]="state === 'rendering'"
          [title]="state === 'rendering' ? 'Rendering' : 'Waiting to render'"
          [attr.data-reload]="state"
          class="size-[0.6em] shrink-0 self-center rounded-full bg-accent"
        ></span>
      }
      @if (frame().width !== undefined) {
        <span class="shrink-0 tabular-nums text-text-muted">{{ width() }}</span>
      }
      @if (frame().note; as note) {
        <span class="shrink-0 tabular-nums text-text-muted" data-frame-note>{{ note }}</span>
      }
      @if (active()) {
        <span class="shrink-0 rounded-sm bg-accent px-[0.4em] text-on-accent" data-live-badge> Live · Esc </span>
      }
    </ng-template>
    @for (copy of copies(); track copy.scheme; let first = $first) {
      @if (labelsSchemes() && (!first || captionBelow())) {
        <span
          [style.left.px]="copy.x"
          [style.top.px]="copy.y"
          class="absolute -translate-y-full whitespace-nowrap pb-[0.4em] text-[length:calc(1.2rem_*_var(--et-design-canvas-label-scale))] uppercase tracking-[0.04em] text-text-muted"
          data-scheme-label
          >{{ labelOf(copy.scheme) }}</span
        >
      }
    }
    @if (captionPickable()) {
      <span
        [title]="'Comment on the state ' + frame().label"
        [class]="labelPlacement()"
        [style.max-width.px]="captionMaxWidth()"
        (click)="captionClick.emit($event)"
        (keydown.enter)="captionClick.emit($event)"
        class="absolute left-0 flex gap-[0.6em] overflow-hidden whitespace-nowrap text-text text-[length:calc(1.2rem_*_var(--et-design-canvas-label-scale))] cursor-crosshair"
        role="button"
        tabindex="0"
        data-comment-caption
      >
        <ng-container [ngTemplateOutlet]="caption" />
      </span>
    } @else {
      <span
        [class]="labelPlacement()"
        [style.max-width.px]="captionMaxWidth()"
        class="absolute left-0 flex gap-[0.6em] overflow-hidden whitespace-nowrap text-text text-[length:calc(1.2rem_*_var(--et-design-canvas-label-scale))]"
        ><ng-container [ngTemplateOutlet]="caption"
      /></span>
    }
    @if (frame().empty; as empty) {
      <div
        class="absolute inset-0 box-border flex items-center justify-center rounded-md border-2 border-dashed border-surface-border p-4 text-center text-[length:calc(1.3rem*min(var(--et-design-canvas-label-scale),2))] leading-tight text-text-muted"
        data-empty-cell
      >
        {{ empty }}
      </div>
    } @else if (frame().error) {
      <div
        [etProvideColor]="errorTheme()"
        class="absolute inset-0 box-border size-full overflow-hidden border-0 p-[1.6rem] font-[family-name:var(--font-mono)] text-[1.3rem] whitespace-pre-wrap text-(--et-theme-color-primary-solid)"
        role="alert"
      >
        {{ frame().error }}
      </div>
    } @else if (frame().grid; as grid) {
      <ethlete-canvas-frame-grid
        [grid]="grid"
        [live]="live()"
        [liveCells]="liveCells()"
        (sizeChange)="readGridSize($event)"
        (cellsChange)="cellsChange.emit($event)"
      />
    } @else if (cropped(); as cropped) {
      @if (frame().screenshot; as screenshot) {
        <div
          [style.width.px]="cropped.thumb.width"
          [style.height.px]="cropped.thumb.height"
          class="absolute top-0 left-0 overflow-hidden outline outline-surface-border"
          data-crop-thumb
        >
          <img
            [src]="screenshot"
            [style.transform]="'scale(' + cropped.thumb.scale + ')'"
            class="absolute top-0 left-0 max-w-none origin-top-left"
            alt=""
          />
          @for (outline of cropped.thumb.outlines; track $index) {
            <div
              [style.left.px]="outline.x"
              [style.top.px]="outline.y"
              [style.width.px]="outline.width"
              [style.height.px]="outline.height"
              class="absolute outline-2 outline-accent outline-solid"
              data-crop-outline
            ></div>
          }
        </div>
      }
      @for (view of cropped.views; track $index) {
        <div
          [style.top.px]="view.top"
          [style.width.px]="view.width"
          [style.height.px]="view.height"
          class="absolute left-0 overflow-hidden"
          data-crop-view
        >
          <div
            [style.width.px]="cropped.page.width"
            [style.height.px]="cropped.page.height"
            [style.transform]="'scale(' + view.scale + ') translate(' + -view.area.x + 'px, ' + -view.area.y + 'px)'"
            class="absolute top-0 left-0 origin-top-left"
          >
            @if ($first) {
              <ng-container [ngTemplateOutlet]="page" />
            } @else if (frame().screenshot; as screenshot) {
              <img
                [src]="live() ? screenshot : (admittedShot() ?? screenshot)"
                class="absolute inset-0 size-full border-0 object-none object-left-top"
                alt=""
              />
            }
          </div>
        </div>
      }
    } @else {
      <div
        [class]="copies().length > 0 ? 'absolute left-0 top-0 bg-surface' : 'absolute inset-0'"
        [style.width.px]="copies().length > 0 ? width() : null"
        [style.height.px]="copies().length > 0 ? height() : null"
        [attr.data-scheme-copy]="copies()[0]?.scheme ?? null"
      >
        <ng-container [ngTemplateOutlet]="page" />
      </div>
      @for (copy of laterCopies(); track copy.scheme) {
        <div
          [style.left.px]="copy.x"
          [style.top.px]="copy.y"
          [style.width.px]="width()"
          [style.height.px]="height()"
          [attr.data-scheme-copy]="copy.scheme"
          class="absolute overflow-hidden bg-surface"
        >
          @if (copy.shot) {
            <img
              #copyShot="ethleteShot"
              [src]="copy.shot"
              class="absolute inset-0 size-full border-0 object-none object-left-top"
              ethleteShot
              alt=""
            />
            @if (!live()) {
              <ethlete-shot-state [state]="copyShot.state()" />
            }
          }
          @if (live()) {
            <iframe
              [src]="copy.url"
              [title]="frame().label + ' ' + labelOf(copy.scheme)"
              [class.pointer-events-none]="!active()"
              [style.min-height.px]="frame().height === undefined ? FOLLOWED_VIEWPORT_HEIGHT : null"
              class="absolute inset-0 size-full border-0 [color-scheme:normal] group-data-[dragging]/canvas:pointer-events-none"
            ></iframe>
          }
        </div>
      }
    }
    <ng-template #page>
      @if (pageShot()) {
        <img
          #shot
          #pageShotState="ethleteShot"
          [src]="live() ? pageShot() : (admittedShot() ?? pageShot())"
          [class.opacity-0]="painted()"
          (load)="readScreenshotSize($event)"
          (error)="failScreenshot($event)"
          class="absolute inset-0 size-full border-0 object-none object-left-top"
          alt=""
          ethleteShot
        />
        @if (!painted()) {
          <ethlete-shot-state [state]="pageShotState.state()" />
        }
      } @else if (!painted()) {
        <div class="absolute inset-0 size-full border-0 bg-(--et-surface-interaction-solid)"></div>
      }
      @if (live() || painted()) {
        <div class="absolute inset-0 overflow-hidden">
          @for (source of sources(); track source.src) {
            <iframe
              #iframe
              [src]="source.url"
              [title]="frame().label"
              [class]="source.src !== shown() || !active() ? 'pointer-events-none' : ''"
              [class.opacity-0]="source.src !== shown()"
              [style.min-height.px]="frame().height === undefined ? FOLLOWED_VIEWPORT_HEIGHT : null"
              (load)="loadContent(iframe)"
              class="absolute inset-0 size-full border-0 [color-scheme:normal] group-data-[dragging]/canvas:pointer-events-none"
            ></iframe>
          }
        </div>
      }
    </ng-template>
    @if (frame().pending; as pending) {
      <div
        class="pointer-events-none absolute inset-0 flex items-start justify-center bg-surface/70 p-[calc(2.4rem_*_var(--et-design-canvas-label-scale))]"
        data-frame-pending
      >
        <span
          class="flex items-center gap-[0.6em] rounded-full border border-surface-border bg-surface px-[0.8em] py-[0.3em] text-[length:calc(1.4rem_*_var(--et-design-canvas-label-scale))] font-semibold whitespace-nowrap text-text shadow-md"
        >
          <span class="size-[0.6em] shrink-0 animate-pulse rounded-full bg-accent"></span>
          {{ pending }}
        </span>
      </div>
    }
    @if (!active()) {
      <div class="absolute inset-0 size-full border-0"></div>
    }
    @for (box of borderBoxes(); track $index) {
      <div
        [style.left.px]="box?.x ?? 0"
        [style.top.px]="box?.y ?? 0"
        [style.width.px]="box ? width() : null"
        [style.height.px]="box ? height() : null"
        [class.size-full]="!box"
        class="pointer-events-none absolute outline-[length:calc(0.1rem_*_var(--et-design-canvas-label-scale))] outline-surface-border outline-solid group-data-[active]/frame:outline-dashed group-data-[selected]/frame:outline-[length:calc(0.2rem_*_var(--et-design-canvas-label-scale))] group-data-[selected]/frame:outline-accent"
        data-frame-border
      ></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, ProvideColorDirective, CanvasFrameGridComponent, ShotStateDirective, ShotStateComponent],
  host: {
    class:
      'group/frame absolute block bg-surface data-[empty]:bg-transparent data-[schemed]:bg-transparent data-[unsized]:pointer-events-none data-[unsized]:opacity-0 data-[rejected]:opacity-40',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-active]': 'active() || null',
    '[attr.data-empty]': 'frame().empty !== undefined || null',
    '[attr.data-pending]': 'frame().pending !== undefined || null',
    '[attr.data-rejected]': 'frame().rejected || null',
    '[attr.data-fitted]': 'frame().width === undefined || null',
    '[attr.data-frame-id]': 'frame().id',
    '[attr.data-live]': 'live()',
    '[attr.data-schemed]': 'copies().length > 0 || null',
  },
})
export class CanvasFrameComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private sanitizer = inject(DomSanitizer);
  private queue = injectFrameRenderQueue();

  public frame = input.required<CanvasFrame>();
  /** The width of one scheme copy; the host spans every copy. */
  public width = input.required<number>();
  public height = input(0);
  public live = input(false);
  /** The grid cells that go live while `live`; `null` makes every cell live. */
  public liveCells = input<ReadonlySet<string> | null>(null);
  public active = input(false);
  public selected = input(false);
  public captionBelow = input(false);
  public captionPickable = input(false);

  public heightChange = output<number>();
  public widthChange = output<number>();
  public escapeKeydown = output();
  public captionClick = output<Event>();
  public cellsChange = output<Record<string, Rect>>();

  private iframes = viewChildren<ElementRef<HTMLIFrameElement>>('iframe');

  private shot = viewChild<ElementRef<HTMLImageElement>>('shot');
  private gridView = viewChild(CanvasFrameGridComponent);

  protected readonly FOLLOWED_VIEWPORT_HEIGHT = FOLLOWED_VIEWPORT_HEIGHT;

  public bordered = computed(
    () =>
      this.selected() ||
      (this.frame().empty === undefined && (this.frame().width !== undefined || this.frame().grid !== undefined)),
  );
  protected copies = computed(() => schemeCopiesOf(this.frame(), { width: this.width(), height: this.height() }));

  protected labelsSchemes = computed(() => this.copies().length > 1);

  protected captionMaxWidth = computed(() => ((this.copies()[1]?.x ?? 0) > 0 ? this.width() : null));

  private firstScheme = computed(() => this.copies()[0]?.scheme ?? null);

  private pageSrc = computed(() => this.schemed(this.frame().src, this.firstScheme()));

  protected pageShot = computed(() => this.schemed(this.frame().screenshot ?? '', this.firstScheme()));

  private laterSources = computed(
    () =>
      this.copies()
        .slice(1)
        .map((copy) => ({
          ...copy,
          src: this.schemed(this.frame().src, copy.scheme),
          shot: this.schemed(this.frame().screenshot ?? '', copy.scheme),
        })),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected laterCopies = computed(() =>
    this.laterSources().map((copy) => ({ ...copy, url: this.sanitizer.bypassSecurityTrustResourceUrl(copy.src) })),
  );

  protected borderBoxes = computed(() => {
    if (!this.bordered()) return [];

    const copies = this.copies();

    return copies.length > 0 ? copies : [null];
  });

  protected cropped = computed(() => {
    const crop = this.frame().crop;

    return crop ? croppedLayoutOf(crop) : null;
  });
  private drawn = computed(() => this.live() && this.frame().empty === undefined && !this.frame().error);

  /** The address of the iframe on show. A new address mounts a second iframe that replaces it once it painted. */
  protected shown = signal<string | null>(null);

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

      if (frame.empty !== undefined || frame.error || frame.grid) return null;
      if (this.live()) return { kind: 'page', src: this.pageSrc() };

      return frame.screenshot ? { kind: 'shot', src: this.pageShot() } : null;
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

  /** The window of the live page once it painted, to post messages to; `null` while the frame shows a shot. */
  public liveWindow = computed(() => {
    const iframe = this.newest();

    return iframe && this.shown() === this.sources().at(-1)?.src ? iframe.contentWindow : null;
  });

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
            ? paintedFrame$(iframe).pipe(
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

    toObservable(this.drawn)
      .pipe(
        switchMap((drawn) => (drawn ? EMPTY : this.decodedShot$())),
        tap((image) => {
          this.shown.set(null);

          const src = image?.getAttribute('src');

          if (!image || !src) return;

          this.loadedShot.set(src);
          this.emitScreenshotSize(image);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** The window of the grid cell `id` once its live page painted; `null` before or without that cell. */
  public liveCellWindowOf(id: string) {
    return this.gridView()?.liveWindowOf(id) ?? null;
  }

  protected labelOf(scheme: ColorScheme) {
    return SCHEME_LABELS[scheme];
  }

  protected readScreenshotSize(event: Event) {
    this.settleScreenshot(event);

    if (!this.painted()) this.emitScreenshotSize(event.target as HTMLImageElement);
  }

  protected failScreenshot(event: Event) {
    this.settleScreenshot(event);

    if (this.painted()) return;
    if (this.frame().width === undefined) this.widthChange.emit(FAILED_SHOT_SIZE.width);
    if (this.frame().height === undefined) this.heightChange.emit(FAILED_SHOT_SIZE.height);
  }

  protected readGridSize({ width, height }: Size) {
    this.widthChange.emit(width);
    this.heightChange.emit(height);
  }

  protected loadContent(iframe: HTMLIFrameElement) {
    this.contentLoad$.next(iframe);
  }

  private settleScreenshot(event: Event) {
    const src = (event.target as HTMLImageElement).getAttribute('src');

    if (this.live() || src === null) return;

    this.loadedShot.set(src);
    this.settled$.next(src);
  }

  private schemed(url: string, scheme: ColorScheme | null) {
    return scheme ? withScheme(url, scheme) : url;
  }

  private emitScreenshotSize(image: HTMLImageElement) {
    if (this.frame().width === undefined) this.widthChange.emit(image.naturalWidth);
    if (this.frame().height === undefined) this.heightChange.emit(image.naturalHeight);
  }

  private decodedShot$() {
    const image = this.shot()?.nativeElement;

    if (!this.painted()) return EMPTY;
    if (!image || this.frame().error || this.frame().empty !== undefined) return of(null);

    return defer(() => image.decode()).pipe(
      map(() => image),
      catchError(() => of(null)),
    );
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

    if (!content || !view || content.URL === 'about:blank') return EMPTY;

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
