import { Component, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TIMELINE_IMPORTS, TimelineComponent, TimelineItemComponent } from '../index';
import { TEST_COLOR_THEMES, TEST_SEMANTIC_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

type MatchEvent = { id: number; minute: string; text: string; color?: string; marker?: string };

@Component({
  selector: 'et-scenario-match-report',
  imports: [TIMELINE_IMPORTS],
  template: `
    <et-timeline aria-label="Match report">
      @for (event of events(); track event.id) {
        <et-timeline-item [color]="event.color">
          <span class="minute" etTimelineTime>{{ event.minute }}</span>
          @if (event.marker) {
            <span class="marker" etTimelineMarker>{{ event.marker }}</span>
          }
          <p class="text">{{ event.text }}</p>
        </et-timeline-item>
      }
    </et-timeline>
  `,
})
class MatchReportComponent {
  events = signal<MatchEvent[]>([
    { id: 1, minute: "0'", text: 'Kick-off' },
    { id: 2, minute: "23'", text: 'Goal for team-a', color: 'grass', marker: 'G' },
  ]);
}

const texts = (host: Element, selector: string) =>
  Array.from(host.querySelectorAll(selector)).map((element) => element.textContent?.trim());

@Component({
  selector: 'et-scenario-changelog',
  imports: [TimelineComponent, TimelineItemComponent],
  template: `
    <et-timeline aria-label="Changelog">
      @for (entry of entries(); track entry) {
        <et-timeline-item>{{ entry }}</et-timeline-item>
      }
    </et-timeline>
  `,
})
class ChangelogComponent {
  entries = signal(['v1', 'v2']);
  items = viewChildren(TimelineItemComponent);
  timeline = viewChild.required(TimelineComponent);
}

describe('timeline scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemes([...TEST_COLOR_THEMES, ...TEST_SEMANTIC_COLOR_THEMES])],
  });

  it('reads as a list of events in the order the app projects them', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchReportComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const timeline = host.querySelector('et-timeline')!;
    const items = Array.from(host.querySelectorAll('et-timeline-item'));

    expect(timeline.getAttribute('role')).toBe('list');
    expect(timeline.getAttribute('aria-label')).toBe('Match report');
    expect(items.map((item) => item.getAttribute('role'))).toEqual(['listitem', 'listitem']);
    expect(texts(host, '.text')).toEqual(['Kick-off', 'Goal for team-a']);

    fixture.componentInstance.events.update((events) => [
      ...events,
      { id: 3, minute: "90'", text: 'Full time', color: 'danger' },
    ]);
    s.tick();

    expect(texts(host, '.text')).toEqual(['Kick-off', 'Goal for team-a', 'Full time']);
  });

  it('puts the time above the content and a custom marker on the rail', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchReportComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const [kickOff, goal] = Array.from(host.querySelectorAll('et-timeline-item'));
    const goalContent = goal!.querySelector('.et-timeline-item-content')!;

    expect(goalContent.firstElementChild?.classList).toContain('minute');
    expect(goalContent.querySelector('.text')).not.toBeNull();
    expect(goal!.querySelector('.et-timeline-item-rail .et-timeline-item-marker .marker')?.textContent).toBe('G');
    expect(kickOff!.querySelector('.et-timeline-item-marker')?.children.length).toBe(0);
    expect(kickOff!.querySelector('.et-timeline-item-rail .minute')).toBeNull();
  });

  it('tints only the item that sets a colour', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchReportComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const [kickOff, goal] = Array.from(host.querySelectorAll('et-timeline-item'));

    expect(goal!.classList).toContain('et-color--grass');
    expect(kickOff!.className).not.toContain('et-color--grass');
  });

  it('adds and removes items the app renders into a standalone timeline', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ChangelogComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(app.timeline()).toBeInstanceOf(TimelineComponent);
    expect(app.items().length).toBe(2);
    expect(host.querySelector('et-timeline')?.getAttribute('role')).toBe('list');

    app.entries.set(['v1', 'v2', 'v3']);
    s.tick();

    expect(app.items().length).toBe(3);
    expect(texts(host, 'et-timeline-item[role="listitem"]')).toEqual(['v1', 'v2', 'v3']);
  });
});
