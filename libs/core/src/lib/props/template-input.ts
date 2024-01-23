import { ComponentType } from '@angular/cdk/portal';
import { Injector, Signal, TemplateRef, computed } from '@angular/core';

export type AnyTemplateType =
  | string
  | TemplateRef<unknown>
  | ComponentType<unknown>
  | TemplateRefWithContext
  | ComponentTypeWithInputs;

export type TemplateRefWithContext<T = Record<string, unknown> | undefined, J = unknown> = {
  template: TemplateRef<J>;
  context?: T;
  injector?: Injector;
};

export type ComponentTypeWithInputs<T = Record<string, unknown> | undefined, J = unknown> = {
  component: ComponentType<J>;
  inputs?: T;
  injector?: Injector;
};

export type StringTemplate = {
  type: 'string';
  value: string;
};

export type NgTemplateTemplate = {
  type: 'template';
  value: TemplateRef<unknown>;
  context?: Record<string, unknown>;
  injector: Injector | null;
};

export type ComponentTemplate = {
  type: 'component';
  value: ComponentType<unknown>;
  inputs?: Record<string, unknown>;
  injector: Injector | null;
};

export const templateComputed = (templateSignal: Signal<AnyTemplateType | null>) =>
  computed((): StringTemplate | NgTemplateTemplate | ComponentTemplate | null => {
    const content = templateSignal();

    if (!content) return null;

    if (typeof content === 'string') {
      return {
        type: 'string',
        value: content,
      };
    }

    if (content instanceof TemplateRef) {
      return {
        type: 'template',
        value: content,
        injector: null,
      };
    }

    if ('component' in content) {
      return {
        type: 'component',
        value: content.component,
        inputs: content.inputs,
        injector: content.injector ?? null,
      };
    }

    if ('template' in content) {
      return {
        type: 'template',
        value: content.template,
        context: content.context,
        injector: content.injector ?? null,
      };
    }

    return {
      type: 'component',
      value: content,
      injector: null,
    };
  });
