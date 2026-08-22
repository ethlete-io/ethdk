import { Component, ViewEncapsulation, afterNextRender, computed, effect, inject, untracked } from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  injectSurfaceThemes,
  injectSurfaceType,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { IconButtonComponent } from '../button/icon-button.component';
import { TextButtonComponent } from '../button/text-button.component';
import {
  CIRCLE_CHECK_ICON,
  CIRCLE_INFO_ICON,
  ICON_IMPORTS,
  TIMES_ICON,
  TRIANGLE_EXCLAMATION_ICON,
  provideIcons,
} from '../icon';
import { ProgressBarComponent } from '../loader/progress-bar/progress-bar.component';
import { SpinnerComponent } from '../loader/spinner/spinner.component';
import { NotificationActionDirective } from './headless/notification-action.directive';
import { NotificationDismissDirective } from './headless/notification-dismiss.directive';
import { NotificationSwipeToDismissDirective } from './headless/notification-swipe-to-dismiss.directive';
import { NotificationDirective } from './headless/notification.directive';
import { injectNotificationManagerConfig, resolveNotificationStatusIcon } from './notification-config';
import { injectNotificationLabels } from './notification-labels';

@Component({
  selector: 'et-notification',
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NotificationActionDirective,
    NotificationDismissDirective,
    SpinnerComponent,
    ProgressBarComponent,
    IconButtonComponent,
    TextButtonComponent,
    ...ICON_IMPORTS,
  ],
  providers: [provideIcons(TIMES_ICON, CIRCLE_CHECK_ICON, CIRCLE_INFO_ICON, TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [
    { directive: NotificationDirective, inputs: ['ref'] },
    NotificationSwipeToDismissDirective,
    AnimatedLifecycleDirective,
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
    {
      directive: ProvideSurfaceDirective,
      inputs: ['etProvideSurface:surface'],
    },
  ],
  host: {
    class: 'et-notification',
    '(keydown.escape)': 'notification.ref().dismiss()',
    '(mouseenter)': 'notification.ref().pauseTimer("hover")',
    '(mouseleave)': 'notification.ref().resumeTimer("hover")',
    '(focusin)': 'notification.ref().pauseTimer("focus")',
    '(focusout)': 'notification.ref().resumeTimer("focus")',
  },
})
export class NotificationComponent {
  protected notification = inject(NotificationDirective);

  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);
  private provideTheme = inject(ProvideColorDirective);
  private provideSurface = inject(ProvideSurfaceDirective);
  private managerConfig = injectNotificationManagerConfig();
  private labels = injectNotificationLabels();
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceType = injectSurfaceType();

  private resolvedColor = computed(() => {
    const mapping = this.managerConfig.statusColorMapping;
    if (!mapping) return null;

    const status = this.notification.status();
    return mapping[status] ?? null;
  });

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const type = this.surfaceType();
    if (!themes || !type) return null;

    // The stack is appended to <body> and paints above every overlay, so a toast is a layer on the
    // page - elevation 1, the same level a dialog resolves to. It must not follow what is open
    // underneath it: that re-shaded every visible toast whenever an overlay came or went.
    return resolveSurfaceByElevation(themes, type, 1);
  });

  protected controlsColor = computed(() => {
    return this.managerConfig.controlsColor ?? this.resolvedColor();
  });

  protected dismissLabel = computed(() => this.labels().dismiss);

  /**
   * The glyph in front of the title: the notification's own `icon` if it names one (or opts out with
   * `null`), otherwise the one its status carries. `loading` has none by default and renders its
   * spinner instead.
   */
  protected statusIcon = computed(() => {
    const own = this.notification.icon();

    if (own !== undefined) return own;

    return resolveNotificationStatusIcon(this.managerConfig, this.notification.status());
  });

  constructor() {
    effect(() => {
      const theme = this.resolvedColor();

      untracked(() => {
        if (theme) {
          this.provideTheme.forceColor(theme);

          return;
        }

        this.provideTheme.clearForcedColor();
      });
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        if (surface) {
          this.provideSurface.forceSurface(surface.name);

          return;
        }

        this.provideSurface.clearForcedSurface();
      });
    });

    afterNextRender(() => {
      this.animatedLifecycle.enter();
    });
  }
}
