import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  DOCUMENT,
  effect,
  EnvironmentInjector,
  inject,
} from '@angular/core';
import { defineRootProvider, injectRenderer, RuntimeError, toInjectFn, toProvideFn } from '@ethlete/core';
import { injectPipManager } from './pip-manager';
import { PIP_CHROME_REF_TOKEN } from './pip/headless/pip-chrome-ref.token';
import { StreamPipChromeComponent } from './pip/pip-chrome.component';
import { injectStreamConfig } from './stream-config';
import { STREAM_ERROR_CODES } from './stream-errors';

const PIP_CHROME_MANAGER_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const pipManager = injectPipManager();
    const streamConfig = injectStreamConfig();
    const appRef = inject(ApplicationRef);
    const envInjector = inject(EnvironmentInjector);
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();

    let pipChromeRef: ComponentRef<unknown> | null = null;

    const destroyPipChrome = () => {
      if (!pipChromeRef) return;
      appRef.detachView(pipChromeRef.hostView);
      pipChromeRef.destroy();
      pipChromeRef = null;
    };

    effect(() => {
      const activePips = pipManager.pips();
      if (activePips.length > 0 && !pipChromeRef) {
        const pipChromeComponent =
          pipManager.pipChromeComponent() ?? streamConfig.pipChromeComponent ?? StreamPipChromeComponent;

        const ref = createComponent(pipChromeComponent, {
          environmentInjector: envInjector,
        });

        if (ngDevMode && !ref.injector.get(PIP_CHROME_REF_TOKEN, null)) {
          throw new RuntimeError(
            STREAM_ERROR_CODES.MISSING_PIP_CHROME_TOKEN,
            '[PipChromeManager] pipChromeComponent does not provide PIP_CHROME_REF_TOKEN. Implement PipChromeRef on the ' +
              'component and add { provide: PIP_CHROME_REF_TOKEN, useExisting: YourChromeComponent } to its providers.',
          );
        }

        appRef.attachView(ref.hostView);
        renderer.appendChild(document.body, ref.location.nativeElement);
        pipChromeRef = ref;
      } else if (activePips.length === 0 && pipChromeRef) {
        destroyPipChrome();
      }
    });

    destroyRef.onDestroy(destroyPipChrome);
  },
  { name: 'PipChromeManager' },
);

export const providePipChromeManager = /* @__PURE__ */ toProvideFn(PIP_CHROME_MANAGER_DEF);
export const injectPipChromeManager = /* @__PURE__ */ toInjectFn(PIP_CHROME_MANAGER_DEF);
