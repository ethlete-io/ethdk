import { TestBed } from '@angular/core/testing';
import { SurfaceTheme, injectSurfaceContextTracker, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { NotificationManagerConfig, provideNotificationManagerConfig } from './notification-config';
import { provideNotificationLabels } from './notification-labels';
import { createNotificationRef } from './notification-ref';
import { NotificationComponent } from './notification.component';

const surface = (name: string, elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type: 'dark',
  elevation,
  isDefault,
  background: '0 0 0',
  color: '255 255 255',
  colorMuted: '180 180 180',
  colorSubtle: '80 80 80',
  border: '40 40 40',
});

const THEMES = [
  surface('night', 0, true),
  surface('night-1', 1),
  surface('night-2', 2),
  surface('night-3', 3),
  surface('night-4', 4),
];

const MANAGER_CONFIG: NotificationManagerConfig = {
  position: 'bottom-end',
  maxVisible: 3,
  defaultDuration: {},
};

describe('NotificationComponent surface', () => {
  const tracker = () => TestBed.runInInjectionContext(() => injectSurfaceContextTracker());

  const render = () => {
    const ref = createNotificationRef({ status: 'info', title: 'Saved' }, { managerConfig: MANAGER_CONFIG });

    const fixture = TestBed.createComponent(NotificationComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();

    return {
      surfaceName: () => {
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;

        return Array.from(host.classList).find((cls) => cls.startsWith('et-surface--')) ?? null;
      },
    };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationComponent],
      providers: [
        provideSurfaceThemesWithTailwind4(THEMES),
        provideNotificationManagerConfig(MANAGER_CONFIG),
        provideNotificationLabels({ dismiss: 'Close notification' }),
      ],
    });
  });

  it('paints one elevation above the page', () => {
    expect(render().surfaceName()).toBe('et-surface--night-1');
  });

  it('keeps its elevation while overlays open and close', () => {
    const notification = render();

    expect(notification.surfaceName()).toBe('et-surface--night-1');

    const closeDialog = tracker().register('dark', 1, document.createElement('div'));
    const closeMenu = tracker().register('dark', 3, document.createElement('div'));

    expect(notification.surfaceName()).toBe('et-surface--night-1');

    closeMenu();
    closeDialog();

    expect(notification.surfaceName()).toBe('et-surface--night-1');
  });
});
