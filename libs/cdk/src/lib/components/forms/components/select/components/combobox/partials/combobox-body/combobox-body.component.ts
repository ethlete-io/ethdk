import { AsyncPipe, NgComponentOutlet, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  OnInit,
  TemplateRef,
  TrackByFunction,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ClickOutsideDirective,
  LetDirective,
  TypedQueryList,
  createDestroy,
  signalHostAttributes,
  signalHostClasses,
} from '@ethlete/core';
import { ProvideThemeDirective, THEME_PROVIDER } from '@ethlete/theming';
import { BehaviorSubject, combineLatest, map, takeUntil, tap } from 'rxjs';
import { AbstractComboboxBody, AbstractComboboxOption, COMBOBOX_TOKEN } from '../../directives';
import { ComboboxOptionComponent } from '../combobox-option';

export const COMBOBOX_BODY_TOKEN = new InjectionToken<ComboboxBodyComponent>('ET_COMBOBOX_BODY_TOKEN');

let _uniqueId = 0;

@Component({
  selector: 'et-combobox-body',
  templateUrl: './combobox-body.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox-body et-with-default-animation',
    tabindex: '-1',
    '[attr.id]': 'id',
    role: 'listbox',
  },
  imports: [
    NgTemplateOutlet,
    NgComponentOutlet,
    NgFor,
    ComboboxOptionComponent,
    LetDirective,
    AsyncPipe,
    AnimatedLifecycleDirective,
    NgIf,
  ],
  hostDirectives: [ClickOutsideDirective, ProvideThemeDirective],
  providers: [
    {
      provide: COMBOBOX_BODY_TOKEN,
      useExisting: ComboboxBodyComponent,
    },
  ],
})
export class ComboboxBodyComponent implements OnInit, AbstractComboboxBody {
  readonly id = `et-combobox-body-${_uniqueId++}`;

  private readonly _destroy$ = createDestroy();
  private readonly _clickOutside = inject(ClickOutsideDirective);
  private readonly _themeProvider = inject(THEME_PROVIDER);
  protected readonly combobox = inject(COMBOBOX_TOKEN);

  @ViewChild('containerElement', { static: true, read: ElementRef })
  readonly _containerElementRef: ElementRef<HTMLElement> | undefined;

  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;

  @ViewChildren(ComboboxOptionComponent)
  set _options(options: TypedQueryList<ComboboxOptionComponent>) {
    this._options$.next(options);
  }
  readonly _options$ = new BehaviorSubject<TypedQueryList<AbstractComboboxOption> | null>(null);

  readonly hostClassBindings = signalHostClasses({
    'et-combobox-body--loading': toSignal(this.combobox.loading$),
    'et-combobox-body--multiple': toSignal(this.combobox.multiple$),
  });

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-multiselectable': toSignal(this.combobox.multiple$),
    'aria-labelledby': toSignal(this.combobox._input.labelId$),
  });

  protected readonly customErrorComponentInputs$ = combineLatest([
    this.combobox.error$,
    this.combobox.customBodyErrorComponentInputs$,
  ]).pipe(map(([error, inputs]) => ({ error, ...inputs })));

  _bodyTemplate: TemplateRef<unknown> | null = null;

  ngOnInit(): void {
    this._clickOutside.etClickOutside
      .pipe(
        takeUntil(this._destroy$),
        tap(() => this.combobox.close()),
      )
      .subscribe();
  }

  protected trackByFn: TrackByFunction<unknown> = (index, item) => this.combobox._selectionModel.getKey(item);

  _setThemeFromProvider(provider: ProvideThemeDirective) {
    this._themeProvider.syncWithProvider(provider);
  }
}
