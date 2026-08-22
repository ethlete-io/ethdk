import { Component, signal } from '@angular/core';
import { provideLoaderLabels } from '../loader';
import '../../test-helpers';
import { SKELETON_IMPORTS } from './skeleton.imports';
import { mountSkeleton } from './testing/skeleton-driver';

@Component({
  template: `
    <et-skeleton [animated]="animated()" [loadingAllyText]="loadingAllyText()">
      <et-skeleton-item [shape]="itemShape()" />
      <et-skeleton-text [lines]="lines()" [lastLineWidth]="lastLineWidth()" />
    </et-skeleton>
  `,
  imports: [SKELETON_IMPORTS],
})
class SkeletonTestHost {
  animated = signal(true);
  loadingAllyText = signal<string | null>(null);
  itemShape = signal<'text' | 'rect' | 'circle'>('text');
  lines = signal(3);
  lastLineWidth = signal(60);
}

describe('SkeletonComponent', () => {
  it('marks itself busy for assistive tech', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    expect(driver.query('et-skeleton')?.getAttribute('role')).toBe('status');
    expect(driver.query('et-skeleton')?.getAttribute('aria-busy')).toBe('true');
  });

  it('announces the default loader label when none is given', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    expect(driver.allyText()).toBe('Loading…');
  });

  it('announces its own loadingAllyText over the default label', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    driver.host.loadingAllyText.set('Loading results');
    driver.detectChanges();

    expect(driver.allyText()).toBe('Loading results');
  });

  it('falls back to the injected loader labels when neither is given', () => {
    const driver = mountSkeleton(SkeletonTestHost, {}, [provideLoaderLabels({ loadingContent: 'Bitte warten…' })]);

    expect(driver.allyText()).toBe('Bitte warten…');
  });

  it('toggles the animated class from its input', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    expect(driver.query('et-skeleton')?.classList.contains('et-skeleton--animated')).toBe(true);

    driver.host.animated.set(false);
    driver.detectChanges();

    expect(driver.query('et-skeleton')?.classList.contains('et-skeleton--animated')).toBe(false);
  });

  it('hides its shapes from assistive tech and reflects the requested shape', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    const item = driver.itemEls()[0]!;

    expect(item.getAttribute('aria-hidden')).toBe('true');
    expect(item.getAttribute('data-shape')).toBe('text');

    driver.host.itemShape.set('rect');
    driver.detectChanges();

    expect(driver.itemEls()[0]!.getAttribute('data-shape')).toBe('rect');
  });
});

describe('SkeletonTextComponent', () => {
  it('draws the default three lines with a shorter last one', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    expect(driver.textLineWidths()).toEqual(['100%', '100%', '60%']);
  });

  it('sizes the last line from lastLineWidth', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    driver.host.lastLineWidth.set(40);
    driver.detectChanges();

    expect(driver.textLineWidths()).toEqual(['100%', '100%', '40%']);
  });

  it('clamps lines below one to a single line', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    driver.host.lines.set(0);
    driver.detectChanges();

    expect(driver.textLineWidths()).toEqual(['60%']);
  });

  it('changes the line count reactively', () => {
    const driver = mountSkeleton(SkeletonTestHost);

    driver.host.lines.set(1);
    driver.detectChanges();

    expect(driver.textLineWidths()).toEqual(['60%']);
  });
});
