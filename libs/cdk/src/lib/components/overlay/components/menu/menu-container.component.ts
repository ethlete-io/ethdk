import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  TemplateRef,
  ViewEncapsulation,
  inject,
  viewChild,
} from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ProvideThemeDirective,
  THEME_PROVIDER,
} from '@ethlete/core';
import { MENU_TRIGGER_TOKEN } from './menu-trigger.directive';

export const MENU_CONTAINER = new InjectionToken<MenuContainerComponent>('ET_MENU_CONTAINER');
export const MENU_TEMPLATE = new InjectionToken<TemplateRef<unknown>>('MENU_TEMPLATE');

@Component({
  selector: 'et-menu-container',
  template: `
    <div class="et-menu-body" etAnimatedLifecycle>
      <ng-container *ngTemplateOutlet="_menuTemplate; injector: injector" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu-container',
  },
  imports: [AnimatedLifecycleDirective, NgTemplateOutlet],
  hostDirectives: [ProvideThemeDirective],
  providers: [
    {
      provide: MENU_CONTAINER,
      useExisting: MenuContainerComponent,
    },
  ],
  styles: `
    .et-menu-container {
      display: block;
      transform: var(--et-floating-translate);
      will-change: transform;

      .et-menu-body {
        &.et-animation-enter-from,
        &.et-animation-leave-to {
          opacity: 0;
          transform: scale(0);
        }

        &.et-animation-enter-active {
          transition:
            transform 250ms var(--ease-out-5),
            opacity 250ms var(--ease-out-5);

          @supports (transition-timing-function: linear(0, 1)) {
            transition:
              transform 250ms var(--ease-spring-1),
              opacity 250ms var(--ease-spring-1);
          }
        }

        &.et-animation-leave-active {
          transition:
            transform 100ms var(--ease-in-5),
            opacity 100ms var(--ease-in-5);
        }
      }

      &[et-floating-placement='bottom'] .et-menu-body.et-animation-enter-to,
      &[et-floating-placement='bottom'] .et-menu-body.et-animation-leave-to {
        transform-origin: top center;
      }

      &[et-floating-placement='bottom-start'] .et-menu-body.et-animation-enter-to,
      &[et-floating-placement='bottom-start'] .et-menu-body.et-animation-leave-to {
        transform-origin: top left;
      }

      &[et-floating-placement='bottom-end'] .et-menu-body.et-animation-enter-to,
      &[et-floating-placement='bottom-end'] .et-menu-body.et-animation-leave-to {
        transform-origin: top right;
      }

      &[et-floating-placement='top'] .et-menu-body.et-animation-enter-to,
      &[et-floating-placement='top'] .et-menu-body.et-animation-leave-to {
        transform-origin: bottom center;
      }

      &[et-floating-placement='top-start'] .et-menu-body.et-animation-enter-to,
      &[et-floating-placement='top-start'] .et-menu-body.et-animation-leave-to {
        transform-origin: bottom left;
      }

      &[et-floating-placement='top-end'] .et-menu-body.et-animation-enter-to,
      &[et-floating-placement='top-end'] .et-menu-body.et-animation-leave-to {
        transform-origin: bottom right;
      }
    }
  `,
})
export class MenuContainerComponent {
  readonly animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);

  private readonly themeProvider = inject(THEME_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(MENU_TRIGGER_TOKEN);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly _menuTemplate = inject(MENU_TEMPLATE);

  setThemeFromProvider(provider: ProvideThemeDirective) {
    this.themeProvider.syncWithProvider(provider);
  }
}
