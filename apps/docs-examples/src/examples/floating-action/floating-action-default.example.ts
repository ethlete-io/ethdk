import { Component, computed, ViewEncapsulation } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import {
  BUTTON_IMPORTS,
  CHIP_IMPORTS,
  dialogOverlayStrategy,
  FILTER_OVERLAY_IMPORTS,
  FilterOverlayResult,
  FLOATING_ACTION_IMPORTS,
  FloatingActionDirective,
  FORM_FIELD_IMPORTS,
  injectFilterOverlay,
  injectOverlayManager,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  provideFilterOverlay,
  RADIO_GROUP_IMPORTS,
} from '@ethlete/components';
import { filter, tap } from 'rxjs';
import {
  createTeamFilters,
  DIVISION_LABELS,
  DIVISIONS,
  matchTeams,
  REGION_LABELS,
  REGIONS,
  TEAMS,
  TeamFilterValue,
} from '../filter-overlay/filter-overlay.data';

@Component({
  selector: 'app-floating-action-filters-panel',
  template: `
    <div etOverlayHeader>
      <h2 class="app-fa-panel-title" etOverlayTitle>Filters</h2>
    </div>

    <et-overlay-body>
      <div class="app-fa-panel-fields">
        <et-radio-group [formField]="filters.draft.fields.region">
          <et-label>Region</et-label>
          @for (region of REGIONS; track region) {
            <et-radio [value]="region">{{ REGION_LABELS[region] }}</et-radio>
          }
        </et-radio-group>

        <et-radio-group [formField]="filters.draft.fields.division">
          <et-label>Division</et-label>
          @for (division of DIVISIONS; track division) {
            <et-radio [value]="division">{{ DIVISION_LABELS[division] }}</et-radio>
          }
        </et-radio-group>
      </div>
    </et-overlay-body>

    <div class="app-fa-panel-footer" etOverlayFooter>
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
  host: { class: 'app-fa-panel' },
  styles: `
    .app-fa-panel {
      --et-overlay-body-padding-block: 1.6rem;
    }

    .app-fa-panel-title {
      margin: 0;
      font-size: 1.8rem;
    }

    .app-fa-panel-fields {
      display: flex;
      flex-direction: column;
      gap: 2.4rem;
    }

    .app-fa-panel-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }
  `,
})
export class FloatingActionFiltersPanelComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();

  protected readonly REGIONS = REGIONS;
  protected readonly REGION_LABELS = REGION_LABELS;
  protected readonly DIVISIONS = DIVISIONS;
  protected readonly DIVISION_LABELS = DIVISION_LABELS;
}

@Component({
  selector: 'app-floating-action-default-example',
  template: `
    <div #floatingAction="etFloatingAction" class="app-fa" etFloatingAction>
      <div class="app-fa-banner">
        <span class="app-fa-muted">State</span>
        <strong>{{ floatingAction.state() }}</strong>
        <span class="app-fa-muted">Scroll down</span>
      </div>

      <div class="app-fa-toolbar">
        <div>
          <h2 class="app-fa-title" etFloatingActionTop>Teams</h2>
          <p class="app-fa-muted">{{ visibleTeams().length }} of {{ TEAMS.length }} teams</p>
        </div>

        <div etFloatingActionAnchor>
          <button (click)="openFilters(floatingAction)" et-button etFloatingActionTrigger>
            Filters
            @if (filters.activeFilterCount() > 0) {
              <et-chip size="sm">{{ filters.activeFilterCount() }}</et-chip>
            }
          </button>
        </div>
      </div>

      <ul class="app-fa-list" etFloatingActionScope>
        @for (team of visibleTeams(); track team.name) {
          <li class="app-fa-row">
            <strong>{{ team.name }}</strong>
            <span class="app-fa-muted">{{ REGION_LABELS[team.region] }} · {{ DIVISION_LABELS[team.division] }}</span>
          </li>
        } @empty {
          <li class="app-fa-row app-fa-muted">No teams match these filters.</li>
        }
      </ul>

      <div class="app-fa-footer">Footer - the Filters button is gone once the list scrolls out of view</div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FLOATING_ACTION_IMPORTS, BUTTON_IMPORTS, CHIP_IMPORTS],
  styles: `
    .app-fa {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }

    .app-fa-banner {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 1rem 1.4rem;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 1rem;
      font-size: 1.4rem;
    }

    .app-fa-banner > :last-child {
      margin-inline-start: auto;
    }

    .app-fa-muted {
      color: var(--et-surface-color-muted-solid);
    }

    .app-fa-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.6rem;

      p {
        margin: 0.2rem 0 0;
        font-size: 1.4rem;
      }
    }

    .app-fa-title {
      margin: 0;
      font-size: 2rem;
    }

    .app-fa-list {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .app-fa-row {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 1.6rem 1.4rem;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 1rem;
      font-size: 1.4rem;
    }

    .app-fa-footer {
      box-sizing: border-box;
      min-block-size: 100vh;
      padding: 2.4rem 1.4rem;
      border: 1px dashed var(--et-surface-border-solid);
      border-radius: 1rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
      text-align: center;
    }
  `,
})
export class FloatingActionDefaultExampleComponent {
  private overlayManager = injectOverlayManager();

  protected readonly TEAMS = TEAMS;
  protected readonly REGION_LABELS = REGION_LABELS;
  protected readonly DIVISION_LABELS = DIVISION_LABELS;

  protected filters = createTeamFilters().observe();

  protected visibleTeams = computed(() => matchTeams(this.filters.value()));

  protected openFilters(floatingAction: FloatingActionDirective) {
    this.overlayManager
      .open(FloatingActionFiltersPanelComponent, {
        strategies: dialogOverlayStrategy({ width: 420 }),
        providers: [provideFilterOverlay({ queryForm: this.filters })],
      })
      .afterClosed()
      .pipe(
        filter((result) => (result as FilterOverlayResult | undefined)?.didUpdate === true),
        tap(() => floatingAction.scrollToTop()),
      )
      .subscribe();
  }
}
