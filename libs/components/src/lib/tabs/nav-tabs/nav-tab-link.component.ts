import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FocusRingDirective } from '../../focus-ring';
import { TabBarTriggerDirective } from '../headless/tab-bar-trigger.directive';
import { TabBarUnderlineDirective } from '../headless/tab-bar-underline.directive';
import { NavTabLinkDirective } from './headless/nav-tab-link.directive';

@Component({
  selector: 'a[et-nav-tab-link]',
  template: `<span class="et-nav-tab-link__content"><ng-content /></span><span etTabBarUnderline></span>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabBarUnderlineDirective],
  hostDirectives: [
    {
      directive: RouterLink,
      inputs: [
        'routerLink:et-nav-tab-link',
        'queryParams',
        'fragment',
        'queryParamsHandling',
        'preserveFragment',
        'skipLocationChange',
        'replaceUrl',
        'state',
        'relativeTo',
      ],
    },
    {
      directive: RouterLinkActive,
      inputs: ['routerLinkActive', 'routerLinkActiveOptions', 'ariaCurrentWhenActive'],
    },
    {
      directive: TabBarTriggerDirective,
      inputs: ['disabled'],
    },
    NavTabLinkDirective,
    FocusRingDirective,
  ],
  host: {
    class: 'et-nav-tab-link',
    '[class.et-nav-tab-link--active]': 'navTabLink.isActive()',
    '[class.et-nav-tab-link--disabled]': 'navTabLink.trigger.disabled()',
    '(keydown.space)': 'handleSpace($event)',
  },
  styles: `
    @property --et-nav-tab-link-padding-inline {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-nav-tab-link-padding-block {
      syntax: '<length>';
      inherits: false;
      initial-value: 12px;
    }

    .et-nav-tab-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding-inline: var(--et-nav-tab-link-padding-inline);
      padding-block: var(--et-nav-tab-link-padding-block);
      text-decoration: none;
      color: var(--et-surface-interaction-solid, inherit);
      font-size: var(--et-nav-tabs-font-size, inherit);
      cursor: pointer;
      position: relative;
      white-space: nowrap;
      user-select: none;
      transition:
        color 150ms ease,
        background 150ms ease;
      outline: none;
      border-radius: 0.5rem;

      &.et-nav-tab-link--active:not(.et-tab-bar-trigger--just-activated):hover {
        background: rgb(var(--et-color-primary, 0 0 0) / 0.08);
      }

      &.et-nav-tab-link--active:not(.et-tab-bar-trigger--just-activated):focus-visible {
        background: rgb(var(--et-color-primary, 0 0 0) / 0.12);
      }

      &.et-nav-tab-link--active:not(.et-tab-bar-trigger--just-activated):active {
        background: rgb(var(--et-color-primary, 0 0 0) / 0.16);
      }

      [data-variant='primary'] & {
        flex-direction: column;
        gap: 4px;
      }

      [etIcon] {
        width: 1.2em;
        height: 1.2em;
      }

      &.et-nav-tab-link--active {
        color: var(--et-surface-color-solid, inherit);
      }

      &.et-nav-tab-link--disabled {
        pointer-events: none;
        cursor: default;
      }

      .et-nav-tab-link__content {
        display: inline-flex;
        align-items: center;
        gap: inherit;
        border-radius: 0.5rem;
        padding: 4px 8px;
        margin: -4px -8px;
        box-shadow: var(--_et-focus-ring-shadow);
        transition: box-shadow 120ms ease;
      }

      &:focus-visible .et-nav-tab-link__content {
        box-shadow: var(--_et-focus-ring-shadow);
      }

      .et-tab-bar-underline {
        position: absolute;
        z-index: 1;
        background: var(--et-theme-color-ink-solid, currentColor);
        border-radius: var(--et-nav-tabs-underline-radius, 1px);
        pointer-events: none;
        opacity: 0;
      }

      .et-tab-bar-underline--active {
        opacity: 1;
      }
    }

    [data-orientation='horizontal'] .et-nav-tab-link .et-tab-bar-underline {
      bottom: 0;
      left: 0;
      right: 0;
      height: var(--et-nav-tabs-underline-size, 2px);
      transform-origin: left;
    }

    [data-variant='primary'][data-orientation='horizontal'] .et-nav-tab-link .et-tab-bar-underline {
      left: 25%;
      right: 25%;
      height: var(--et-nav-tabs-underline-size, 3px);
      border-radius: var(--et-nav-tabs-underline-size, 3px) var(--et-nav-tabs-underline-size, 3px) 0 0;
    }

    [data-orientation='vertical'] .et-nav-tab-link .et-tab-bar-underline {
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--et-nav-tabs-underline-size, 2px);
      transform-origin: top;
    }

    [data-variant='primary'][data-orientation='vertical'] .et-nav-tab-link .et-tab-bar-underline {
      top: 25%;
      bottom: 25%;
      width: var(--et-nav-tabs-underline-size, 3px);
      border-radius: 0 var(--et-nav-tabs-underline-size, 3px) var(--et-nav-tabs-underline-size, 3px) 0;
    }

    [data-size='sm'] .et-nav-tab-link {
      --et-nav-tab-link-padding-inline: 12px;
      --et-nav-tab-link-padding-block: 8px;
    }

    [data-size='md'] .et-nav-tab-link {
      --et-nav-tab-link-padding-inline: 16px;
      --et-nav-tab-link-padding-block: 12px;
    }

    [data-size='lg'] .et-nav-tab-link {
      --et-nav-tab-link-padding-inline: 20px;
      --et-nav-tab-link-padding-block: 14px;
    }
  `,
})
export class NavTabLinkComponent {
  protected navTabLink = inject(NavTabLinkDirective);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected handleSpace(event: Event) {
    event.preventDefault();
    this.elementRef.nativeElement.click();
  }
}
