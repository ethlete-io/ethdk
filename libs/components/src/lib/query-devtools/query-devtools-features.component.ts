import { Component, input, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsFeature } from '@ethlete/query';

/** A feature list: the feature's name, followed by the options it was configured with. */
@Component({
  selector: 'et-query-devtools-features',
  template: `
    <ul class="et-query-devtools-features">
      @for (feature of features(); track feature.type) {
        <li class="et-query-devtools-feature">
          <span class="et-query-devtools-chip">{{ featureLabel(feature.type) }}</span>
          <!-- Always rendered: the list is one grid, so a feature without options still needs its cell
               for the next row's chip to stay in the same column. -->
          <span class="et-query-devtools-feature-details">
            @for (detail of feature.details; track detail.label) {
              <span class="et-query-devtools-feature-detail">
                <span class="et-query-devtools-feature-label">{{ detail.label }}</span>
                <span class="et-query-devtools-feature-value">{{ detail.value }}</span>
              </span>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styleUrl: './query-devtools-features.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsFeaturesComponent {
  public features = input.required<QueryDevtoolsFeature[]>();

  protected featureLabel(type: string) {
    return type
      .replace(/^WITH_/, '')
      .replace(/_/g, ' ')
      .toLowerCase();
  }
}
