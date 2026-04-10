import { DOCUMENT, inject, signal } from '@angular/core';
import { createRootProvider, injectRenderer, injectViewportSize } from '@ethlete/core';
import { animateWithFixedWrapper } from './pip/headless/internals/pip-animation';
import { injectStreamManager } from './stream-manager';
import { PipManager, StreamPipEntry, StreamPlayerId } from './stream-manager.types';

export const [providePipManager, injectPipManager] = createRootProvider(
  (): PipManager => {
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();
    const streamManager = injectStreamManager();

    const viewportSize = injectViewportSize();

    const pips = signal<StreamPipEntry[]>([]);
    const featuredPipId = signal<StreamPlayerId | null>(null);
    const pipInitialRects = new Map<StreamPlayerId, DOMRect>();
    const pendingBackPulses = new Set<StreamPlayerId>();
    const backPulseCounter = signal(0);
    const animatingOutIds = new Set<StreamPlayerId>();

    const setFeaturedPip = (playerId: StreamPlayerId | null) => {
      featuredPipId.set(playerId);
    };

    const notifyBackPressed = (playerId: StreamPlayerId) => {
      pendingBackPulses.add(playerId);
      backPulseCounter.update((n) => n + 1);
    };

    const consumeBackPulse = (playerId: StreamPlayerId) => {
      if (pendingBackPulses.has(playerId)) {
        pendingBackPulses.delete(playerId);

        return true;
      }
      return false;
    };

    const isInViewport = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.right > 0 &&
      r.bottom > 0 &&
      r.left < viewportSize().width &&
      r.top < viewportSize().height;

    const isInPip = (playerId: StreamPlayerId) => pips().some((p) => p.playerId === playerId);

    const pipActivate = (element: HTMLElement, options?: { onBack?: () => void; aspectRatio?: number }) => {
      const slot = streamManager.getSlot(element);
      if (!slot) return;

      const playerEntry = streamManager.getPlayerEntry(slot.playerId);
      if (!playerEntry || isInPip(slot.playerId)) return;

      const initialRect = playerEntry.element.getBoundingClientRect();
      if (isInViewport(initialRect)) {
        pipInitialRects.set(slot.playerId, initialRect);
      }

      streamManager.setPlayerInPip(slot.playerId, true);
      streamManager.movePlayerToContainer(slot.playerId);
      pips.update((current) => [
        ...current,
        {
          playerId: slot.playerId,
          onBack: options?.onBack ?? slot.onPipBack,
          thumbnail: playerEntry.thumbnail,
          aspectRatio: options?.aspectRatio ?? 16 / 9,
        },
      ]);
    };

    const pipDeactivate = (
      playerId: StreamPlayerId,
      options?: { skipAnimation?: boolean; animation?: 'flip' | 'scaleFadeIn' },
    ) => {
      if (!isInPip(playerId)) return;

      pipInitialRects.delete(playerId);

      const playerEl = streamManager.getPlayerElement(playerId);
      if (!playerEl) {
        pips.update((current) => current.filter((p) => p.playerId !== playerId));
        streamManager.setPlayerInPip(playerId, false);

        return;
      }

      const bestSlot = streamManager.resolveBestSlot(playerId);

      if (!bestSlot) {
        pips.update((current) => current.filter((p) => p.playerId !== playerId));
        streamManager.setPlayerInPip(playerId, false);
        streamManager.unregisterPlayer(playerId);

        return;
      }

      const targetParent = bestSlot.element;

      if (!options?.skipAnimation) {
        const requestedAnim = options?.animation ?? 'flip';
        const fromRect = playerEl.getBoundingClientRect();

        const featuredId = featuredPipId();
        const animMode =
          requestedAnim === 'flip' && featuredId !== null && playerId !== featuredId ? 'scaleFadeIn' : requestedAnim;

        if (animMode === 'scaleFadeIn') {
          animatingOutIds.add(playerId);
          streamManager.setPlayerAnimatingOut(playerId, true);
          renderer.moveBefore({ newParent: targetParent, child: playerEl });
          const anim = playerEl.animate(
            [
              { transform: 'scale(0.85)', opacity: '0' },
              { transform: 'scale(1)', opacity: '1' },
            ],
            { duration: 200, easing: 'ease-out' },
          );
          anim.onfinish = () => {
            animatingOutIds.delete(playerId);
            streamManager.setPlayerAnimatingOut(playerId, false);
          };
          pips.update((current) => current.filter((p) => p.playerId !== playerId));
          streamManager.setPlayerInPip(playerId, false);

          return;
        }

        const toRect = targetParent.getBoundingClientRect();

        if (fromRect.width > 0 && fromRect.height > 0 && toRect.width > 0 && toRect.height > 0) {
          animatingOutIds.add(playerId);
          streamManager.setPlayerAnimatingOut(playerId, true);
          animateWithFixedWrapper({
            playerEl,
            fromRect,
            toRect,
            document,
            renderer,
            onFinish: () => {
              animatingOutIds.delete(playerId);
              streamManager.setPlayerAnimatingOut(playerId, false);
              renderer.moveBefore({ newParent: targetParent, child: playerEl });
            },
          });
          pips.update((current) => current.filter((p) => p.playerId !== playerId));
          streamManager.setPlayerInPip(playerId, false);

          return;
        }
      }

      renderer.moveBefore({ newParent: targetParent, child: playerEl });
      pips.update((current) => current.filter((p) => p.playerId !== playerId));
      streamManager.setPlayerInPip(playerId, false);
    };

    const getInitialRect = (playerId: StreamPlayerId): DOMRect | null => {
      const rect = pipInitialRects.get(playerId) ?? null;
      pipInitialRects.delete(playerId);
      return rect;
    };

    const parkPlayerElement = (playerId: StreamPlayerId) => {
      if (animatingOutIds.has(playerId)) return;
      streamManager.movePlayerToContainer(playerId);
    };

    return {
      pips: pips.asReadonly(),
      featuredPipId: featuredPipId.asReadonly(),
      setFeaturedPip,
      backPulseCounter: backPulseCounter.asReadonly(),
      notifyBackPressed,
      consumeBackPulse,
      pipActivate,
      pipDeactivate,
      getInitialRect,
      parkPlayerElement,
    };
  },
  { name: 'Pip Manager' },
);
