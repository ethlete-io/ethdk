import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
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

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const select = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;

const pick = (fixture: ComponentFixture<HostComponent>, value: string) => {
  const element = select(fixture);

  element.value = value;
  element.dispatchEvent(new Event('change'));
  fixture.detectChanges();
};

describe('PageSizeSelectComponent', () => {
  it('renders one option per size', () => {
    const fixture = create();

    expect([...select(fixture).options].map((option) => option.textContent?.trim())).toEqual(['10', '25', '50', '100']);
  });

  it('shows the current page size as the selected option', () => {
    const fixture = create();

    expect(select(fixture).value).toBe('25');
  });

  it('writes the picked size back through the model', () => {
    const fixture = create();

    pick(fixture, '50');

    expect(fixture.componentInstance.pageSize()).toBe(50);
  });

  it('follows the model when it changes from outside', () => {
    const fixture = create();

    fixture.componentInstance.pageSize.set(100);
    fixture.detectChanges();

    expect(select(fixture).value).toBe('100');
  });

  it('takes the sizes it is given', () => {
    const fixture = create();

    fixture.componentInstance.sizes.set([5, 500]);
    fixture.detectChanges();

    expect([...select(fixture).options].map((option) => option.value)).toEqual(['5', '500']);
  });

  it('names itself with the visible label, which wraps the control', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('label')?.contains(select(fixture))).toBe(true);
    expect(host.querySelector('.et-page-size-select-text')?.textContent?.trim()).toBe('Items per page');
  });

  it('takes its strings from the pagination labels', () => {
    TestBed.configureTestingModule({
      providers: [
        providePaginationLabels({ pageSize: 'Einträge pro Seite', pageSizeOption: (size) => `${size} Stück` }),
      ],
    });

    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.et-page-size-select-text')?.textContent?.trim()).toBe('Einträge pro Seite');
    expect(select(fixture).options[0]?.textContent?.trim()).toBe('10 Stück');
  });

  it('leaves the page alone — resetting it is the consumer’s call', () => {
    const fixture = create();

    // Nothing here to assert against but the absence of an output: the component has exactly one,
    // `pageSizeChange`, so there is no way for it to move a page it never sees.
    pick(fixture, '10');

    expect(fixture.componentInstance.pageSize()).toBe(10);
  });
});
