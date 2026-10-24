import { Component, Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { mountSelect } from '../forms/testing/select-driver';
import { PageSizeSelectComponent } from './page-size-select.component';
import { providePaginationLabels } from './pagination-labels';

@Component({
  template: `<et-page-size-select [(pageSize)]="pageSize" [sizes]="sizes()" />`,
  imports: [PageSizeSelectComponent],
})
class HostComponent {
  public pageSize = signal(25);
  public sizes = signal<readonly number[]>([10, 25, 50, 100]);
}

const mount = (providers: Provider[] = []) => mountSelect(HostComponent, providers, { directiveSelector: 'et-select' });

describe('PageSizeSelectComponent', () => {
  it('renders one option per size', async () => {
    const driver = mount();

    await driver.open();

    expect(driver.optionLabels()).toEqual(['10', '25', '50', '100']);
  });

  it('shows the current page size as the value', () => {
    const driver = mount();

    expect(driver.valueText()).toBe('25');
  });

  it('writes the picked size back through the model', async () => {
    const driver = mount();

    await driver.open();
    driver.clickOptionByLabel('50');

    expect(driver.host.pageSize()).toBe(50);
  });

  it('follows the model when it changes from outside', () => {
    const driver = mount();

    driver.host.pageSize.set(100);
    driver.tick();

    expect(driver.valueText()).toBe('100');
  });

  it('takes the sizes it is given', async () => {
    const driver = mount();

    driver.host.sizes.set([5, 500]);
    driver.tick();
    await driver.open();

    expect(driver.optionLabels()).toEqual(['5', '500']);
  });

  it('cannot be cleared, since a page size is always set', () => {
    const driver = mount();

    expect((driver.fixture.nativeElement as HTMLElement).querySelector('.et-input-clear')).toBeNull();
  });

  it('takes its strings from the pagination labels', async () => {
    const driver = mount([
      providePaginationLabels({ pageSize: 'Einträge pro Seite', pageSizeOption: (size) => `${size} Stück` }),
    ]);

    expect((driver.fixture.nativeElement as HTMLElement).querySelector('et-label')?.textContent?.trim()).toBe(
      'Einträge pro Seite',
    );

    await driver.open();

    expect(driver.optionLabels()[0]).toBe('10 Stück');
  });
});
