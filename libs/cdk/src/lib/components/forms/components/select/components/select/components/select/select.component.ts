import { AsyncPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { ChevronIconComponent } from '../../../../../../../icons/chevron-icon';
import { InputDirective } from '../../../../../../directives/input';
import { NativeInputRefDirective } from '../../../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../../../utils';
import { SELECT_TOKEN, SelectDirective } from '../../directives/select';
import { SelectBodyComponent } from '../../partials/select-body';

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
  imports: [NativeInputRefDirective, AsyncPipe, ChevronIconComponent, LetDirective],
  hostDirectives: [{ directive: InputDirective }, { directive: SelectDirective, inputs: ['multiple', 'emptyText'] }],
})
export class SelectComponent extends DecoratedInputBase implements AfterViewInit {
  protected readonly select = inject<SelectDirective<SelectBodyComponent>>(SELECT_TOKEN);

  @ViewChild('selectBodyTpl')
  selectBodyTpl: TemplateRef<unknown> | null = null;

  ngAfterViewInit(): void {
    if (!this.selectBodyTpl) return;

    this.select.setSelectBody({ component: SelectBodyComponent, template: this.selectBodyTpl });
  }
}
