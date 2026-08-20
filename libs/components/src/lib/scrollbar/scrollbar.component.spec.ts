import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { SCROLLBAR_IMPORTS } from './scrollbar.imports';

@Component({
  selector: 'et-test-scrollbar-host',
  template: `
    <div #list class="list"></div>

    <et-scrollbar [for]="list" [disabled]="disabled()" />

    @if (renderSecond()) {
      <et-scrollbar [for]="list" orientation="horizontal" />
    }
  `,
  imports: [SCROLLBAR_IMPORTS],
})
class ScrollbarHostComponent {
  public disabled = signal(false);
  public renderSecond = signal(false);
}

describe('ScrollbarComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(ScrollbarHostComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      host: fixture.componentInstance,
      list: element.querySelector('.list') as HTMLElement,
      scrollbars: () => Array.from(element.querySelectorAll('et-scrollbar')),
    };
  };

  it('renders a thumb and describes its axis', () => {
    const { scrollbars } = setup();
    const scrollbar = scrollbars()[0] as HTMLElement;

    expect(scrollbar.classList.contains('et-scrollbar')).toBe(true);
    expect(scrollbar.getAttribute('data-orientation')).toBe('vertical');
    expect(scrollbar.querySelector('.et-scrollbar-thumb')).not.toBeNull();
  });

  it('hides the native scrollbar of the container it mirrors', () => {
    const { list } = setup();

    expect(list.classList.contains('et-scrollbar-host')).toBe(true);
  });

  it('stops hiding it once the last scrollbar is gone', () => {
    const { fixture, list } = setup();

    fixture.destroy();

    expect(list.classList.contains('et-scrollbar-host')).toBe(false);
  });

  it('keeps hiding it while a scrollbar on the other axis is left', () => {
    const { fixture, host, list } = setup();

    host.renderSecond.set(true);
    fixture.detectChanges();

    host.renderSecond.set(false);
    fixture.detectChanges();

    expect(list.classList.contains('et-scrollbar-host')).toBe(true);
  });

  it('is never visible while disabled', () => {
    const { fixture, host, scrollbars } = setup();

    host.disabled.set(true);
    fixture.detectChanges();

    expect((scrollbars()[0] as HTMLElement).classList.contains('et-scrollbar--visible')).toBe(false);
  });
});
