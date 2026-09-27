import { Component, signal, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSurfaceThemesWithTailwind4, SurfaceTheme } from '@ethlete/core';
import { CARD_IMPORTS, CARD_VARIANTS, CardComponent, CardVariant } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const surface = (name: string, elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type: 'light',
  elevation,
  isDefault,
  background: '250 250 250',
  color: '10 10 10',
  colorMuted: '80 80 80',
  colorSubtle: '160 160 160',
  border: '220 220 220',
});

@Component({
  selector: 'et-scenario-revenue-tile',
  imports: [CARD_IMPORTS],
  template: `
    <et-card [variant]="variant()" [surface]="surface()">
      <h3>Revenue</h3>
      <p>12,400 this month</p>
    </et-card>
  `,
})
class RevenueTileComponent {
  variant = signal<CardVariant | undefined>(undefined);
  surface = signal<string | null>(null);
}

@Component({
  selector: 'et-scenario-default-card',
  imports: [CARD_IMPORTS],
  template: `<et-card><p>Plain</p></et-card>`,
})
class DefaultCardComponent {}

@Component({
  selector: 'et-scenario-stat-grid',
  imports: [CardComponent],
  template: `
    @for (stat of stats; track stat.label) {
      <et-card [variant]="stat.variant">{{ stat.label }}</et-card>
    }
  `,
})
class StatGridComponent {
  stats = [
    { label: 'Wins', variant: CARD_VARIANTS.ELEVATED },
    { label: 'Losses', variant: CARD_VARIANTS.FILLED },
  ];
  cards = viewChildren(CardComponent);
}

describe('card scenarios', () => {
  const scenario = useScenario({
    providers: [provideSurfaceThemesWithTailwind4([surface('paper', 0, true), surface('paper-raised', 1)])],
  });

  it('wraps the projected content in outlined chrome by default', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(DefaultCardComponent);
    const card = (fixture.nativeElement as HTMLElement).querySelector('et-card')!;

    s.tick();

    expect(card.classList).toContain('et-card');
    expect(card.getAttribute('data-variant')).toBe(CARD_VARIANTS.OUTLINED);
    expect(card.querySelector('p')?.textContent).toBe('Plain');
  });

  it('switches between every variant the app picks', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RevenueTileComponent);
    const card = (fixture.nativeElement as HTMLElement).querySelector('et-card')!;

    for (const variant of Object.values(CARD_VARIANTS)) {
      fixture.componentInstance.variant.set(variant);
      s.tick();

      expect(card.getAttribute('data-variant')).toBe(variant);
    }

    expect(card.querySelector('h3')?.textContent).toBe('Revenue');
  });

  it('provides the surface an app names, and inherits the page surface otherwise', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RevenueTileComponent);
    const card = (fixture.nativeElement as HTMLElement).querySelector('et-card')!;

    fixture.componentInstance.surface.set('paper-raised');
    s.tick();

    expect(card.classList).toContain('et-surface--paper-raised');

    fixture.componentInstance.surface.set(null);
    s.tick();

    expect(card.classList).not.toContain('et-surface--paper-raised');
  });

  it('renders one card per stat when imported on its own', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StatGridComponent);

    s.tick();

    const cards = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('et-card'));

    expect(fixture.componentInstance.cards().map((card) => card.variant())).toEqual(['elevated', 'filled']);
    expect(cards.map((card) => [card.textContent?.trim(), card.getAttribute('data-variant')])).toEqual([
      ['Wins', 'elevated'],
      ['Losses', 'filled'],
    ]);
  });
});
