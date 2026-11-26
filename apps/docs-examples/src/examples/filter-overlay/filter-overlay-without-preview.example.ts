import { Component, computed, ViewEncapsulation } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import {
  BUTTON_IMPORTS,
  CHIP_IMPORTS,
  dialogOverlayStrategy,
  FILTER_OVERLAY_IMPORTS,
  FORM_FIELD_IMPORTS,
  injectFilterOverlay,
  injectOverlayManager,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  provideFilterOverlay,
  RADIO_GROUP_IMPORTS,
} from '@ethlete/components';
import { createTeamFilters, matchTeams, REGION_LABELS, REGIONS, TeamFilterValue } from './filter-overlay.data';

@Component({
  selector: 'app-filter-overlay-without-preview-panel',
  template: `
    <div etOverlayHeader>
      <h2 class="app-filter-overlay-plain-title" etOverlayTitle>Filters</h2>
    </div>

    <et-overlay-body>
      <et-radio-group [formField]="filters.draft.fields.region">
        <et-label>Region</et-label>
        @for (region of REGIONS; track region) {
          <et-radio [value]="region">{{ REGION_LABELS[region] }}</et-radio>
        }
      </et-radio-group>
    </et-overlay-body>

    <div class="app-filter-overlay-plain-footer" etOverlayFooter>
      <button et-button etFilterOverlayReset variant="transparent" size="sm">{{ filters.labels().reset }}</button>
      <button #submit="etFilterOverlaySubmit" et-button etFilterOverlaySubmit size="sm">{{ submit.label() }}</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    FILTER_OVERLAY_IMPORTS,
    OVERLAY_CONTENT_IMPORTS,
    FORM_FIELD_IMPORTS,
    RADIO_GROUP_IMPORTS,
    FormField,
  ],
  hostDirectives: [OverlayMainDirective],
  host: { class: 'app-filter-overlay-plain-panel' },
  styles: `
    .app-filter-overlay-plain-panel {
      --et-overlay-body-padding-block: 1.6rem;
    }

    .app-filter-overlay-plain-title {
      margin: 0;
      font-size: 1.8rem;
    }

    .app-filter-overlay-plain-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }
  `,
})
export class FilterOverlayWithoutPreviewPanelComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();

  protected readonly REGIONS = REGIONS;
  protected readonly REGION_LABELS = REGION_LABELS;
}

@Component({
  selector: 'app-filter-overlay-without-preview-example',
  template: `
    <div class="app-example-row">
      <button (click)="openFilters()" et-button>
        Filters
        @if (filters.activeFilterCount() > 0) {
          <et-chip size="sm">{{ filters.activeFilterCount() }}</et-chip>
        }
      </button>

      <span>{{ visibleTeams().length }} teams match</span>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CHIP_IMPORTS],
})
export class FilterOverlayWithoutPreviewExampleComponent {
  private overlayManager = injectOverlayManager();

  protected filters = createTeamFilters().observe();

  protected visibleTeams = computed(() => matchTeams(this.filters.value()));

  protected openFilters() {
    this.overlayManager.open(FilterOverlayWithoutPreviewPanelComponent, {
      strategies: dialogOverlayStrategy({ width: 420 }),
      providers: [provideFilterOverlay({ queryForm: this.filters })],
    });
  }
}
