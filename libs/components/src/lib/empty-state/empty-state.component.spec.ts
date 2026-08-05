import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { EMPTY_STATE_IMPORTS } from './empty-state.imports';

@Component({
  selector: 'et-test-empty-state-host',
  template: `<et-empty-state />`,
  imports: [EMPTY_STATE_IMPORTS],
})
class EmptyStateDefaultHostComponent {}

@Component({
  selector: 'et-test-empty-state-configured-host',
  template: `
    <et-empty-state [heading]="heading()" [description]="description()">
      <span etEmptyStateAction>Retry</span>
    </et-empty-state>
  `,
  imports: [EMPTY_STATE_IMPORTS],
})
class EmptyStateConfiguredHostComponent {
  public heading = signal<string | undefined>(undefined);
  public description = signal<string | undefined>(undefined);
}

describe('EmptyStateComponent', () => {
  it('renders nothing but the host class when unconfigured', () => {
    const fixture = TestBed.createComponent(EmptyStateDefaultHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('et-empty-state') as HTMLElement;

    expect(host.classList).toContain('et-empty-state');
    expect(host.textContent?.trim()).toBe('');
  });

  it('renders the heading and description when set', () => {
    const fixture = TestBed.createComponent(EmptyStateConfiguredHostComponent);
    fixture.componentInstance.heading.set('No results');
    fixture.componentInstance.description.set('Try a different search term.');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.et-empty-state-title')?.textContent).toBe('No results');
    expect(host.querySelector('.et-empty-state-description')?.textContent).toBe('Try a different search term.');
  });

  it('projects the action content', () => {
    const fixture = TestBed.createComponent(EmptyStateConfiguredHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[etEmptyStateAction]')?.textContent).toBe('Retry');
  });
});
