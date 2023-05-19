import { AsyncPipe, NgFor, NgIf } from '@angular/common';
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
import { ChevronIconComponent } from '../../../../../../../icons';
import { InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';
import { SELECT_TOKEN, SelectBodyComponent, SelectDirective } from '../../../select';
import { COMBOBOX_TOKEN, ComboboxDirective } from '../../directives';

@Component({
  selector: 'et-combobox',
  templateUrl: './combobox.component.html',
  styleUrls: ['./combobox.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox',
  },
  imports: [NgIf, NativeInputRefDirective, AsyncPipe, ChevronIconComponent, LetDirective, NgFor],
  hostDirectives: [
    { directive: InputDirective },
    { directive: SelectDirective, inputs: ['multiple', 'emptyText'] },
    ComboboxDirective,
  ],
})
export class ComboboxComponent extends DecoratedInputBase implements AfterViewInit {
  protected readonly select = inject<SelectDirective<SelectBodyComponent>>(SELECT_TOKEN);
  protected readonly combobox = inject<ComboboxDirective>(COMBOBOX_TOKEN);

  @ViewChild('selectBodyTpl')
  selectBodyTpl: TemplateRef<unknown> | null = null;

  ngAfterViewInit(): void {
    if (!this.selectBodyTpl) return;

    this.select.setSelectBody({ component: SelectBodyComponent, template: this.selectBodyTpl });
  }
}
