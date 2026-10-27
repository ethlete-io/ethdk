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
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProvideColorDirective } from '@ethlete/core';
import {
  EMPTY,
  Observable,
  Subject,
  filter,
  fromEvent,
  map,
  merge,
  of,
  startWith,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import { CanvasFrame, frameMessageOf } from '../canvas-frame';

const UNREPORTED_PAINT_MS = 1000;

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
      @if (frame().width !== undefined) {
        <span class="et-canvas-frame__width">{{ width() }}</span>
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
    @if (frame().error) {
      <div class="et-canvas-frame__error" etProvideColor="danger" role="alert">{{ frame().error }}</div>
    } @else {
      @if (!painted()) {
        @if (frame().screenshot) {
          <img
            [src]="frame().screenshot"
            (load)="readScreenshotSize($event)"
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
    '[class.et-canvas-frame--caption-below]': 'captionBelow()',
    '[attr.data-frame-id]': 'frame().id',
    '[attr.data-live]': 'live()',
  },
})
export class CanvasFrameComponent {
  private sanitizer = inject(DomSanitizer);

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

  /** The address of the iframe on show. A new address mounts a second iframe that replaces it once it painted. */
  protected shown = linkedSignal<boolean, string | null>({ source: this.live, computation: () => null });

  protected painted = computed(() => this.shown() !== null);

  protected sources = linkedSignal<string[], { src: string; url: SafeResourceUrl }[]>({
    source: () => [...new Set([this.shown(), this.frame().src])].filter((src): src is string => src !== null),
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
        tap((src) => this.shown.set(src)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readScreenshotSize(event: Event) {
    const image = event.target as HTMLImageElement;

    if (this.frame().width === undefined) this.widthChange.emit(image.naturalWidth);
    if (this.frame().height === undefined) this.heightChange.emit(image.naturalHeight);
  }

  protected loadContent(iframe: HTMLIFrameElement) {
    this.contentLoad$.next(iframe);
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
      fromEvent<KeyboardEvent>(view, 'keydown').pipe(
        filter((event) => event.key === 'Escape'),
        tap(() => this.escapeKeydown.emit()),
      ),
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
