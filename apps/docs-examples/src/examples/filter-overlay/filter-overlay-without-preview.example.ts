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
  INPUT_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  provideFilterOverlay,
} from '@ethlete/components';
import { createTeamFilters, matchTeams, TeamFilterValue } from './filter-overlay.data';

@Component({
  selector: 'app-filter-overlay-without-preview-panel',
  template: `
    <div etOverlayHeader>
      <h2 class="app-filter-overlay-plain-title" etOverlayTitle>Filters</h2>
    </div>

    <et-overlay-body>
      <et-form-field>
        <et-label>Search</et-label>
        <et-input [formField]="filters.draft.fields.search" placeholder="Team name" />
      </et-form-field>
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
    INPUT_IMPORTS,
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
