import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { applyCanonicalBinding } from './link-binding';
import { applyDescriptionBinding, applyOpenGraphBindings } from './meta-binding';

@Component({ template: '' })
class HostComponent {
  description = signal<string | null>('First');
  canonical = signal<string | null>('https://example.com/first');
  images = signal<string[]>(['first.png']);

  constructor() {
    applyDescriptionBinding(this.description);
    applyCanonicalBinding(this.canonical);
    applyOpenGraphBindings({ images: this.images });
  }
}

describe('head bindings', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('meta[name="description"], meta[property="og:image"], link[rel="canonical"]')
      .forEach((tag) => tag.remove());
  });

  it('updates and removes shortcut bindings reactively', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.description.set('Second');
    fixture.componentInstance.canonical.set('https://example.com/second');
    fixture.detectChanges();

    expect(document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('Second');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://example.com/second',
    );

    fixture.componentInstance.description.set(null);
    fixture.componentInstance.canonical.set(null);
    fixture.detectChanges();

    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('adds, updates, and removes array bindings reactively', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.images.set(['updated.png', 'second.png']);
    fixture.detectChanges();

    expect(
      [...document.head.querySelectorAll<HTMLMetaElement>('meta[property="og:image"]')].map((tag) => tag.content),
    ).toEqual(['updated.png', 'second.png']);

    fixture.componentInstance.images.set([]);
    fixture.detectChanges();

    expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(0);
  });
});
