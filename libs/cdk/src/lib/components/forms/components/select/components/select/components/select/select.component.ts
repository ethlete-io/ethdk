import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, TemplateRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';

@Component({
  selector: 'et-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select',
  },
  providers: [DestroyService],
  imports: [NgIf, NativeInputRefDirective, AsyncPipe],
  hostDirectives: [{ directive: InputDirective, inputs: ['autocomplete'] }],
})
export class SelectComponent extends DecoratedInputBase {
  @Input()
  get searchable(): boolean {
    return this._searchable$.value;
  }
  set searchable(value: BooleanInput) {
    this._searchable$.next(coerceBooleanProperty(value));
  }
  private _searchable$ = new BehaviorSubject(false);

  @ViewChild('selectBodyTpl')
  selectBodyTpl: TemplateRef<unknown> | null = null;
}
