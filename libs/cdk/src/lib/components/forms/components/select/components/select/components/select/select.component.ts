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
import { CHEVRON_ICON } from '../../../../../../../icons/chevron-icon';
import { provideIcons } from '../../../../../../../icons/icon-provider';
import { IconDirective } from '../../../../../../../icons/icon.directive';
import { TIMES_ICON } from '../../../../../../../icons/times-icon';
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
  imports: [AsyncPipe, IconDirective],
  hostDirectives: [{ directive: InputDirective }, { directive: SelectDirective, inputs: ['multiple', 'emptyText'] }],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
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
