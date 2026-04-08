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
import { createRootProvider, injectRenderer, RuntimeError } from '@ethlete/core';
import { injectPipManager } from './pip-manager';
import { PIP_CHROME_REF_TOKEN } from './pip/headless/pip-chrome-ref.token';
import { injectStreamConfig } from './stream-config';
import { STREAM_ERROR_CODES } from './stream-errors';

export const [providePipChromeManager, injectPipChromeManager] = createRootProvider(
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
        const ref = createComponent(streamConfig.pipChromeComponent, {
          environmentInjector: envInjector,
        });

        if (ngDevMode && !ref.injector.get(PIP_CHROME_REF_TOKEN, null)) {
          throw new RuntimeError(
            STREAM_ERROR_CODES.MISSING_PIP_CHROME_TOKEN,
            '[PipChromeManager] pipChromeComponent does not provide PIP_CHROME_REF_TOKEN. Ensure the component has hostDirectives: [StreamPipChromeComponent].',
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
