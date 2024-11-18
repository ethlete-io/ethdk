import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { ScrollableImports } from '../../../scrollable/scrollable.imports';
import { NewBracketComponent } from '../../components/new-bracket';
import { BracketData } from '../../components/new-bracket/bracket-new';

@Component({
  selector: 'et-sb-bracket-new',
  template: `
    <et-scrollable stickyButtons>
      <et-new-bracket [bracketData]="bracketData()" />
    </et-scrollable>
  `,
  styles: [``],
  standalone: true,
  imports: [NewBracketComponent, ScrollableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StorybookBracketNewComponent {
  bracketData = input.required<BracketData<unknown, unknown>>();
}
