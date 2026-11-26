import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MasonryItemComponent } from '../../partials/masonry-item';
import { MasonryComponent } from './masonry.component';

@Component({
  template: `
    <et-masonry columWidth="250" gap="16">
      <et-masonry-item [key]="0">Zero</et-masonry-item>
      <et-masonry-item key="b">B</et-masonry-item>
    </et-masonry>
  `,
  imports: [MasonryComponent, MasonryItemComponent],
})
class HostComponent {}

const setup = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  const masonryDebugEl = fixture.debugElement.children[0];

  if (!masonryDebugEl) throw new Error('masonry not rendered');

  return {
    masonry: masonryDebugEl.componentInstance as MasonryComponent,
    host: masonryDebugEl.nativeElement as HTMLElement,
  };
};

describe('MasonryComponent', () => {
  it('accepts 0 as an item key', () => {
    expect(() => setup()).not.toThrow();
  });

  it('lays out a single full-width column when the host is narrower than the column width', () => {
    const { masonry, host } = setup();

    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 0 } as DOMRect);

    masonry.invalidate();

    expect(host.style.getPropertyValue('--et-masonry-column-width')).toBe('100px');
  });
});
