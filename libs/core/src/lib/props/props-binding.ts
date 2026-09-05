import { isDevMode } from '@angular/core';
import { PropHandlers } from './create-prop-handlers';
import { Props, PropsInternal } from './create-props';

export type BindPropsOptions = {
  props: Props | PropsInternal;
  handlers: PropHandlers;
};

const teardownsByProps = /* @__PURE__ */ new WeakMap<object, Map<string, () => void>>();

export const bindProps = (config: BindPropsOptions) => {
  const props = config.props as PropsInternal;
  const {
    attachEventListeners,
    classBindings,
    attributeBindings,
    styleBindings,
    staticAttributeBindings,
    staticClassBindings,
    staticStyleBindings,
    attached,
    single,
    name,
    bindId,
    attachedElements,
  } = props;

  const { attributes, classes, elementRef, id, styles } = config.handlers;
  const el = elementRef.nativeElement;

  if (attached()) {
    if (attachedElements.has(id)) {
      return;
    } else if (single) {
      const firstAttachedRefElement = attachedElements.first();

      if (isDevMode()) {
        console.error(
          `[${name}] These props can only be attached to a single element at a time.\n\n Already attached to \n`,
          firstAttachedRefElement,
          '\n Trying to attach to \n',
          el,
        );
      }

      return;
    }
  }

  attachedElements.push(id, el);

  const teardowns: Array<() => void> = [];

  if (bindId) {
    el.id = id;
  }

  if (classBindings) {
    const tokens = Object.keys(classBindings);

    classes.pushMany(classBindings);
    teardowns.push(() => classes.removeMany(tokens));
  }

  if (attributeBindings) {
    const tokens = Object.keys(attributeBindings);

    attributes.pushMany(attributeBindings);
    teardowns.push(() => attributes.removeMany(tokens));
  }

  if (styleBindings) {
    const tokens = Object.keys(styleBindings);

    styles.pushMany(styleBindings);
    teardowns.push(() => styles.removeMany(tokens));
  }

  if (staticAttributeBindings) {
    const keys = Object.keys(staticAttributeBindings);

    for (const key of keys) {
      el.setAttribute(key, `${staticAttributeBindings[key]}`);
    }

    teardowns.push(() => keys.forEach((key) => el.removeAttribute(key)));
  }

  if (staticClassBindings) {
    el.classList.add(...staticClassBindings);
    teardowns.push(() => el.classList.remove(...staticClassBindings));
  }

  if (staticStyleBindings) {
    const keys = Object.keys(staticStyleBindings);

    for (const key of keys) {
      el.style.setProperty(key, `${staticStyleBindings[key]}`);
    }

    teardowns.push(() => keys.forEach((key) => el.style.removeProperty(key)));
  }

  if (attachEventListeners) {
    const on = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      el.addEventListener(type, listener, options);
      teardowns.push(() => el.removeEventListener(type, listener, options));
    }) as HTMLElement['addEventListener'];

    attachEventListeners({ on, element: el });
  }

  let teardownsById = teardownsByProps.get(config.props);

  if (!teardownsById) {
    teardownsById = new Map();
    teardownsByProps.set(config.props, teardownsById);
  }

  teardownsById.set(id, () => teardowns.forEach((teardown) => teardown()));
};

export type UnbindPropsOptions = {
  props: Props | PropsInternal;
  handlers: PropHandlers;
};

export const unbindProps = (config: UnbindPropsOptions) => {
  const props = config.props as PropsInternal;
  const { id } = config.handlers;
  const teardownsById = teardownsByProps.get(config.props);

  teardownsById?.get(id)?.();
  teardownsById?.delete(id);

  props.attachedElements.remove(id);
};
