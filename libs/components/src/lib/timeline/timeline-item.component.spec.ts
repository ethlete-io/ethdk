import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProvideColorDirective } from '@ethlete/core';
import '../../test-helpers';
import { TIMELINE_IMPORTS } from './timeline.imports';

@Component({
  selector: 'et-test-timeline-item-host',
  template: `<et-timeline-item [color]="color()"><p>Match kicked off</p></et-timeline-item>`,
  imports: [TIMELINE_IMPORTS],
})
class TimelineItemHostComponent {
  public color = signal<string | null>(null);
}

@Component({
  selector: 'et-test-timeline-item-slots-host',
  template: `
    <et-timeline-item>
      <span etTimelineTime>23'</span>
      <i class="et-icon" etTimelineMarker></i>
      <p>Goal by A. Rossi</p>
    </et-timeline-item>
  `,
  imports: [TIMELINE_IMPORTS],
})
class TimelineItemSlotsHostComponent {}

describe('TimelineItemComponent', () => {
  it('renders an empty marker so the CSS default dot applies', () => {
    const fixture = TestBed.createComponent(TimelineItemHostComponent);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector('.et-timeline-item-marker') as HTMLElement;

    expect(marker).not.toBeNull();
    expect(marker.childNodes.length).toBe(0);
  });

  it('projects the content next to the rail', () => {
    const fixture = TestBed.createComponent(TimelineItemHostComponent);
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('.et-timeline-item-content') as HTMLElement;

    expect(content.textContent?.trim()).toBe('Match kicked off');
  });

  it('forwards color to the color provider', () => {
    const fixture = TestBed.createComponent(TimelineItemHostComponent);
    fixture.componentInstance.color.set('brand');
    fixture.detectChanges();

    const itemDe = fixture.debugElement.query(By.css('et-timeline-item'));
    const provider = itemDe.injector.get(ProvideColorDirective);

    expect(provider.color()).toBe('brand');
  });

  it('projects a custom marker into the rail', () => {
    const fixture = TestBed.createComponent(TimelineItemSlotsHostComponent);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector('.et-timeline-item-marker') as HTMLElement;

    expect(marker.querySelector('[etTimelineMarker]')).not.toBeNull();
  });

  it('projects the time above the content', () => {
    const fixture = TestBed.createComponent(TimelineItemSlotsHostComponent);
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('.et-timeline-item-content') as HTMLElement;

    expect(content.firstElementChild?.getAttribute('etTimelineTime')).toBe('');
    expect(content.firstElementChild?.textContent).toBe("23'");
  });
});
