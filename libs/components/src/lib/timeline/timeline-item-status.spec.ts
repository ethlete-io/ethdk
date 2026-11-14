import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ColorTheme, ProvideColorDirective, provideColorThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { TEST_SEMANTIC_COLOR_THEMES } from '../testing/color-themes';
import { TimelineItemDirective, TimelineItemStatus } from './headless/timeline-item.directive';
import { TimelineDirective } from './headless/timeline.directive';
import { TIMELINE_IMPORTS } from './timeline.imports';

@Component({
  selector: 'et-test-timeline-status-host',
  template: `
    <et-timeline>
      <et-timeline-item [status]="status()"><p>Deployment</p></et-timeline-item>
      <et-timeline-item status="upcoming">
        <b etTimelineMarker>R</b>
        <p>Rollout</p>
      </et-timeline-item>
    </et-timeline>
  `,
  imports: [TIMELINE_IMPORTS],
})
class StatusHostComponent {
  public status = signal<TimelineItemStatus | null>(null);
}

@Component({
  selector: 'et-test-headless-timeline-host',
  template: `
    <ol etTimeline>
      <li etTimelineItem status="complete">Kick-off</li>
      <li etTimelineItem status="current">Half-time</li>
      <li etTimelineItem>Full-time</li>
    </ol>
  `,
  imports: [TimelineDirective, TimelineItemDirective],
})
class HeadlessHostComponent {}

describe('timeline item status', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(TEST_SEMANTIC_COLOR_THEMES)] });
  });

  it('renders no status, icon or state text by default', () => {
    const fixture = TestBed.createComponent(StatusHostComponent);
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('et-timeline-item') as HTMLElement;

    expect(item.hasAttribute('data-status')).toBe(false);
    expect(item.querySelector('.et-timeline-item-marker')?.children.length).toBe(0);
    expect(item.querySelector('.et-timeline-item-status')).toBeNull();
  });

  it('shows a resolved status as a marker icon and announces it', () => {
    const fixture = TestBed.createComponent(StatusHostComponent);
    fixture.componentInstance.status.set('skipped');
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('et-timeline-item') as HTMLElement;

    expect(item.getAttribute('data-status')).toBe('skipped');
    expect(item.querySelector('.et-timeline-item-marker .et-icon')).not.toBeNull();
    expect(item.querySelector('.et-timeline-item-status')?.textContent).toBe('Skipped');
  });

  it('marks the current item with aria-current', () => {
    const fixture = TestBed.createComponent(StatusHostComponent);
    fixture.componentInstance.status.set('current');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-timeline-item').getAttribute('aria-current')).toBe('step');
  });

  it('recolors an outcome status in the semantic theme', () => {
    const fixture = TestBed.createComponent(StatusHostComponent);
    fixture.componentInstance.status.set('error');
    fixture.detectChanges();

    const color = fixture.debugElement.query(By.css('et-timeline-item')).injector.get(ProvideColorDirective);

    expect((color.effectiveColor() as ColorTheme)?.name).toBe(
      TEST_SEMANTIC_COLOR_THEMES.find((theme) => theme.type === 'error')?.name,
    );
  });

  it('keeps a projected marker over the status icon', () => {
    const fixture = TestBed.createComponent(StatusHostComponent);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelectorAll('.et-timeline-item-marker')[1] as HTMLElement;

    expect(marker.textContent?.trim()).toBe('R');
  });

  it('gives any markup the list semantics and the status with the headless directives', () => {
    const fixture = TestBed.createComponent(HeadlessHostComponent);
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('ol') as HTMLElement;
    const items = [...list.querySelectorAll('li')];

    expect(list.getAttribute('role')).toBe('list');
    expect(items.map((item) => item.getAttribute('role'))).toEqual(['listitem', 'listitem', 'listitem']);
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual(['complete', 'current', null]);
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });
});
