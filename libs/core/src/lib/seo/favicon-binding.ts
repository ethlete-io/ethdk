import { isPlatformBrowser } from '@angular/common';
import { computed, DOCUMENT, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { MaybeSignal } from '../signals';
import { defineRootProvider, toInjectFn, toProvideFn } from '../utils';
import { applyHeadBinding } from './head-binding';

/**
 * Something drawn on top of the site's favicon.
 *
 * - `dot` — a filled badge punched into the bottom-right corner, the "something happened here" marker.
 * - `progress` — a ring around the icon, `value` in percent (`0`–`100`). The browser exposes no
 *   taskbar/tab progress API, so a favicon ring (or a percentage in the title) is as close as the web
 *   gets to one.
 */
export type FaviconOverlay =
  { kind: 'dot'; color?: string } | { kind: 'progress'; value: number; color?: string; trackColor?: string };

/** The rendered favicon is this many device-independent pixels square. */
const FAVICON_SIZE = 64;

/** Fallback when the color theming tokens aren't resolvable (no theme applied to the root element). */
const FALLBACK_OVERLAY_COLOR = '#e11d48';

const readThemeColor = (document: Document) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--et-theme-color-primary-solid').trim();

  return value || FALLBACK_OVERLAY_COLOR;
};

const drawDot = (ctx: CanvasRenderingContext2D, color: string) => {
  const radius = FAVICON_SIZE * 0.19;
  const center = FAVICON_SIZE - radius - 3;

  // Punch a hole first so the badge reads on top of a busy icon, then fill it.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(center, center, radius * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};

const drawProgress = (ctx: CanvasRenderingContext2D, value: number, color: string, trackColor: string) => {
  const lineWidth = FAVICON_SIZE * 0.14;
  const radius = (FAVICON_SIZE - lineWidth) / 2;
  const center = FAVICON_SIZE / 2;
  const clamped = Math.min(100, Math.max(0, value));
  const start = -Math.PI / 2;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';

  // Clear the ring's lane so the base icon doesn't show through a semi-transparent track.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = trackColor;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (clamped > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(center, center, radius, start, start + (Math.PI * 2 * clamped) / 100);
    ctx.stroke();
  }
};

const FAVICON_STORE_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const document = inject(DOCUMENT);
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const overlays = signal<Map<symbol, FaviconOverlay>>(new Map());

    const activeOverlay = computed<FaviconOverlay | null>(() => {
      const all = Array.from(overlays().values());

      return all.find((overlay) => overlay.kind === 'progress') ?? all[all.length - 1] ?? null;
    });

    let iconLink: HTMLLinkElement | null = null;
    let createdIconLink = false;
    let originalHref: string | null = null;
    let baseImage: HTMLImageElement | null = null;
    let baseImageFailed = false;

    const resolveIconLink = () => {
      if (iconLink) {
        return iconLink;
      }

      iconLink = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');

      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
        createdIconLink = true;
      }

      originalHref = createdIconLink ? null : iconLink.getAttribute('href');

      return iconLink;
    };

    const restore = () => {
      if (!iconLink) return;

      if (createdIconLink) {
        iconLink.remove();
        iconLink = null;
        createdIconLink = false;

        return;
      }

      if (originalHref === null) {
        iconLink.removeAttribute('href');
      } else {
        iconLink.setAttribute('href', originalHref);
      }
    };

    // The base icon is loaded once and reused; a favicon that can't be read (cross-origin without
    // CORS headers, an SVG without intrinsic size) draws on an empty canvas instead of failing.
    const loadBaseImage = (): Promise<HTMLImageElement | null> => {
      if (baseImage || baseImageFailed || !originalHref) {
        return Promise.resolve(baseImage);
      }

      return new Promise((resolve) => {
        const image = new Image();

        image.onload = () => {
          baseImage = image;
          resolve(image);
        };

        image.onerror = () => {
          baseImageFailed = true;
          resolve(null);
        };

        image.src = originalHref as string;
      });
    };

    const render = async (overlay: FaviconOverlay) => {
      const canvas = document.createElement('canvas');
      canvas.width = FAVICON_SIZE;
      canvas.height = FAVICON_SIZE;

      // No 2d context (a non-browser DOM implementation) — leave the favicon untouched entirely.
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      const link = resolveIconLink();
      const image = await loadBaseImage();

      // A later state may have won the race while the base image loaded.
      if (activeOverlay() !== overlay) return;

      if (image) {
        ctx.drawImage(image, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
      }

      const color = overlay.color ?? readThemeColor(document);

      if (overlay.kind === 'dot') {
        drawDot(ctx, color);
      } else {
        drawProgress(ctx, overlay.value, color, overlay.trackColor ?? 'rgba(127, 127, 127, 0.35)');
      }

      try {
        link.setAttribute('href', canvas.toDataURL('image/png'));
      } catch {
        // A tainted canvas (cross-origin base icon) can't be exported — leave the favicon as it was.
        restore();
      }
    };

    if (isBrowser) {
      effect(() => {
        const overlay = activeOverlay();

        if (!overlay) {
          restore();

          return;
        }

        void render(overlay);
      });
    }

    const addOverlay = (id: symbol, overlay: FaviconOverlay) => {
      overlays.update((current) => new Map(current).set(id, overlay));
    };

    const removeOverlay = (id: symbol) => {
      overlays.update((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    };

    return { activeOverlay, addOverlay, removeOverlay };
  },
  { name: 'Favicon Store' },
);

/**
 * Owns the `<link rel="icon">` href so overlays can be drawn onto the site's favicon and taken back
 * off again. The original href is captured on first use and restored once the last overlay is gone.
 *
 * Registrations are keyed, and a `progress` overlay wins over a `dot` — a ring that also carries a
 * badge reads as neither.
 */
export const provideFaviconStore = /* @__PURE__ */ toProvideFn(FAVICON_STORE_DEF);
export const injectFaviconStore = /* @__PURE__ */ toInjectFn(FAVICON_STORE_DEF);

/**
 * Draw an overlay on the site's favicon while the binding has a value — an unsaved-changes dot, an
 * upload's progress ring. The favicon is restored when the binding goes empty or the injector is
 * destroyed. No-op during SSR.
 *
 * ```ts
 * applyFaviconOverlay(computed(() => (this.saving() ? { kind: 'progress', value: this.percent() } : null)));
 * ```
 */
export const applyFaviconOverlay = (binding: MaybeSignal<FaviconOverlay | null | undefined>) => {
  const faviconStore = injectFaviconStore();
  const overlayId = Symbol('favicon-overlay');

  applyHeadBinding(
    binding,
    (value) => faviconStore.addOverlay(overlayId, value),
    () => faviconStore.removeOverlay(overlayId),
  );
};
