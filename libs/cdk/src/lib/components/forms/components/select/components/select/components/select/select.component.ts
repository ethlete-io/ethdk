import { AsyncPipe, NgIf, NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { ChevronIconComponent } from '../../../../../../../icons';
import { InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';
import { SELECT_TOKEN, SelectDirective } from '../../directives';
import { SelectBodyComponent } from '../../partials';

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
  imports: [NgIf, NativeInputRefDirective, AsyncPipe, ChevronIconComponent, NgTemplateOutlet],
  hostDirectives: [{ directive: InputDirective }, { directive: SelectDirective, inputs: ['searchable'] }],
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
