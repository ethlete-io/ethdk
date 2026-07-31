import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import * as JsonLD from './json-ld';
import { applyStructuredDataBinding } from './structured-data-binding';

const graph = (name: string): JsonLD.WithContext<JsonLD.BreadcrumbList> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ '@type': 'ListItem', position: 1, name }],
});

@Component({ template: '' })
class HostComponent {
  public data = signal<JsonLD.WithContext<JsonLD.BreadcrumbList> | null>(graph('Home'));

  constructor() {
    applyStructuredDataBinding(this.data);
  }
}

const scripts = () => [...document.querySelectorAll('script[type="application/ld+json"]')];

afterEach(() => {
  for (const script of scripts()) script.remove();
});

describe('applyStructuredDataBinding', () => {
  it('writes the JSON as the script’s content, which is the only place a crawler reads it', () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();

    expect(scripts()).toHaveLength(1);
    expect(JSON.parse(scripts()[0]?.textContent ?? 'null')).toEqual(graph('Home'));
    // Not an attribute — a `<script text="…">` is an empty script with a stray attribute on it.
    expect(scripts()[0]?.hasAttribute('text')).toBe(false);
  });

  it('replaces the script rather than adding a second one when the data changes', () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();
    fixture.componentInstance.data.set(graph('Teams'));
    fixture.detectChanges();

    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]?.textContent).toContain('Teams');
  });

  it('removes the script when the data goes away', () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();
    fixture.componentInstance.data.set(null);
    fixture.detectChanges();

    expect(scripts()).toHaveLength(0);
  });

  it('removes the script when the host is destroyed', () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();
    fixture.destroy();

    expect(scripts()).toHaveLength(0);
  });
});
