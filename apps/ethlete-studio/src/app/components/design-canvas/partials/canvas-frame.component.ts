import { Component, ElementRef, ViewEncapsulation, computed, inject, input, output, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
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
    <span class="et-canvas-frame__label">
      {{ frame().label }}
      <span class="et-canvas-frame__width">{{ width() }}</span>
    </span>
    @if (frame().error) {
      <div class="et-canvas-frame__error" etProvideColor="danger" role="alert">{{ frame().error }}</div>
    } @else {
      @if (!painted()) {
        @if (frame().screenshot) {
          <img [src]="frame().screenshot" class="et-canvas-frame__screenshot" alt="" />
        } @else {
          <div class="et-canvas-frame__placeholder"></div>
        }
      }
      @if (live()) {
        <iframe
          #iframe
          [src]="source()"
          [title]="frame().label"
          [class.et-canvas-frame__iframe--painted]="painted()"
          (load)="loadContent(iframe)"
          class="et-canvas-frame__iframe"
        ></iframe>
      }
    }
    @if (!active()) {
      <div class="et-canvas-frame__shield"></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: {
    class: 'et-canvas-frame',
    '[class.et-canvas-frame--selected]': 'selected()',
    '[class.et-canvas-frame--active]': 'active()',
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

  public heightChange = output<number>();
  public escapeKeydown = output();

  protected iframe = viewChild<ElementRef<HTMLIFrameElement>>('iframe');

  protected source = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.frame().src));

  protected painted = toSignal(
    toObservable(this.iframe).pipe(switchMap((iframe) => (iframe ? painted$(iframe.nativeElement) : of(false)))),
    { initialValue: false },
  );

  private contentLoad$ = new Subject<HTMLIFrameElement>();

  constructor() {
    merge(this.contentLoad$, toObservable(this.live).pipe(filter((live) => !live)))
      .pipe(
        switchMap((iframe) => (typeof iframe === 'boolean' ? EMPTY : this.watchContent$(iframe))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected loadContent(iframe: HTMLIFrameElement) {
    this.contentLoad$.next(iframe);
  }

  private watchContent$(iframe: HTMLIFrameElement) {
    const content = iframe.contentDocument;
    const view = content?.defaultView;

    if (!content || !view) return this.watchMessages$(iframe);

    const root = content.documentElement;
    const height$ = new Observable<number>((subscriber) => {
      const observer = new view.ResizeObserver(() => subscriber.next(Math.ceil(root.getBoundingClientRect().height)));

      observer.observe(root);

      return () => observer.disconnect();
    });

    return merge(
      height$.pipe(tap((height) => this.heightChange.emit(height))),
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
        if (message?.type === 'escape') this.escapeKeydown.emit();
      }),
    );
  }
}
