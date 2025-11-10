import { AsyncPipe, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  TemplateRef,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { outputToObservable, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ClickOutsideDirective,
  TypedQueryList,
  createComponentId,
  signalHostAttributes,
  signalHostClasses,
} from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, tap } from 'rxjs';
import { ProvideThemeDirective, THEME_PROVIDER } from '../../../../../../../../theming';
import { AbstractComboboxBody, AbstractComboboxOption, COMBOBOX_TOKEN } from '../../directives/combobox';
import { ComboboxOptionComponent } from '../combobox-option';

export const COMBOBOX_BODY_TOKEN = new InjectionToken<ComboboxBodyComponent>('ET_COMBOBOX_BODY_TOKEN');

@Component({
  selector: 'et-combobox-body',
  templateUrl: './combobox-body.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox-body et-with-default-animation',
    tabindex: '-1',
    '[attr.id]': 'id',
    role: 'listbox',
  },
  imports: [NgTemplateOutlet, NgComponentOutlet, ComboboxOptionComponent, AsyncPipe, AnimatedLifecycleDirective],
  hostDirectives: [ClickOutsideDirective, ProvideThemeDirective],
  providers: [
    {
      provide: COMBOBOX_BODY_TOKEN,
      useExisting: ComboboxBodyComponent,
    },
  ],
})
export class ComboboxBodyComponent implements AbstractComboboxBody {
  clickOutside = inject(ClickOutsideDirective);
  themeProvider = inject(THEME_PROVIDER);
  combobox = inject(COMBOBOX_TOKEN);

  readonly id = createComponentId('et-combobox-body');

  @ViewChild('containerElement', { static: true, read: ElementRef })
  _containerElementRef: ElementRef<HTMLElement> | undefined;

  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  _animatedLifecycle?: AnimatedLifecycleDirective;

  @ViewChildren(ComboboxOptionComponent)
  set _options(options: TypedQueryList<ComboboxOptionComponent>) {
    this._options$.next(options);
  }
  _options$ = new BehaviorSubject<TypedQueryList<AbstractComboboxOption> | null>(null);

  _hostClassBindings = signalHostClasses({
    'et-combobox-body--loading': toSignal(this.combobox.loading$),
    'et-combobox-body--multiple': toSignal(this.combobox.multiple$),
  });

  _hostAttributeBindings = signalHostAttributes({
    'aria-multiselectable': toSignal(this.combobox.multiple$),
    'aria-labelledby': toSignal(this.combobox._input.labelId$),
  });

  _customErrorComponentInputs = toSignal(
    combineLatest([this.combobox.error$, toObservable(this.combobox.bodyErrorComponentInputs)]).pipe(
      map(([error, inputs]) => ({ error, ...inputs })),
    ),
  );

  _bodyTemplate: TemplateRef<unknown> | null = null;

  constructor() {
    outputToObservable(this.clickOutside.didClickOutside)
      .pipe(
        takeUntilDestroyed(),
        tap(() => this.combobox.close()),
      )
      .subscribe();
  }

  _setThemeFromProvider(provider: ProvideThemeDirective) {
    this.themeProvider.syncWithProvider(provider);
  }
}
