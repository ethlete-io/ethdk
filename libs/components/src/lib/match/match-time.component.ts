import { Component, ViewEncapsulation } from '@angular/core';

/** A kick-off or clock time, drawn in tabular figures so a column of them lines up. Content is the text. */
@Component({
  selector: 'et-match-time',
  template: '<ng-content />',
  styleUrl: './match-time.component.css',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'et-match-time' },
})
export class MatchTimeComponent {}
