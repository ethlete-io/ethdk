import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ContentChildren,
  QueryList,
  ViewEncapsulation,
} from '@angular/core';
import { CheckboxGroupControlDirective, CHECKBOX_GROUP_CONTROL_TOKEN, CHECKBOX_TOKEN } from '../../directives';
import { CheckboxComponent } from '../checkbox';

@Component({
  selector: 'et-checkbox-group',
  templateUrl: './checkbox-group.component.html',
  styleUrls: ['./checkbox-group.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-checkbox-group',
  },
})
export class CheckboxGroupComponent implements AfterContentInit {
  @ContentChildren(CHECKBOX_TOKEN)
  checkboxes?: QueryList<CheckboxComponent>;

  @ContentChild(CHECKBOX_GROUP_CONTROL_TOKEN)
  groupControl?: CheckboxGroupControlDirective;

  ngAfterContentInit(): void {
    console.log(this.checkboxes);
    console.log(this.groupControl);
  }
}
