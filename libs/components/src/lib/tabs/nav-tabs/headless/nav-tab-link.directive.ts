import { DestroyRef, Directive, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLinkActive } from '@angular/router';
import { tap } from 'rxjs';
import { TabBarTriggerDirective } from '../../headless/tab-bar-trigger.directive';
import { TabBarDirective } from '../../headless/tab-bar.directive';

@Directive({
  selector: '[etNavTabLink]',
})
export class NavTabLinkDirective {
  private routerLinkActive = inject(RouterLinkActive, { self: true });
  private tabBar = inject(TabBarDirective);
  private destroyRef = inject(DestroyRef);

  public trigger = inject(TabBarTriggerDirective);

  private routerLinkIsActive = signal(this.routerLinkActive.isActive ?? false);

  public isActive = computed(() => this.routerLinkIsActive());

  constructor() {
    this.routerLinkActive.isActiveChange
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((active) => {
          this.routerLinkIsActive.set(active);
        }),
      )
      .subscribe();

    effect(() => {
      if (this.isActive()) {
        this.tabBar.selectTrigger(this.trigger);
      }
    });
  }
}
