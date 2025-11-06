import { DestroyRef, Signal, afterNextRender, computed, inject } from '@angular/core';
import { PropHandlers, createPropHandlers } from './create-prop-handlers';
import { createElementDictionary } from './element-dictionary';
import { bindProps, unbindProps } from './props-binding';

export type Props = Readonly<{
  attached: Signal<boolean>;
  attachedElements: PropsAttachedElements;
}>;

export interface PropsAttachedElements {
  first: Signal<HTMLElement | null>;
  firstId: Signal<string | null>;
  get(id: string): HTMLElement | null;
}

export interface PropsAttachedElementsInternal extends PropsAttachedElements {
  has: (id: string) => boolean;
  push: (id: string, element: HTMLElement) => void;
  remove: (id: string) => void;
}

export interface PropsInternal {
  single: boolean;
  name: string;
  bindId: boolean;

  attached: Signal<boolean>;
  attachedElements: PropsAttachedElementsInternal;

  classBindings: Record<string, Signal<unknown>> | null;
  attributeBindings: Record<string, Signal<unknown>> | null;
  styleBindings: Record<string, Signal<unknown>> | null;

  staticClassBindings: string[] | null;
  staticAttributeBindings: Record<string, unknown> | null;
  staticStyleBindings: Record<string, unknown> | null;

  attachEventListeners: ((context: { on: HTMLElement['addEventListener']; element: HTMLElement }) => void) | null;
}

export interface CreatePropsOptions {
  name: string;
  bindId?: boolean;
  single?: boolean;
  classes?: Record<string, Signal<unknown>>;
  attributes?: Record<string, Signal<unknown>>;
  styles?: Record<string, Signal<unknown>>;
  staticClasses?: string[];
  staticAttributes?: Record<string, unknown>;
  staticStyles?: Record<string, unknown>;
  listeners?: (context: { on: HTMLElement['addEventListener']; element: HTMLElement }) => void;
}

export const createProps = (props: CreatePropsOptions): Props => {
  const {
    bindId = false,
    single = true,
    classes: classBindings,
    attributes: attributeBindings,
    styles: styleBindings,
    staticAttributes: staticAttributeBindings = null,
    staticClasses: staticClassBindings = null,
    staticStyles: staticStyleBindings = null,
    listeners,
    name,
  } = props;

  const dictionary = createElementDictionary();
  const attached = computed(() => !dictionary.isEmpty());

  const attachedElements: PropsAttachedElementsInternal = {
    first: dictionary.firstElement,
    firstId: dictionary.firstId,

    has: dictionary.has,
    push: dictionary.push,
    remove: dictionary.remove,
    get: dictionary.get,
  };

  const data: PropsInternal = {
    name,
    single,
    bindId,

    attached,
    attachedElements,

    classBindings: classBindings ?? null,
    attributeBindings: attributeBindings ?? null,
    styleBindings: styleBindings ?? null,

    staticAttributeBindings,
    staticClassBindings,
    staticStyleBindings,

    attachEventListeners: listeners ?? null,
  };

  return data as Props;
};

export interface HostProps {
  props: Props;
  handlers: PropHandlers;
}

export const createHostProps = (props: CreatePropsOptions): HostProps => {
  const data = createProps(props);
  const handlers = createPropHandlers();

  afterNextRender({
    write: () => {
      bindProps({
        handlers,
        props: data,
      });
    },
  });

  const destroyRef = inject(DestroyRef);

  destroyRef.onDestroy(() => {
    unbindProps({
      handlers,
      props: data,
    });
  });

  return { props: data, handlers };
};
