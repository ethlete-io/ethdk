import { DestroyRef, Directive, afterNextRender, inject, input } from '@angular/core';
import { createPropHandlers } from './create-prop-handlers';
import { Props, PropsInternal } from './create-props';
import { bindProps, unbindProps } from './props-binding';

@Directive({
  selector: '[etProps]',
  standalone: true,
})
export class PropsDirective {
  destroyRef = inject(DestroyRef);

  props = input.required<PropsInternal, Props>({ alias: 'etProps', transform: (d) => d as PropsInternal });

  propHandlers = createPropHandlers();

  constructor() {
    afterNextRender({
      write: () => {
        bindProps({
          handlers: this.propHandlers,
          props: this.props(),
        });
      },
    });

    this.destroyRef.onDestroy(() => {
      unbindProps({
        handlers: this.propHandlers,
        props: this.props(),
      });
    });
  }
}
