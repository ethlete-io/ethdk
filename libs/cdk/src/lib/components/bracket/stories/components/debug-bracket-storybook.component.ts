import { JsonPipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { controlValueSignal } from '@ethlete/core';
import {
  BRACKET_DATA_LAYOUT,
  BracketDataLayout,
  BracketDataSource,
  NewBracketDefaultMatchComponent,
  NewBracketDefaultRoundHeaderComponent,
  TOURNAMENT_MODE,
} from '../../components/new-bracket';
import {
  createDoubleEliminationGrid,
  createSingleEliminationGrid,
  gridColumnsToGridProperty,
} from '../../components/new-bracket/drawing/grid';
import { createNewBracket } from '../../components/new-bracket/linked';

@Component({
  selector: 'et-sb-debug-bracket',
  templateUrl: './debug-bracket-storybook.component.html',
  imports: [ReactiveFormsModule, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'display: grid; width: 100%; height: 100%; position: relative;',
  },
  styles: `
    et-sb-debug-bracket {
      ul {
        margin: 0;
        padding: 0;

        list-style: none;

        li {
          margin: 0;
          padding: 0;
        }
      }
    }
  `,
})
export class StorybookDebugBracketComponent {
  source = input.required<BracketDataSource<unknown, unknown>>();

  columnWidth = input(250, { transform: numberAttribute });
  matchHeight = input(75, { transform: numberAttribute });
  roundHeaderHeight = input(50, { transform: numberAttribute });
  columnGap = input(60, { transform: numberAttribute });
  rowGap = input(30, { transform: numberAttribute });
  lineStartingCurveAmount = input(10, { transform: numberAttribute });
  lineEndingCurveAmount = input(0, { transform: numberAttribute });
  lineWidth = input(2, { transform: numberAttribute });
  lineDashArray = input(0, { transform: numberAttribute });
  lineDashOffset = input(0, { transform: numberAttribute });
  upperLowerGap = input(20, { transform: numberAttribute });
  finalMatchHeight = input(200, { transform: numberAttribute });
  finalColumnWidth = input(400, { transform: numberAttribute });

  layout = input<BracketDataLayout>(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);

  hideRoundHeaders = input(false, { transform: booleanAttribute });
  disableJourneyHighlight = input(false, { transform: booleanAttribute });

  bracketData = computed(() => createNewBracket(this.source(), { layout: this.layout() }));

  definitions = computed(() => {
    const bracketData = this.bracketData();

    const options = {
      includeRoundHeaders: !this.hideRoundHeaders(),
      columnGap: this.columnGap(),
      upperLowerGap: this.bracketData().mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ? this.upperLowerGap() : 0,
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      layout: this.layout(),
      finalMatchHeight: this.finalMatchHeight(),
      finalColumnWidth: this.finalColumnWidth(),
    };

    const components = {
      match: NewBracketDefaultMatchComponent,
      finalMatch: NewBracketDefaultMatchComponent,
      roundHeader: NewBracketDefaultRoundHeaderComponent,
    };

    switch (bracketData.mode) {
      case TOURNAMENT_MODE.DOUBLE_ELIMINATION: {
        const grid = createDoubleEliminationGrid(bracketData, options, components);

        console.log('DOUBLE_ELIMINATION');

        console.log(grid);

        return {
          css: gridColumnsToGridProperty(grid.raw.grid.masterColumns),
          grid,
        };
      }
      case TOURNAMENT_MODE.SINGLE_ELIMINATION: {
        const grid = createSingleEliminationGrid(bracketData, options, components);

        console.log('SINGLE_ELIMINATION');

        console.log(grid);
        return { css: gridColumnsToGridProperty(grid.raw.grid.masterColumns), grid };
      }
    }

    throw new Error(`Unsupported tournament mode: ${bracketData.mode}`);
  });

  showMasterColumnsCtrl = new FormControl(false);
  showSectionsCtrl = new FormControl(false);
  showSubColumnsCtrl = new FormControl(false);
  showElementContainersCtrl = new FormControl(false);
  showElementsCtrl = new FormControl(true);
  showGapElementsCtrl = new FormControl(false);
  showPartsCtrl = new FormControl(false);

  showMasterColumnsCtrlValue = controlValueSignal(this.showMasterColumnsCtrl);
  showSectionsCtrlValue = controlValueSignal(this.showSectionsCtrl);
  showSubColumnsCtrlValue = controlValueSignal(this.showSubColumnsCtrl);
  showElementContainersCtrlValue = controlValueSignal(this.showElementContainersCtrl);
  showElementsCtrlValue = controlValueSignal(this.showElementsCtrl);
  showGapElementsCtrlValue = controlValueSignal(this.showGapElementsCtrl);
  showPartsCtrlValue = controlValueSignal(this.showPartsCtrl);
}
