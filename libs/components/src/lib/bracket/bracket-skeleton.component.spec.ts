import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { mountControl } from '../testing/control-driver';
import { directiveAt, query, queryAll, textOf } from '../testing/driver-core';
import { PlaceholderBracketShape } from '@ethlete/bracket';
import { BracketSkeletonComponent } from './bracket-skeleton.component';
import { BracketComponent } from './bracket.component';
import { testBracketLayouts } from './testing/bracket-driver';

@Component({
  template: `
    <et-bracket-skeleton
      [shape]="shape()"
      [layouts]="layouts"
      [loadingAllyText]="loadingAllyText()"
      [columnWidth]="columnWidth()"
      [showContinueElement]="showContinueElement()"
    />
  `,
  imports: [BracketSkeletonComponent],
})
class BracketSkeletonTestHost {
  public readonly layouts = testBracketLayouts;
  public readonly shape = signal<PlaceholderBracketShape>({ mode: 'single-elimination', participantCount: 8 });
  public readonly loadingAllyText = signal<string | null>(null);
  public readonly columnWidth = signal<number | undefined>(undefined);
  public readonly showContinueElement = signal<boolean | undefined>(undefined);
}

const mountBracketSkeleton = () => {
  TestBed.resetTestingModule();

  const fixture = mountControl(BracketSkeletonTestHost);

  return {
    fixture,
    host: fixture.componentInstance,
    bracket: () => directiveAt(fixture, BracketComponent, 'et-bracket'),
    matchCells: () => queryAll(fixture, '.et-bracket-element--match'),
    detectChanges: () => fixture.detectChanges(),
  };
};

describe('BracketSkeletonComponent', () => {
  it('draws a skeleton card in every cell without any registered cards', () => {
    const driver = mountBracketSkeleton();

    expect(driver.matchCells()).toHaveLength(7);
    expect(queryAll(driver.fixture, '.et-bracket-element--match .et-bracket-skeleton-match')).toHaveLength(7);
    expect(queryAll(driver.fixture, '.et-bracket-skeleton-final-match')).toHaveLength(1);
    expect(queryAll(driver.fixture, '.et-bracket-element--header .et-bracket-skeleton-round-header')).toHaveLength(3);
  });

  it('follows a new shape', () => {
    const driver = mountBracketSkeleton();

    driver.host.shape.set({ mode: 'double-elimination', participantCount: 8 });
    driver.detectChanges();

    expect(driver.matchCells()).toHaveLength(15);
  });

  it('announces the wait once and hides the drawing from assistive tech', () => {
    const driver = mountBracketSkeleton();

    expect(query(driver.fixture, 'et-skeleton')?.getAttribute('role')).toBe('status');
    expect(textOf(query(driver.fixture, '.et-skeleton-ally-text'))).toBe('Loading…');
    expect(query(driver.fixture, 'et-bracket')?.getAttribute('aria-hidden')).toBe('true');

    driver.host.loadingAllyText.set('Loading the bracket');
    driver.detectChanges();

    expect(textOf(query(driver.fixture, '.et-skeleton-ally-text'))).toBe('Loading the bracket');
  });

  it('keeps journey highlight off', () => {
    const driver = mountBracketSkeleton();

    expect(driver.bracket().settings().disableJourneyHighlight).toBe(true);
  });

  it('draws a skeleton continue card only when the continue element is on', () => {
    const driver = mountBracketSkeleton();

    expect(queryAll(driver.fixture, '.et-bracket-skeleton-continue')).toHaveLength(0);

    driver.host.shape.set({ mode: 'double-elimination', participantCount: 8, includeFinal: false });
    driver.host.showContinueElement.set(true);
    driver.detectChanges();

    expect(driver.bracket().settings().showContinueElement).toBe(true);
    expect(queryAll(driver.fixture, '.et-bracket-skeleton-continue').length).toBeGreaterThan(0);
  });

  it('forwards the layout inputs to the bracket it draws', () => {
    const driver = mountBracketSkeleton();

    driver.host.columnWidth.set(180);
    driver.detectChanges();

    expect(driver.bracket().settings().columnWidth).toBe(180);
    expect(driver.matchCells()[0]?.style.width).toBe('180px');
  });
});
