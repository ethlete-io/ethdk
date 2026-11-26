import { DOCUMENT } from '@angular/common';
import { ApplicationRef, createComponent, DestroyRef, EnvironmentInjector, RendererFactory2 } from '@angular/core';
import { QueryDevtoolsLazyComponent } from './query-devtools-lazy.component';

/**
 * Mounts `<et-query-devtools-lazy>` on the document body and destroys it with the injector. Called by
 * `provideQueryDevtools()`; call it yourself only to mount the devtools outside a template.
 */
export const mountQueryDevtools = (injector: EnvironmentInjector) => {
  const host = injector.get(ApplicationRef);
  const renderer = injector.get(RendererFactory2).createRenderer(null, null);
  const element = renderer.createElement('et-query-devtools-lazy');

  renderer.appendChild(injector.get(DOCUMENT).body, element);

  const ref = createComponent(QueryDevtoolsLazyComponent, { environmentInjector: injector, hostElement: element });

  host.attachView(ref.hostView);
  injector.get(DestroyRef).onDestroy(() => ref.destroy());

  return ref;
};
