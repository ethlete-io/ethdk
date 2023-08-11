import { AsyncPipe, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ClickOutsideDirective,
  LetDirective,
  createDestroy,
  createReactiveBindings,
} from '@ethlete/core';
import { takeUntil, tap } from 'rxjs';
import { COMBOBOX_TOKEN } from '../../components';
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
  },
  imports: [
    NgTemplateOutlet,
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
export class ComboboxBodyComponent implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _clickOutside = inject(ClickOutsideDirective);
  protected readonly combobox = inject(COMBOBOX_TOKEN);

  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;

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
}
