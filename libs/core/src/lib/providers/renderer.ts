import { inject, RendererFactory2, RendererStyleFlags2 } from '@angular/core';
import { createRootProvider } from '../utils';

export const [provideRenderer, injectRenderer] = createRootProvider(
  () => {
    const rendererFactory = inject(RendererFactory2);
    const renderer = rendererFactory.createRenderer(null, null);

    const addClass = (element: HTMLElement, ...classes: string[]) => {
      classes.forEach((cls) => renderer.addClass(element, cls));
    };

    const removeClass = (element: HTMLElement, ...classes: string[]) => {
      classes.forEach((cls) => renderer.removeClass(element, cls));
    };

    const toggleClass = (element: HTMLElement, className: string, force?: boolean) => {
      const shouldAdd = force ?? !element.classList.contains(className);
      if (shouldAdd) {
        renderer.addClass(element, className);
      } else {
        renderer.removeClass(element, className);
      }
      return shouldAdd;
    };

    const setStyle = (
      element: HTMLElement,
      style: Partial<Record<keyof CSSStyleDeclaration, string | null>>,
      flags?: RendererStyleFlags2,
    ) => {
      Object.entries(style).forEach(([key, value]) => {
        if (!Number.isNaN(Number(key))) return;
        if (value !== null && value !== undefined) {
          renderer.setStyle(element, key, value, flags);
        } else {
          renderer.removeStyle(element, key, flags);
        }
      });
    };

    const removeStyle = (
      element: HTMLElement,
      style: keyof CSSStyleDeclaration | string,
      flags?: RendererStyleFlags2,
    ) => {
      if (!Number.isNaN(Number(style))) return;
      renderer.removeStyle(element, style as string, flags);
    };

    const removeStyles = (element: HTMLElement, ...styles: (keyof CSSStyleDeclaration | string)[]) => {
      styles.forEach((style) => removeStyle(element, style));
    };

    const setCssProperty = (element: HTMLElement, name: string, value: string | null) => {
      if (value !== null && value !== undefined) {
        renderer.setStyle(element, name, value, RendererStyleFlags2.DashCase);
      } else {
        renderer.removeStyle(element, name, RendererStyleFlags2.DashCase);
      }
    };

    const setCssProperties = (element: HTMLElement, properties: Record<string, string | null>) => {
      Object.entries(properties).forEach(([name, value]) => {
        setCssProperty(element, name, value);
      });
    };

    const setAttribute = (element: HTMLElement, name: string, value: string | null, namespace?: string | null) => {
      if (value !== null && value !== undefined) {
        renderer.setAttribute(element, name, value, namespace);
      } else {
        renderer.removeAttribute(element, name, namespace);
      }
    };

    const removeAttribute = (element: HTMLElement, ...names: string[]) => {
      names.forEach((name) => renderer.removeAttribute(element, name));
    };

    const setProperty = (element: HTMLElement, name: string, value: unknown) => {
      renderer.setProperty(element, name, value);
    };

    const setProperties = (element: HTMLElement, properties: Record<string, unknown>) => {
      Object.entries(properties).forEach(([name, value]) => {
        renderer.setProperty(element, name, value);
      });
    };

    const createElement = <K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      namespace?: string | null,
    ): HTMLElementTagNameMap[K] => {
      return renderer.createElement(tagName, namespace);
    };

    const createText = (value: string): Text => {
      return renderer.createText(value);
    };

    const createComment = (value: string): Comment => {
      return renderer.createComment(value);
    };

    const appendChild = (parent: HTMLElement, newChild: Node) => {
      renderer.appendChild(parent, newChild);
    };

    const insertBefore = (parent: Node, newChild: Node, refChild: Node | null) => {
      renderer.insertBefore(parent, newChild, refChild);
    };

    const removeChild = (parent: Node, oldChild: Node, isHostElement?: boolean) => {
      renderer.removeChild(parent, oldChild, isHostElement);
    };

    const selectRootElement = (selectorOrNode: string | HTMLElement, preserveContent?: boolean): HTMLElement => {
      return renderer.selectRootElement(selectorOrNode, preserveContent);
    };

    const parentNode = (node: Node): Node | null => {
      return renderer.parentNode(node);
    };

    const nextSibling = (node: Node): Node | null => {
      return renderer.nextSibling(node);
    };

    const setValue = (node: Node, value: string) => {
      renderer.setValue(node, value);
    };

    const listen = (
      target: HTMLElement | Window | Document | 'window' | 'document' | 'body',
      eventName: string,
      callback: (event: Event) => boolean | void,
    ): (() => void) => {
      return renderer.listen(target, eventName, callback);
    };

    const destroyNode = (node: Node) => {
      if (renderer.destroyNode) {
        renderer.destroyNode(node);
      }
    };

    const replaceChild = (parent: Node, newChild: Node, oldChild: Node) => {
      renderer.insertBefore(parent, newChild, oldChild);
      renderer.removeChild(parent, oldChild);
    };

    const empty = (element: HTMLElement) => {
      while (element.firstChild) {
        renderer.removeChild(element, element.firstChild);
      }
    };

    const setTextContent = (element: HTMLElement, text: string) => {
      renderer.setProperty(element, 'textContent', text);
    };

    const setInnerHTML = (element: HTMLElement, html: string) => {
      renderer.setProperty(element, 'innerHTML', html);
    };

    const setAttributes = (
      element: HTMLElement,
      attributes: Record<string, string | null>,
      namespace?: string | null,
    ) => {
      Object.entries(attributes).forEach(([name, value]) => {
        setAttribute(element, name, value, namespace);
      });
    };

    const setDataAttributes = (element: HTMLElement, data: Record<string, string | null>) => {
      Object.entries(data).forEach(([key, value]) => {
        setAttribute(element, `data-${key}`, value);
      });
    };

    const moveBefore = (config: { newParent: HTMLElement; child: HTMLElement; before?: Node | null }) => {
      type NodeWithMoveBefore = HTMLElement & { moveBefore: (child: Node, before: Node | null) => void };

      const { newParent, child, before = null } = config;
      if ('moveBefore' in newParent) {
        try {
          (newParent as NodeWithMoveBefore).moveBefore(child, before);
        } catch {
          newParent.insertBefore(child, before);
        }
      } else {
        (newParent as HTMLElement).insertBefore(child, before);
      }
    };

    return {
      addClass,
      removeClass,
      toggleClass,
      setStyle,
      removeStyle,
      removeStyles,
      setAttribute,
      removeAttribute,
      setProperty,
      setProperties,
      createElement,
      createText,
      createComment,
      appendChild,
      insertBefore,
      removeChild,
      selectRootElement,
      parentNode,
      nextSibling,
      setValue,
      listen,
      destroyNode,

      replaceChild,
      empty,
      setTextContent,
      setInnerHTML,
      setAttributes,
      setDataAttributes,
      setCssProperty,
      setCssProperties,

      moveBefore,

      renderer,
    };
  },
  { name: 'Angular Renderer' },
);

export type AngularRenderer = NonNullable<ReturnType<typeof injectRenderer>>;
