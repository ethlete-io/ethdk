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
import { createRootProvider, injectRenderer } from '@ethlete/core';
import { injectPipManager } from './pip-manager';
import { injectStreamConfig } from './stream-config';

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
