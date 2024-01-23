import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ContentChildren,
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  Signal,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AnyTemplateType,
  PropsDirective,
  TypedQueryList,
  createDependencyStash,
  createHostProps,
  createProps,
  createSetup,
  templateComputed,
} from '@ethlete/core';
import { filter, pairwise, switchMap, tap } from 'rxjs';

export const ACCORDION_TOKEN = new InjectionToken<EtAccordionItemDirective>('ACCORDION_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: ACCORDION_TOKEN, useExisting: EtAccordionItemDirective }],
})
export class EtAccordionItemDirective {
  disabled = input(false);

  isExpanded = input(false);
  isExpandedManual = signal(false);

  toggleExpanded() {
    this.isExpandedManual.set(!this.isExpandedManual());
  }

  constructor() {
    effect(
      () => {
        this.isExpandedManual.set(this.isExpanded());
      },
      { allowSignalWrites: true },
    );
  }

  headerProps = createProps({
    name: 'ethleteAccordion -> headerProps',
    bindId: true,
    classes: {
      'et-arch-test-accordion__button--disabled': this.disabled,
      'et-arch-test-accordion__button--expanded': this.isExpandedManual,
    },
    attributes: {
      'aria-expanded': this.isExpandedManual,
      'aria-controls': computed(() => this.bodyProps.attachedElements.firstId()),
      disabled: this.disabled,
    },
    styles: {
      color: computed(() => (this.isExpandedManual() ? 'red' : 'blue')),
    },
    listeners: ({ on }) => {
      on('click', () => {
        this.isExpandedManual.set(!this.isExpandedManual());
      });
    },
  });

  bodyProps = createProps({
    name: 'ethleteAccordion -> bodyProps',
    classes: {
      'et-arch-test-accordion__body--expanded': this.isExpandedManual,
    },
    attributes: {
      'aria-hidden': computed(() => !this.isExpandedManual()),
      'aria-labelledby': this.headerProps.attachedElements.firstId,
    },
    styles: {
      height: computed(() => (this.isExpandedManual() ? 'auto' : '0px')),
      opacity: computed(() => (this.isExpandedManual() ? '1' : '0')),
      'pointer-events': computed(() => (this.isExpandedManual() ? 'auto' : 'none')),
    },
  });
}

@Directive({
  standalone: true,
})
export class EtAccordionDirective {
  injector = inject(Injector);

  mode = input<'single' | 'multiple'>('single');

  _externals = createDependencyStash({
    items: signal<EtAccordionItemDirective[]>([]),
  });

  _expandedStates = computed(() => this._externals.items().map((item) => item.isExpandedManual()));

  constructor() {
    const expandedStates = toObservable(this._expandedStates);

    toObservable(this.mode)
      .pipe(
        takeUntilDestroyed(),
        filter((mode) => mode === 'single'),
        switchMap(() => expandedStates),
        pairwise(),
        tap(([prev, curr]) => {
          const prevIndex = prev.findIndex((state) => state);
          const currIndex = curr.findIndex((state, i) => state && i !== prevIndex);

          if (prevIndex === currIndex || currIndex === -1) {
            return;
          }

          if (prevIndex !== -1) {
            this._externals.items()[prevIndex]?.isExpandedManual.set(false);
          }

          if (currIndex !== -1) {
            this._externals.items()[currIndex]?.isExpandedManual.set(true);
          }
        }),
      )
      .subscribe();
  }

  setup = createSetup<{ items: Signal<EtAccordionItemDirective[]> }>({
    this: this,
    setupFn: ({ items }) => this._externals.provideSignal({ signal: items, for: 'items' }),
  });
}

@Component({
  selector: 'ethlete-arch-test-accordion',
  template: `<ng-content />`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: EtAccordionDirective, inputs: ['mode'] }],
})
export class ArchTestAccordionComponent {
  accordion = inject(EtAccordionDirective);

  @ContentChildren(EtAccordionItemDirective)
  set __items(value: TypedQueryList<EtAccordionItemDirective>) {
    this.items.set(value.toArray());
  }
  items = signal<EtAccordionItemDirective[]>([]);

  constructor() {
    this.accordion.setup({ items: this.items });
  }
}

@Component({
  selector: 'ethlete-arch-test-accordion-item',
  template: `
    <button [etProps]="item.headerProps">{{ label() }}</button>
    <div [etProps]="item.bodyProps" style="background-color: dimgray;">
      <ng-content />
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [PropsDirective],
  hostDirectives: [{ directive: EtAccordionItemDirective, inputs: ['disabled', 'isExpanded'] }],
})
export class ArchTestAccordionItemComponent {
  item = inject(EtAccordionItemDirective);

  label = input.required<string>();
}

type OverlayComponentProps = { overlay: EtOverlayDirective };
type OverlayComponentType = ComponentType<OverlayComponentProps>;

@Directive({
  standalone: true,
})
export class EtOverlayTriggerDirective {
  overlay = inject(Overlay);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  isMounted = signal(false);

  _externals = createDependencyStash({
    container: signal<OverlayComponentType | null>(null),
    overlayContent: signal<AnyTemplateType | null>(null),
  });

  _portal: ComponentPortal<OverlayComponentProps> | null = null;
  _overlayRef: OverlayRef | null = null;
  _componentRef: ComponentRef<OverlayComponentProps> | null = null;

  _hostProps = createHostProps({
    name: 'EtOverlayTriggerDirective -> hostProps',
    classes: {
      'et-arch-test-overlay-trigger--open': this.isMounted,
    },
    listeners: ({ on }) => {
      on('click', () => this.toggleMounted());
    },
  });

  constructor() {
    effect(() => {
      const component = this._externals.container();

      if (!component) return;

      this._portal?.detach();
      this._portal = new ComponentPortal(component);
    });
  }

  setup = createSetup<{ container: OverlayComponentType; overlayContent: Signal<AnyTemplateType> }>({
    this: this,
    setupFn: ({ container, overlayContent }) => {
      this._externals.provideValue({ value: container, for: 'container' });
      this._externals.provideSignal({ signal: overlayContent, for: 'overlayContent' });
    },
  });

  // TODO: Animations
  toggleMounted() {
    const component = this._externals.container();

    if (!component || !this._portal) return;

    if (!this._componentRef || !this._overlayRef) {
      this._overlayRef = this.overlay.create();
      this._componentRef = this._overlayRef.attach(this._portal);
      this._componentRef.instance.overlay._content.set(this._externals.overlayContent());

      this.isMounted.set(true);
    } else {
      this._overlayRef.dispose();
      this._componentRef.destroy();

      this._componentRef = null;
      this._overlayRef = null;

      this.isMounted.set(false);
    }
  }
}

@Directive({
  standalone: true,
})
export class EtOverlayDirective {
  _content = signal<AnyTemplateType | null>(null);

  template = templateComputed(this._content);

  arrowProps = createProps({
    name: 'EtOverlayDirective -> arrowProps',
    staticAttributes: {
      'et-floating-arrow': true,
    },
  });
}

@Directive({
  selector: '[ethleteOverlayTrigger]',
  standalone: true,
  hostDirectives: [EtOverlayTriggerDirective],
})
export class ArchTestOverlayTriggerDirective {
  trigger = inject(EtOverlayTriggerDirective);

  overlayContent = input.required<AnyTemplateType>({ alias: 'ethleteOverlayTrigger' });

  constructor() {
    this.trigger.setup({ container: ArchTestOverlayComponent, overlayContent: this.overlayContent });
  }
}

@Component({
  selector: 'ethlete-overlay',
  template: `
    @if (overlay.template(); as template) {
      @switch (template.type) {
        @case ('string') {
          <p>{{ template.value }}</p>
        }
        @case ('template') {
          <ng-container *ngTemplateOutlet="template.value; context: template.context; injector: template.injector" />
        }
        @case ('component') {
          <ng-container *ngComponentOutlet="template.value; inputs: template.inputs" />
        }
      }
    }
    <div [etProps]="overlay.arrowProps"></div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      ethlete-overlay {
        display: block;
        background-color: red;
        padding: 20px;
      }
    `,
  ],
  imports: [NgTemplateOutlet, NgComponentOutlet, PropsDirective],
  hostDirectives: [EtOverlayDirective],
})
export class ArchTestOverlayComponent {
  overlay = inject(EtOverlayDirective);
}
