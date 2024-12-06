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
import { ChevronIconComponent } from '../../../../../../../icons/chevron-icon';
import { TimesIconComponent } from '../../../../../../../icons/times-icon';
import { InputDirective } from '../../../../../../directives/input';
import { DecoratedInputBase } from '../../../../../../utils';
import { SELECT_TOKEN, SelectDirective } from '../../directives/select';
import { SelectBodyComponent } from '../../partials/select-body';

@Component({
  selector: 'et-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select',
  },
  imports: [AsyncPipe, ChevronIconComponent, TimesIconComponent],
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
