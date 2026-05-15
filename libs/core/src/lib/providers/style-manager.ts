import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Type,
} from '@angular/core';
import { createRootProvider } from '../utils';
import { injectRenderer } from './renderer';

export type StyleManager = {
  mount: <TComponent>(component: Type<TComponent>) => ComponentRef<TComponent>;
};

export const [provideStyleManager, injectStyleManager] = createRootProvider(
  (): StyleManager => {
    const appRef = inject(ApplicationRef);
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const envInjector = inject(EnvironmentInjector);
    const renderer = injectRenderer();

    let container: HTMLDivElement | null = null;
    const mountedComponents = new Map<Type<unknown>, ComponentRef<unknown>>();

    const getContainerParent = () => {
      return document.body ?? document.documentElement;
    };

    const ensureContainer = () => {
      if (container) {
        return container;
      }

      const nextContainer = renderer.createElement('div');
      renderer.addClass(nextContainer, 'et-style-manager');
      renderer.setAttribute(nextContainer, 'aria-hidden', 'true');
      renderer.setStyle(nextContainer, { display: 'none' });
      renderer.appendChild(getContainerParent(), nextContainer);
      container = nextContainer;

      return nextContainer;
    };

    const cleanupContainer = () => {
      if (!container) {
        return;
      }

      const parent = renderer.parentNode(container);
      if (parent) {
        renderer.removeChild(parent, container);
      }

      container = null;
    };

    const mount = <TComponent>(component: Type<TComponent>) => {
      const existingComponent = mountedComponents.get(component);
      if (existingComponent) {
        return existingComponent as ComponentRef<TComponent>;
      }

      const componentRef = createComponent(component, { environmentInjector: envInjector });
      appRef.attachView(componentRef.hostView);
      renderer.appendChild(ensureContainer(), componentRef.location.nativeElement);
      mountedComponents.set(component, componentRef);

      return componentRef;
    };

    destroyRef.onDestroy(() => {
      if (appRef.destroyed) {
        mountedComponents.clear();
        cleanupContainer();

        return;
      }

      mountedComponents.forEach((componentRef) => {
        appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      });
      mountedComponents.clear();

      cleanupContainer();
    });

    return { mount };
  },
  { name: 'StyleManager' },
);
