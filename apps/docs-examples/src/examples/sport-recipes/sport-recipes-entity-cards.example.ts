import { Component, ViewEncapsulation } from '@angular/core';
import { CHIP_IMPORTS, MATCH_CARD_IMPORTS, PICTURE_IMPORTS, SKELETON_IMPORTS } from '@ethlete/components';
import { BANNER_SRC, RECIPE_PARTICIPANTS } from './sport-recipes-entity-cards.data';

@Component({
  selector: 'app-sport-recipes-entity-cards-example',
  template: `
    <a class="app-entity-card app-competition-card" href="#">
      <et-picture [defaultSrc]="banner" [aspectRatio]="16 / 9" alt="Regionalliga Nordost" />

      <div class="app-entity-card-meta">
        <strong>Regionalliga Nordost</strong>
        <span>Matchday 14 · 2026/27</span>
      </div>

      <div class="app-entity-card-chips">
        <et-chip size="sm">Football</et-chip>
        <et-chip size="sm">18 teams</et-chip>
      </div>
    </a>

    <div class="app-entity-card-row">
      @for (participant of participants; track participant.id) {
        <div class="app-entity-card">
          <a [participant]="participant" et-match-participant href="#" showSeed></a>
          <span>10 matches · 8 wins</span>
        </div>
      }

      <div class="app-entity-card">
        <et-match-participant [participant]="null" loading />
        <et-skeleton-item shape="text" />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, PICTURE_IMPORTS, CHIP_IMPORTS, SKELETON_IMPORTS],
  styles: `
    .app-entity-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
      color: inherit;
      text-decoration: none;
      inline-size: 240px;
    }

    .app-competition-card {
      inline-size: 320px;
      max-inline-size: 100%;
    }

    .app-competition-card et-picture {
      overflow: hidden;
      border-radius: 8px;
    }

    .app-entity-card-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .app-entity-card-chips,
    .app-entity-card-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .app-entity-card-row {
      gap: 16px;
    }
  `,
})
export class SportRecipesEntityCardsExampleComponent {
  public banner = BANNER_SRC;
  public participants = RECIPE_PARTICIPANTS;
}
