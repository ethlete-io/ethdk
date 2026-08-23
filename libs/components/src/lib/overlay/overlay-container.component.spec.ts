import {
  ApplicationRef,
  Component,
  ComponentRef,
  InjectionToken,
  Injector,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  ProvideColorDirective,
  SurfaceTheme,
  provideColorThemesWithTailwind4,
  provideSurfaceThemesWithTailwind4,
} from '@ethlete/core';
import '../../test-helpers';
import { createOverlayDriver } from '../testing/overlay-driver';
import { anchoredDialogOverlayStrategy, dialogOverlayStrategy } from './strategies';

const BRAND_THEME: ColorTheme = {
  name: 'brand',
  isDefault: true,
  primary: {
    color: {
      default: '0 255 161',
      hover: '76 247 184',
      focus: '76 247 184',
      active: '0 198 126',
      disabled: '0 122 77',
    },
    onColor: {
      default: '0 0 0',
      disabled: '0 36 23',
    },
  },
};

const DANGER_THEME: ColorTheme = {
  name: 'danger',
  type: 'error',
  primary: {
    color: {
      default: '220 38 38',
      hover: '239 68 68',
      focus: '239 68 68',
      active: '185 28 28',
      disabled: '120 52 52',
    },
    onColor: {
      default: '255 255 255',
      disabled: '255 220 220',
    },
  },
};

@Component({ selector: 'et-themed-app-root', template: '', hostDirectives: [ProvideColorDirective] })
class ThemedAppRootComponent {
  colorProvider = inject(ProvideColorDirective);
}

@Component({ template: 'scoped opener', hostDirectives: [ProvideColorDirective] })
class ScopedOpenerComponent {
  colorProvider = inject(ProvideColorDirective);
  viewContainerRef = inject(ViewContainerRef);
  injector = inject(Injector);
}

@Component({ template: 'overlay content' })
class OverlayContentComponent {}

describe('OverlayContainerComponent color context', () => {
  let driver: ReturnType<typeof createOverlayDriver>;
  let appRootRef: ComponentRef<ThemedAppRootComponent> | null = null;
  let appRootElement: HTMLElement | null = null;

  beforeEach(() => {
    appRootRef = null;
    appRootElement = null;

    TestBed.configureTestingModule({
      providers: [provideColorThemesWithTailwind4([BRAND_THEME, DANGER_THEME])],
    });

    driver = createOverlayDriver(null, { config: { strategies: dialogOverlayStrategy() } });
  });

  afterEach(() => {
    driver.closeAll();
    appRootRef?.destroy();
    appRootElement?.remove();
  });

  /** Bootstraps the themed root for real - only bootstrapped components register in `ApplicationRef.components`. */
  const bootstrapAppRoot = () => {
    appRootElement = document.createElement('et-themed-app-root');
    document.body.appendChild(appRootElement);

    appRootRef = TestBed.inject(ApplicationRef).bootstrap(ThemedAppRootComponent, appRootElement);
    driver.tick();

    return appRootRef.instance;
  };

  it('adopts a color forced on an app-root host-directive provider when opened outside any element injector', async () => {
    const appRoot = bootstrapAppRoot();

    appRoot.colorProvider.forceColor('brand');
    driver.tick();

    await driver.open(OverlayContentComponent);

    expect(driver.pane()?.classList.contains('et-color--brand')).toBe(true);
  });

  it('keeps following the app-root provider while the overlay is open', async () => {
    const appRoot = bootstrapAppRoot();

    appRoot.colorProvider.forceColor('brand');
    driver.tick();

    await driver.open(OverlayContentComponent);

    appRoot.colorProvider.forceColor('danger');
    driver.tick();

    expect(driver.pane()?.classList.contains('et-color--danger')).toBe(true);

    appRoot.colorProvider.clearForcedColor();
    driver.tick();

    expect(driver.pane()?.classList.contains('et-color--inherited')).toBe(true);
  });

  it('prefers a provider reachable through the configured viewContainerRef over the app-root provider', async () => {
    const appRoot = bootstrapAppRoot();

    appRoot.colorProvider.forceColor('brand');
    driver.tick();

    const openerFixture = TestBed.createComponent(ScopedOpenerComponent);
    openerFixture.detectChanges();
    openerFixture.componentInstance.colorProvider.forceColor('danger');
    openerFixture.detectChanges();

    await driver.open(OverlayContentComponent, {
      viewContainerRef: openerFixture.componentInstance.viewContainerRef,
    });

    expect(driver.pane()?.classList.contains('et-color--danger')).toBe(true);
  });

  it('stays uncolored when no provider exists anywhere', async () => {
    await driver.open(OverlayContentComponent);

    expect(driver.pane()?.classList.contains('et-color--inherited')).toBe(true);
  });
});

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

const SURFACE_THEMES = [surface('night', 0, true), surface('night-1', 1), surface('night-2', 2)];

describe('OverlayContainerComponent surface elevation', () => {
  let driver: ReturnType<typeof createOverlayDriver>;
  let origin: HTMLElement | null = null;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideSurfaceThemesWithTailwind4(SURFACE_THEMES)] });

    driver = createOverlayDriver();
  });

  afterEach(() => {
    driver.closeAll();
    origin?.closest('.et-surface--night-1')?.remove();
    origin = null;
  });

  /** A trigger painted on an elevation-1 surface, as it would be inside an open dialog. */
  const createElevatedOrigin = () => {
    const parent = document.createElement('div');
    parent.classList.add('et-surface--night-1');

    const trigger = document.createElement('button');
    parent.appendChild(trigger);
    document.body.appendChild(parent);
    origin = trigger;

    return trigger;
  };

  const surfaceName = () =>
    Array.from(driver.pane()?.classList ?? []).find((cls) => cls.startsWith('et-surface--')) ?? null;

  it('elevates above the trigger when the strategy renders no backdrop', async () => {
    await driver.open(OverlayContentComponent, {
      origin: createElevatedOrigin(),
      strategies: anchoredDialogOverlayStrategy(),
    });

    expect(surfaceName()).toBe('et-surface--night-2');
  });

  it('resets to elevation 1 when the strategy renders a backdrop', async () => {
    await driver.open(OverlayContentComponent, {
      origin: createElevatedOrigin(),
      strategies: dialogOverlayStrategy(),
    });

    expect(surfaceName()).toBe('et-surface--night-1');
  });

  it('lets the overlay config override the strategy default', async () => {
    await driver.open(OverlayContentComponent, {
      origin: createElevatedOrigin(),
      strategies: anchoredDialogOverlayStrategy(),
      hasBackdrop: true,
    });

    expect(surfaceName()).toBe('et-surface--night-1');
  });
});

const CONTENT_SCOPED_TOKEN = new InjectionToken<string>('CONTENT_SCOPED_TOKEN');

@Component({ template: 'scoped content' })
class ScopedContentComponent {
  scoped = inject(CONTENT_SCOPED_TOKEN);
}

describe('OverlayContainerComponent provider context', () => {
  let driver: ReturnType<typeof createOverlayDriver>;

  beforeEach(() => {
    driver = createOverlayDriver(null, {
      config: {
        strategies: dialogOverlayStrategy(),
        providers: [{ provide: CONTENT_SCOPED_TOKEN, useValue: 'scoped value' }],
      },
    });
  });

  afterEach(() => {
    driver.closeAll();
  });

  it('resolves an overlay provider in the content component when opened without an injector', async () => {
    const overlayRef = await driver.open(ScopedContentComponent);

    expect(overlayRef.componentInstance()?.scoped).toBe('scoped value');
  });

  it('resolves an overlay provider in the content component when opened with an injector', async () => {
    const openerFixture = TestBed.createComponent(ScopedOpenerComponent);
    openerFixture.detectChanges();

    const overlayRef = await driver.open(ScopedContentComponent, {
      injector: openerFixture.componentInstance.injector,
    });

    expect(overlayRef.componentInstance()?.scoped).toBe('scoped value');
  });

  it('resolves an overlay provider in the content component when opened from a viewContainerRef', async () => {
    const overlayFixture = TestBed.createComponent(ScopedOpenerComponent);
    overlayFixture.detectChanges();

    const overlayRef = await driver.open(ScopedContentComponent, {
      viewContainerRef: overlayFixture.componentInstance.viewContainerRef,
    });

    expect(overlayRef.componentInstance()?.scoped).toBe('scoped value');
  });
});
