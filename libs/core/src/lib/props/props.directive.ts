import { DestroyRef, Directive, effect, inject, input, untracked } from '@angular/core';
import { createPropHandlers } from './create-prop-handlers';
import { Props, PropsInternal } from './create-props';
import { bindProps, unbindProps } from './props-binding';

@Directive({
  selector: '[etProps]',
})
export class PropsDirective {
  private destroyRef = inject(DestroyRef);

  props = input.required<PropsInternal, Props>({ alias: 'etProps', transform: (d) => d as PropsInternal });

  propHandlers = createPropHandlers();

  constructor() {
    let boundProps: PropsInternal | null = null;

    effect(() => {
      const props = this.props();

      untracked(() => {
        if (boundProps) {
          unbindProps({ handlers: this.propHandlers, props: boundProps });
        }

        bindProps({
          handlers: this.propHandlers,
          props,
        });
        boundProps = props;
      });
    });

    this.destroyRef.onDestroy(() => {
      if (boundProps) unbindProps({ handlers: this.propHandlers, props: boundProps });
    });
  }
}
