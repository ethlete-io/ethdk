import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { ScrollableImports } from '../../../scrollable/scrollable.imports';
import { BracketComponent } from '../../components/bracket';

@Component({
  selector: 'et-sb-bracket',
  template: `
    <et-scrollable stickyButtons>
      <et-bracket
        [itemHeight]="itemHeight"
        [itemWith]="itemWith"
        [columnGap]="columnGap"
        [rowGap]="rowGap"
        [roundsWithMatches]="roundsWithMatches"
        [roundHeaderHeight]="roundHeaderHeight"
        [upperLowerBracketGap]="upperLowerBracketGap"
      />
    </et-scrollable>
  `,
  styles: [
    `
      .et-bracket-match {
        background-color: rgb(101, 101, 101);
        border-radius: 10px;
        font-size: 10px;
        padding: 1rem;
        box-sizing: border-box;
      }

      .et-bracket-round {
        font-size: 10px;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        border-bottom: 1px solid rgb(101, 101, 101);
      }
    `,
  ],
  imports: [BracketComponent, ScrollableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StorybookBracketComponent {
  get itemWith() {
    return this._itemWith;
  }
  set itemWith(v: string) {
    this._itemWith = v;
  }
  private _itemWith!: string;

  get itemHeight() {
    return this._itemHeight;
  }
  set itemHeight(v: string) {
    this._itemHeight = v;
  }
  private _itemHeight!: string;

  get roundHeaderHeight() {
    return this._roundHeaderHeight;
  }
  set roundHeaderHeight(v: string) {
    this._roundHeaderHeight = v;
  }
  private _roundHeaderHeight!: string;

  get columnGap() {
    return this._columnGap;
  }
  set columnGap(v: string) {
    this._columnGap = v;
  }
  private _columnGap!: string;

  get rowGap() {
    return this._rowGap;
  }
  set rowGap(v: string) {
    this._rowGap = v;
  }
  private _rowGap!: string;

  get upperLowerBracketGap() {
    return this._upperLowerBracketGap;
  }
  set upperLowerBracketGap(v: string) {
    this._upperLowerBracketGap = v;
  }
  private _upperLowerBracketGap = '0px';

  get roundsWithMatches() {
    return this._roundsWithMatches;
  }
  set roundsWithMatches(v: RoundStageStructureWithMatchesView[] | null | undefined) {
    this._roundsWithMatches = v;
  }
  private _roundsWithMatches!: RoundStageStructureWithMatchesView[] | null | undefined;
}
