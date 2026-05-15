import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
  setInputSignal,
} from '@ethlete/core';
import { IconButtonComponent } from '../button/icon-button.component';
import { TextButtonComponent } from '../button/text-button.component';
import { ICON_IMPORTS, TIMES_ICON, provideIcons } from '../icon';
import { ProgressBarComponent } from '../loader/progress-bar/progress-bar.component';
import { SpinnerComponent } from '../loader/spinner/spinner.component';
import { NotificationActionDirective } from './headless/notification-action.directive';
import { NotificationDismissDirective } from './headless/notification-dismiss.directive';
import { NotificationDirective } from './headless/notification.directive';
import { injectNotificationManagerConfig } from './notification-config';

@Component({
  selector: 'et-notification',
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NotificationActionDirective,
    NotificationDismissDirective,
    SpinnerComponent,
    ProgressBarComponent,
    IconButtonComponent,
    TextButtonComponent,
    ...ICON_IMPORTS,
  ],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [
    { directive: NotificationDirective, inputs: ['ref'] },
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
    '(mouseenter)': 'notification.ref().pauseTimer()',
    '(mouseleave)': 'notification.ref().resumeTimer()',
    '(focusin)': 'notification.ref().pauseTimer()',
    '(focusout)': 'notification.ref().resumeTimer()',
  },
})
export class NotificationComponent {
  protected notification = inject(NotificationDirective);

  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);
  private provideTheme = inject(ProvideColorDirective);
  private provideSurface = inject(ProvideSurfaceDirective);
  private managerConfig = injectNotificationManagerConfig();
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();

  private resolvedColor = computed(() => {
    const mapping = this.managerConfig.statusColorMapping;
    if (!mapping) return null;

    const status = this.notification.status();
    return mapping[status] ?? null;
  });

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    if (!themes) return null;

    const type = this.surfaceContextTracker.topType() ?? 'dark';
    const elevation = this.surfaceContextTracker.topElevation() + 1;
    return resolveSurfaceByElevation(themes, type, elevation);
  });

  protected controlsColor = computed(() => {
    return this.managerConfig.controlsColor ?? this.resolvedColor();
  });

  protected dismissLabel = computed(() => this.managerConfig.dismissLabel);

  constructor() {
    effect(() => {
      const theme = this.resolvedColor();

      untracked(() => {
        setInputSignal(this.provideTheme.mainColor, theme);
      });
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        setInputSignal(this.provideSurface.surface, surface?.name ?? null);
      });
    });

    afterNextRender(() => {
      this.animatedLifecycle.enter();
    });
  }
}
