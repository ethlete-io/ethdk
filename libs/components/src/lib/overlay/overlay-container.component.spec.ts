import { ApplicationRef, Component, ComponentRef, ViewContainerRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, ProvideColorDirective, provideColorThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { OverlayConfig } from './overlay-config';
import { injectOverlayManager } from './overlay-manager';
import { OverlayRef } from './overlay-ref';
import { dialogOverlayStrategy } from './strategies';

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
}

@Component({ template: 'overlay content' })
class OverlayContentComponent {}

describe('OverlayContainerComponent color context', () => {
  let openedRef: OverlayRef<OverlayContentComponent, unknown> | null = null;
  let appRootRef: ComponentRef<ThemedAppRootComponent> | null = null;
  let appRootElement: HTMLElement | null = null;

  beforeEach(() => {
    openedRef = null;
    appRootRef = null;
    appRootElement = null;

    TestBed.configureTestingModule({
      providers: [provideColorThemesWithTailwind4([BRAND_THEME, DANGER_THEME])],
    });
  });

  afterEach(() => {
    openedRef?.close();
    appRootRef?.destroy();
    appRootElement?.remove();
  });

  /** Bootstraps the themed root for real — only bootstrapped components register in `ApplicationRef.components`. */
  const bootstrapAppRoot = () => {
    appRootElement = document.createElement('et-themed-app-root');
    document.body.appendChild(appRootElement);

    appRootRef = TestBed.inject(ApplicationRef).bootstrap(ThemedAppRootComponent, appRootElement);
    TestBed.tick();

    return appRootRef.instance;
  };

  const openDialog = (config?: Partial<OverlayConfig>) => {
    const overlayRef = TestBed.runInInjectionContext(() =>
      injectOverlayManager().open<OverlayContentComponent, unknown>(OverlayContentComponent, {
        strategies: dialogOverlayStrategy(),
        ...config,
      }),
    );

    openedRef = overlayRef;
    TestBed.tick();

    return overlayRef;
  };

  it('adopts a color forced on an app-root host-directive provider when opened outside any element injector', () => {
    const appRoot = bootstrapAppRoot();

    appRoot.colorProvider.forceColor('brand');
    TestBed.tick();

    const overlayRef = openDialog();

    expect(overlayRef.elements?.paneElement.classList.contains('et-color--brand')).toBe(true);
  });

  it('keeps following the app-root provider while the overlay is open', () => {
    const appRoot = bootstrapAppRoot();

    appRoot.colorProvider.forceColor('brand');
    TestBed.tick();

    const overlayRef = openDialog();

    appRoot.colorProvider.forceColor('danger');
    TestBed.tick();

    expect(overlayRef.elements?.paneElement.classList.contains('et-color--danger')).toBe(true);

    appRoot.colorProvider.clearForcedColor();
    TestBed.tick();

    expect(overlayRef.elements?.paneElement.classList.contains('et-color--inherited')).toBe(true);
  });

  it('prefers a provider reachable through the configured viewContainerRef over the app-root provider', () => {
    const appRoot = bootstrapAppRoot();

    appRoot.colorProvider.forceColor('brand');
    TestBed.tick();

    const openerFixture = TestBed.createComponent(ScopedOpenerComponent);
    openerFixture.detectChanges();
    openerFixture.componentInstance.colorProvider.forceColor('danger');
    openerFixture.detectChanges();

    const overlayRef = openDialog({ viewContainerRef: openerFixture.componentInstance.viewContainerRef });

    expect(overlayRef.elements?.paneElement.classList.contains('et-color--danger')).toBe(true);
  });

  it('stays uncolored when no provider exists anywhere', () => {
    const overlayRef = openDialog();

    expect(overlayRef.elements?.paneElement.classList.contains('et-color--inherited')).toBe(true);
  });
});
