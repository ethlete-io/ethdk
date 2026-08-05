import { Directive, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { routerRestoreScroll } from '../signals';

/**
 * Marks a `routerLink` as a return to a page the user has already seen - a "back to the overview"
 * link - so it restores that page's last scroll offset instead of scrolling to top.
 *
 * Needs `restore.enabled` on `setupScrollRestoration`. A page the session has no offset for (the
 * first visit, or a reload since) scrolls to top as usual.
 *
 * @example
 * <a routerLink="/teams" etRestoreScroll>Teams</a>
 */
@Directive({
  selector: '[routerLink][etRestoreScroll]',
})
export class RestoreScrollDirective {
  private routerLink = inject(RouterLink);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Capture, so the mark is on `state` before `RouterLink`'s own click handler reads it. Applied
    // per click rather than once, because a `[state]` binding on the same element would overwrite it
    // on any later change detection run.
    this.elementRef.nativeElement.addEventListener(
      'click',
      () => (this.routerLink.state = { ...this.routerLink.state, ...routerRestoreScroll() }),
      { capture: true },
    );
  }
}
