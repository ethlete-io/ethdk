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
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ClickOutsideDirective,
  LetDirective,
  TypedQueryList,
  createDestroy,
  createReactiveBindings,
} from '@ethlete/core';
import { BehaviorSubject, takeUntil, tap } from 'rxjs';
import { AbstractComboboxBody, AbstractComboboxOption, COMBOBOX_TOKEN } from '../../directives';
import { ComboboxOptionComponent } from '../combobox-option';

export const COMBOBOX_BODY_TOKEN = new InjectionToken<ComboboxBodyComponent>('ET_COMBOBOX_BODY_TOKEN');

@Component({
  selector: 'et-combobox-body',
  templateUrl: './combobox-body.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox-body et-with-default-animation',
    tabindex: '-1',
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
  hostDirectives: [ClickOutsideDirective],
  providers: [
    {
      provide: COMBOBOX_BODY_TOKEN,
      useExisting: ComboboxBodyComponent,
    },
  ],
})
export class ComboboxBodyComponent implements OnInit, AbstractComboboxBody {
  _elementRef?: ElementRef<HTMLElement> | undefined;
  _markForCheck?: (() => void) | undefined;
  private readonly _destroy$ = createDestroy();
  private readonly _clickOutside = inject(ClickOutsideDirective);
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

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-combobox-body--loading',
      observable: this.combobox.loading$,
    },
    {
      attribute: 'class.et-combobox-body--multiple',
      observable: this.combobox.multiple$,
    },
  );

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
}
