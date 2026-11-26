import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSurfaceThemesWithTailwind4, ProvideSurfaceDirective, SurfaceTheme } from '@ethlete/core';
import '../../test-helpers';
import { createTableDriver } from './testing/table-driver';
import { TABLE_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string };

const PEOPLE: Person[] = [{ id: 1, name: 'Ada' }];

const COLUMNS = {
  name: { header: 'Name', value: (person) => person.name },
} satisfies TableColumns<Person>;

const surface = (name: string, elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type: 'dark',
  elevation,
  isDefault,
  background: '0 0 0',
  color: '255 255 255',
  colorMuted: '180 180 180',
  colorSubtle: '80 80 80',
  border: '40 40 40',
});

const THEMES = [surface('dark', 0, true), surface('dark-elevated', 1)];

@Component({
  selector: 'et-card-surface-host',
  template: `
    <div [etProvideSurface]="hostSurface()">
      <et-table [columns]="columns" [data]="data" [appearance]="appearance()" />
    </div>
  `,
  imports: [TABLE_IMPORTS, ProvideSurfaceDirective],
})
class HostComponent {
  public columns = COLUMNS;
  public data = PEOPLE;
  public appearance = signal<'cards' | 'enclosed'>('cards');
  public hostSurface = signal<string | null>(null);
}

const rowOf = (themes: SurfaceTheme[] = THEMES) => {
  TestBed.configureTestingModule({ providers: [provideSurfaceThemesWithTailwind4(themes)] });

  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  const driver = createTableDriver(fixture);

  return { fixture, row: () => driver.row(0)! };
};

describe('TableCardSurfaceDirective', () => {
  it('raises a card row one elevation above the surface the table sits on', () => {
    const { row } = rowOf();

    expect(row().classList.contains('et-table-row--card')).toBe(true);
    expect(row().classList.contains('et-surface--dark-elevated')).toBe(true);
    expect(row().classList.contains('et-table-row--card-tint')).toBe(false);
  });

  it('leaves the row on the surface it inherits in every other appearance', () => {
    const { fixture, row } = rowOf();

    fixture.componentInstance.appearance.set('enclosed');
    fixture.detectChanges();

    expect(row().classList.contains('et-table-row--card')).toBe(false);
    expect(row().classList.contains('et-surface--inherited')).toBe(true);
    expect(row().classList.contains('et-table-row--card-tint')).toBe(false);
  });

  it('falls back to a tint where the app registers no surface themes', () => {
    const { row } = rowOf([]);

    expect(row().classList.contains('et-table-row--card')).toBe(true);
    expect(row().classList.contains('et-table-row--card-tint')).toBe(true);
  });

  it('falls back to a tint where the table already sits on the top of the ladder', () => {
    const { fixture, row } = rowOf();

    fixture.componentInstance.hostSurface.set('dark-elevated');
    fixture.detectChanges();

    expect(row().classList.contains('et-table-row--card-tint')).toBe(true);
  });
});
