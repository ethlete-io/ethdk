import { PropHandlers } from './create-prop-handlers';
import { Props, PropsInternal } from './create-props';

export interface BindPropsOptions {
  props: Props | PropsInternal;
  handlers: PropHandlers;
}

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

      console.error(
        `[${name}] These props can only be attached to a single element at a time.\n\n Already attached to \n`,
        firstAttachedRefElement,
        '\n Trying to attach to \n',
        el,
      );

      return;
    }
  }

  attachedElements.push(id, el);

  if (bindId) {
    el.id = id;
  }

  if (classBindings) {
    classes.pushMany(classBindings);
  }

  if (attributeBindings) {
    attributes.pushMany(attributeBindings);
  }

  if (styleBindings) {
    styles.pushMany(styleBindings);
  }

  if (staticAttributeBindings) {
    for (const key in staticAttributeBindings) {
      el.setAttribute(key, `${staticAttributeBindings[key]}`);
    }
  }

  if (staticClassBindings) {
    el.classList.add(...staticClassBindings);
  }

  if (staticStyleBindings) {
    for (const key in staticStyleBindings) {
      el.style.setProperty(key, `${staticStyleBindings[key]}`);
    }
  }

  if (attachEventListeners) {
    attachEventListeners({
      on: el.addEventListener.bind(el),
      element: el,
    });
  }
};

export interface UnbindPropsOptions {
  props: Props | PropsInternal;
  handlers: PropHandlers;
}

export const unbindProps = (config: UnbindPropsOptions) => {
  const props = config.props as PropsInternal;

  props.attachedElements.remove(config.handlers.id);
};
