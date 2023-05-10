import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, ViewChild, ViewEncapsulation, inject } from '@angular/core';
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
  imports: [NgIf, NativeInputRefDirective, AsyncPipe],
  hostDirectives: [
    { directive: InputDirective, inputs: ['autocomplete'] },
    { directive: SelectDirective, inputs: ['searchable'] },
  ],
})
export class SelectComponent extends DecoratedInputBase {
  protected readonly select = inject<SelectDirective<SelectBodyComponent>>(SELECT_TOKEN);

  @ViewChild('selectBodyTpl')
  selectBodyTpl: TemplateRef<unknown> | null = null;

  mountOrUnmountSelectBody() {
    if (!this.selectBodyTpl) return;

    this.select.mountOrUnmountSelectBody(this.selectBodyTpl, SelectBodyComponent);
  }
}
