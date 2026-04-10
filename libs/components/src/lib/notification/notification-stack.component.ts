import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectRenderer } from '@ethlete/core';
import { animationFrameScheduler, take, tap, timer } from 'rxjs';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';
import { NotificationComponent } from './notification.component';

type PendingAnimation = {
  el: HTMLElement;
  innerEl?: HTMLElement;
  borderRadius?: string;
  dy?: number;
  oldHeight?: number;
  newHeight?: number;
  oldWidth?: number;
  newWidth?: number;
};

@Component({
  selector: 'et-notification-stack',
  templateUrl: './notification-stack.component.html',
  styleUrl: './notification-stack.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationComponent],
  host: {
    class: 'et-notification-stack',
    '[attr.data-position]': 'context.position',
  },
})
export class NotificationStackComponent {
  protected context = inject(NOTIFICATION_STACK_CONTEXT_TOKEN);

  protected displayRefs = computed(() => {
    const refs = this.context.visibleNotifications();
    return this.context.position.startsWith('top') ? [...refs].reverse() : refs;
  });

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private renderer = injectRenderer();

  constructor() {
    const capturedRects = new Map<string, DOMRect>();

    this.destroyRef.onDestroy(() => {
      this.context.captureBeforeState = null;
    });

    const captureCurrentRects = () => {
      capturedRects.clear();
      const host = this.elementRef.nativeElement;
      const children = Array.from(host.querySelectorAll<HTMLElement>('[data-notification-id]'));
      for (const el of children) {
        const id = el.dataset['notificationId'];
        if (id) capturedRects.set(id, el.getBoundingClientRect());
      }
    };

    this.context.captureBeforeState = () => {
      captureCurrentRects();

      afterNextRender(
        {
          earlyRead: () => {
            const pending = new Map<string, PendingAnimation>();
            const host = this.elementRef.nativeElement;
            const children = Array.from(host.querySelectorAll<HTMLElement>('[data-notification-id]'));

            for (const el of children) {
              const id = el.dataset['notificationId'];
              if (!id) continue;

              const rect = el.getBoundingClientRect();
              const prev = capturedRects.get(id);
              if (!prev) continue;

              const dy = prev.top - rect.top;
              const dHeight = prev.height - rect.height;
              const dWidth = prev.width - rect.width;
              const hasResize = Math.abs(dHeight) > 0.5 || Math.abs(dWidth) > 0.5;
              // Only apply FLIP position correction to displaced siblings, not to the element that resized
              const hasDy = !hasResize && Math.abs(dy) > 0.5;

              if (hasDy || hasResize) {
                const hasWidthChange = Math.abs(dWidth) > 0.5;
                const hasHeightChange = Math.abs(dHeight) > 0.5;
                const innerEl = hasResize ? ((el.firstElementChild as HTMLElement | null) ?? undefined) : undefined;
                const borderRadius = innerEl ? getComputedStyle(innerEl).borderTopLeftRadius : '0px';
                pending.set(id, {
                  el,
                  ...(innerEl ? { innerEl, borderRadius } : {}),
                  ...(hasDy ? { dy } : {}),
                  ...(hasHeightChange ? { oldHeight: prev.height, newHeight: rect.height } : {}),
                  ...(hasWidthChange ? { oldWidth: prev.width, newWidth: rect.width } : {}),
                });
              }
            }

            return pending;
          },
          write: (pending) => {
            if (!pending.size) return;

            const animations = Array.from(pending.values());

            for (const anim of animations) {
              const styles: Partial<Record<keyof CSSStyleDeclaration, string | null>> = { transition: 'none' };
              if (anim.dy !== undefined) styles.transform = `translateY(${anim.dy}px)`;
              if (anim.oldHeight !== undefined || anim.oldWidth !== undefined) {
                if (anim.oldHeight !== undefined) styles.height = `${anim.oldHeight}px`;
                if (anim.oldWidth !== undefined) styles.width = `${anim.oldWidth}px`;
                // clip-path with matching border-radius preserves rounded corners during the clip animation
                styles.clipPath = `inset(0 round ${anim.borderRadius ?? '0px'})`;
              }
              this.renderer.setStyle(anim.el, styles);
              // Pin inner element to final width so text renders at final layout — no reflow during animation
              if (anim.innerEl !== undefined && anim.newWidth !== undefined) {
                this.renderer.setStyle(anim.innerEl, { width: `${anim.newWidth}px` });
              }
            }

            timer(0, animationFrameScheduler)
              .pipe(
                take(1),
                tap(() => {
                  for (const anim of animations) {
                    const transitions: string[] = [];
                    const styles: Partial<Record<keyof CSSStyleDeclaration, string | null>> = {};

                    if (anim.dy !== undefined) {
                      transitions.push('transform 200ms ease');
                      styles.transform = null;
                    }
                    if (anim.newHeight !== undefined) {
                      transitions.push('height 200ms ease');
                      styles.height = `${anim.newHeight}px`;
                    }
                    if (anim.newWidth !== undefined) {
                      transitions.push('width 200ms ease');
                      styles.width = `${anim.newWidth}px`;
                    }

                    styles.transition = transitions.join(', ');
                    this.renderer.setStyle(anim.el, styles);
                  }
                }),
                takeUntilDestroyed(this.destroyRef),
              )
              .subscribe();

            const resized = animations.filter((a) => a.newHeight !== undefined || a.newWidth !== undefined);
            if (resized.length) {
              timer(210)
                .pipe(
                  take(1),
                  tap(() => {
                    for (const anim of resized) {
                      this.renderer.setStyle(anim.el, { height: null, width: null, clipPath: null, transition: null });
                      if (anim.innerEl !== undefined) {
                        this.renderer.setStyle(anim.innerEl, { width: null });
                      }
                    }
                  }),
                  takeUntilDestroyed(this.destroyRef),
                )
                .subscribe();
            }
          },
        },
        { injector: this.injector },
      );
    };
  }
}
