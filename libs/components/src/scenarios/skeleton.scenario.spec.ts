import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideLoaderLabels,
  SKELETON_IMPORTS,
  SkeletonComponent,
  SkeletonItemComponent,
  SkeletonTextComponent,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-profile-card',
  imports: [SKELETON_IMPORTS],
  template: `
    @if (loading()) {
      <et-skeleton
        [animated]="animated()"
        [labels]="allyText() === null ? null : { loadingContent: allyText() ?? undefined }"
      >
        <et-skeleton-item class="avatar" shape="circle" />
        <et-skeleton-item class="title" />
        <et-skeleton-text [lines]="lines()" lastLineWidth="40" />
      </et-skeleton>
    } @else {
      <h2 class="name">Team A</h2>
    }
  `,
})
class ProfileCardComponent {
  loading = signal(true);
  animated = signal(true);
  allyText = signal<string | null>(null);
  lines = signal(3);
}

const widths = (host: Element) =>
  Array.from(host.querySelectorAll<HTMLElement>('.et-skeleton-text > et-skeleton-item')).map(
    (item) => item.style.inlineSize,
  );

@Component({
  selector: 'et-scenario-article-placeholder',
  imports: [SkeletonComponent, SkeletonItemComponent, SkeletonTextComponent],
  template: `
    <et-skeleton [labels]="{ loadingContent: 'Loading article' }" animated="false">
      <et-skeleton-item shape="rect" />
      <et-skeleton-text lines="2" lastLineWidth="25" />
    </et-skeleton>
  `,
})
class ArticlePlaceholderComponent {
  skeleton = viewChild.required(SkeletonComponent);
  item = viewChild.required(SkeletonItemComponent);
  text = viewChild.required(SkeletonTextComponent);
}

describe('skeleton scenarios', () => {
  const scenario = useScenario();

  it('announces one status, not marked busy, while the shapes stay hidden, then swaps in the content', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileCardComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const skeleton = host.querySelector('et-skeleton')!;

    expect(skeleton.getAttribute('role')).toBe('status');
    expect(skeleton.hasAttribute('aria-busy')).toBe(false);
    expect(skeleton.querySelector('.et-skeleton-ally-text')?.textContent).toBe('Loading…');
    expect(
      Array.from(skeleton.querySelectorAll('et-skeleton-item')).every((item) => item.getAttribute('aria-hidden')),
    ).toBe(true);
    expect(host.querySelector('.avatar')?.getAttribute('data-shape')).toBe('circle');
    expect(host.querySelector('.title')?.getAttribute('data-shape')).toBe('text');
    expect(widths(host)).toEqual(['100%', '100%', '40%']);

    page.allyText.set('Loading profile');
    page.lines.set(0);
    s.tick();

    expect(skeleton.querySelector('.et-skeleton-ally-text')?.textContent).toBe('Loading profile');
    expect(widths(host)).toEqual(['40%']);

    page.loading.set(false);
    s.tick();

    expect(host.querySelector('et-skeleton')).toBeNull();
    expect(host.querySelector('.name')?.textContent).toBe('Team A');
  });

  it('switches the shimmer off per instance', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileCardComponent);
    const skeleton = () => (fixture.nativeElement as HTMLElement).querySelector('et-skeleton')!;

    s.tick();
    expect(skeleton().classList).toContain('et-skeleton--animated');

    fixture.componentInstance.animated.set(false);
    s.tick();

    expect(skeleton().classList).not.toContain('et-skeleton--animated');
  });
});

describe('skeleton scenarios with app loader labels', () => {
  const scenario = useScenario({ providers: [provideLoaderLabels({ loadingContent: 'Lädt…' })] });

  it('announces the app-wide loading label', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileCardComponent);

    s.tick();

    expect((fixture.nativeElement as HTMLElement).querySelector('.et-skeleton-ally-text')?.textContent).toBe('Lädt…');
  });

  it('takes static attributes when the parts are imported one by one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ArticlePlaceholderComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(app.skeleton().animated()).toBe(false);
    expect(host.querySelector('et-skeleton')?.classList).not.toContain('et-skeleton--animated');
    expect(host.textContent).toContain('Loading article');
    expect(app.item().shape()).toBe('rect');
    expect(app.text().lines()).toBe(2);
    expect(widths(host)).toEqual(['100%', '25%']);
  });
});
