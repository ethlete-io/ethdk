import { Directive, ElementRef, InjectionToken, Signal, computed, effect, inject, input } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { ShownShots, showShots } from '../../../../host/design';

const SHOT_PATH = '/__design/shot?';

const HELD_PICTURES = 500;

const counted = (counts: Map<string, number>, { url, by }: { url: string; by: 1 | -1 }) => {
  const count = (counts.get(url) ?? 0) + by;

  if (count > 0) counts.set(url, count);
  else counts.delete(url);
};

/**
 * The shot pictures mounted now, posted to their design server once per change so it draws them first: the
 * shots of the active frame, then the other shown ones, then those of a view no longer shown.
 */
export class ShotBoard {
  private shown = new Map<string, number>();
  private active = new Map<string, number>();
  private posted = new Map<string, string>();
  private held = new Map<string, HTMLImageElement>();
  private view = 0;
  private flushQueued = false;

  /** Keeps the loaded picture of `url` in the document, so a later `<img>` with that URL paints it in its first frame. */
  public hold(url: string) {
    if (!url.includes(SHOT_PATH)) return;

    const picture = this.held.get(url) ?? new Image();

    this.held.delete(url);
    this.held.set(url, picture);
    if (!picture.src) picture.src = url;

    for (const oldest of this.held.keys()) {
      if (this.held.size <= HELD_PICTURES) break;
      this.held.delete(oldest);
    }
  }

  public show(url: string, active: boolean) {
    if (!url.includes(SHOT_PATH) || !URL.canParse(url)) return () => undefined;

    this.change({ url, active, by: 1 });

    return () => this.change({ url, active, by: -1 });
  }

  private change({ url, active, by }: { url: string; active: boolean; by: 1 | -1 }) {
    counted(this.shown, { url, by });
    if (active) counted(this.active, { url, by });
    if (this.flushQueued) return;

    this.flushQueued = true;
    queueMicrotask(() => this.flush());
  }

  private flush() {
    this.flushQueued = false;

    const byOrigin = new Map<string, Omit<ShownShots, 'view'>>();
    const listOf = (url: string) => {
      const { origin } = new URL(url);
      const list = byOrigin.get(origin) ?? { shown: [], active: [] };

      byOrigin.set(origin, list);

      return list;
    };

    this.posted.forEach((_body, origin) => byOrigin.set(origin, { shown: [], active: [] }));
    this.shown.forEach((_count, url) => listOf(url).shown.push(url));
    this.active.forEach((_count, url) => listOf(url).active.push(url));

    byOrigin.forEach((shots, origin) => {
      const body = JSON.stringify(shots);

      if (this.posted.get(origin) === body) return;

      this.posted.set(origin, body);
      this.view = Math.max(Date.now(), this.view + 1);
      void showShots(origin, { view: this.view, ...shots });
    });
  }
}

/**
 * The fetch priority of the shot pictures below its provider: `high` asks for every picture at once, off-screen ones too,
 * where the browser would otherwise hold them back.
 */
export const SHOT_FETCH_PRIORITY = new InjectionToken<Signal<'high' | null>>('SHOT_FETCH_PRIORITY');

const SHOT_BOARD_DEF = /* @__PURE__ */ defineRootProvider(() => new ShotBoard());

export const injectShotBoard = /* @__PURE__ */ toInjectFn(SHOT_BOARD_DEF);

/**
 * Puts the shot this picture loads on the `ShotBoard` while it is mounted, `shotRankActive` for the frame worked in,
 * and holds the picture once loaded.
 */
@Directive({
  selector: 'img[ethleteShotRank]',
  host: { '[attr.fetchpriority]': 'fetchPriority()', '(load)': 'loaded()' },
})
export class ShotRankDirective {
  private board = injectShotBoard();
  private image = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private priority = inject(SHOT_FETCH_PRIORITY, { optional: true });

  public ethleteShotRank = input.required<string>();

  public shotRankActive = input(false);
  protected fetchPriority = computed(() => this.priority?.() ?? null);

  constructor() {
    effect((onCleanup) => onCleanup(this.board.show(this.ethleteShotRank(), this.shotRankActive())));
  }

  protected loaded() {
    this.board.hold(this.image.nativeElement.src);
  }
}
