import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProvideColorDirective } from '@ethlete/core';
import '../../test-helpers';
import { TIMELINE_IMPORTS } from './timeline.imports';

@Component({
  selector: 'et-test-timeline-edge-host',
  template: `
    <et-timeline>
      @for (event of events(); track event) {
        <et-timeline-item [color]="color()">{{ event }}</et-timeline-item>
      }
    </et-timeline>
  `,
  imports: [TIMELINE_IMPORTS],
})
class TimelineEdgeHostComponent {
  public events = signal<string[]>([]);
  public color = signal<string | null>(null);
}

const createHost = (events: string[] = []) => {
  const fixture = TestBed.createComponent(TimelineEdgeHostComponent);

  fixture.componentInstance.events.set(events);
  fixture.detectChanges();

  return fixture;
};

const itemTexts = (fixture: ReturnType<typeof createHost>) =>
  [...(fixture.nativeElement as HTMLElement).querySelectorAll('et-timeline-item')].map((el) =>
    el.querySelector('.et-timeline-item-content')?.textContent?.trim(),
  );

describe('TimelineComponent edge cases', () => {
  it('renders an empty list without items', () => {
    const fixture = createHost();
    const timeline = fixture.nativeElement.querySelector('et-timeline') as HTMLElement;

    expect(timeline.getAttribute('role')).toBe('list');
    expect(timeline.querySelectorAll('et-timeline-item')).toHaveLength(0);
  });

  it('renders a single item with its rail and marker', () => {
    const fixture = createHost(['Kickoff']);
    const item = fixture.nativeElement.querySelector('et-timeline-item') as HTMLElement;

    expect(item.querySelector('.et-timeline-item-rail .et-timeline-item-marker')).not.toBeNull();
    expect(itemTexts(fixture)).toEqual(['Kickoff']);
  });

  it('keeps the reading order as events are added, inserted and removed', () => {
    const fixture = createHost(['Kickoff', 'Fulltime']);

    fixture.componentInstance.events.set(['Kickoff', 'Halftime', 'Fulltime']);
    fixture.detectChanges();
    expect(itemTexts(fixture)).toEqual(['Kickoff', 'Halftime', 'Fulltime']);

    fixture.componentInstance.events.set(['Halftime']);
    fixture.detectChanges();
    expect(itemTexts(fixture)).toEqual(['Halftime']);

    fixture.componentInstance.events.set([]);
    fixture.detectChanges();
    expect(itemTexts(fixture)).toEqual([]);
  });

  it('drops a color back to none', () => {
    const fixture = createHost(['Goal']);

    fixture.componentInstance.color.set('brand');
    fixture.detectChanges();
    fixture.componentInstance.color.set(null);
    fixture.detectChanges();

    const provider = fixture.debugElement.query(By.css('et-timeline-item')).injector.get(ProvideColorDirective);

    expect(provider.color()).toBeNull();
  });
});
