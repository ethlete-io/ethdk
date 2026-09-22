import { provideLocationMocks } from '@angular/common/testing';
import { inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  applyAlternateLanguagesBindings,
  applyCanonicalBinding,
  applyDescriptionBinding,
  applyHeadTitleBinding,
  applyKeywordsBinding,
  applyLinkBinding,
  applyMetaBinding,
  applyOpenGraphBindings,
  applyResourceHintsBindings,
  applyRobotsBinding,
  applyStructuredDataBinding,
  JsonLD,
  LinkConfig,
  MetaTagConfig,
  RobotsConfig,
  StructuredDataComponent,
} from '../index';
import { Scenario, useScenario } from './harness';

const PAYLOAD = 'safe</SCRIPT ><img src=x onerror=alert(1)>';

const metaContent = (selector: string) =>
  Array.from(document.head.querySelectorAll<HTMLMetaElement>(`meta[${selector}]`)).map((meta) => meta.content);

const linkHrefs = (rel: string) =>
  Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)).map((link) =>
    link.getAttribute('href'),
  );

const organization = (name: string): JsonLD.WithContext<JsonLD.Thing> =>
  ({ '@context': 'https://schema.org', '@type': 'Organization', name }) as JsonLD.WithContext<JsonLD.Thing>;

const settle = async (s: Scenario) => {
  await s.settle();
  s.tick();
};

describe('seo scenarios', () => {
  const scenario = useScenario({
    providers: [provideRouter([{ path: '', children: [] }]), provideLocationMocks()],
  });

  it('updates and removes signal-driven meta and link tags', async () => {
    const s = scenario();
    const c = s.consumer();
    const description = signal<string | null>('first');
    const canonical = signal<string | null>('https://a.example/');
    const keywords = signal<string[] | null>(['one', 'two']);
    const robots = signal<RobotsConfig | null>({ index: false });
    const german = signal<string | null>('https://a.example/de');

    c.run(() => {
      applyDescriptionBinding(description);
      applyCanonicalBinding(canonical);
      applyKeywordsBinding(keywords);
      applyRobotsBinding(robots);
      applyAlternateLanguagesBindings({ de: german });
    });
    await settle(s);

    expect(metaContent('name="description"')).toEqual(['first']);
    expect(linkHrefs('canonical')).toEqual(['https://a.example/']);
    expect(metaContent('name="keywords"')).toEqual(['one, two']);
    expect(metaContent('name="robots"')).toEqual(['noindex']);
    expect(linkHrefs('alternate')).toEqual(['https://a.example/de']);

    description.set('second');
    canonical.set('https://b.example/');
    keywords.set(['three']);
    robots.set({ follow: false });
    german.set('https://b.example/de');
    await settle(s);

    expect(metaContent('name="description"')).toEqual(['second']);
    expect(linkHrefs('canonical')).toEqual(['https://b.example/']);
    expect(metaContent('name="keywords"')).toEqual(['three']);
    expect(metaContent('name="robots"')).toEqual(['nofollow']);
    expect(linkHrefs('alternate')).toEqual(['https://b.example/de']);

    description.set(null);
    canonical.set(null);
    keywords.set([]);
    robots.set(null);
    german.set(null);
    await settle(s);

    expect(metaContent('name="description"')).toEqual([]);
    expect(linkHrefs('canonical')).toEqual([]);
    expect(metaContent('name="keywords"')).toEqual([]);
    expect(metaContent('name="robots"')).toEqual([]);
    expect(linkHrefs('alternate')).toEqual([]);

    c.destroy();
  });

  it('moves a tag when its binding switches to another selector', async () => {
    const s = scenario();
    const c = s.consumer();
    const meta = signal<MetaTagConfig>({ name: 'description', content: 'text' });
    const link = signal<LinkConfig>({ rel: 'alternate', hreflang: 'de', href: 'https://a.example/de' });

    c.run(() => {
      applyMetaBinding(meta);
      applyLinkBinding(link);
    });
    await settle(s);

    meta.set({ property: 'og:description', content: 'text' });
    link.set({ rel: 'alternate', hreflang: 'fr', href: 'https://a.example/fr' });
    await settle(s);

    expect(metaContent('name="description"')).toEqual([]);
    expect(metaContent('property="og:description"')).toEqual(['text']);
    expect(linkHrefs('alternate')).toEqual(['https://a.example/fr']);

    c.destroy();
  });

  it('removes every tag a binding owns when its owner is destroyed', async () => {
    const s = scenario();
    const c = s.consumer();

    c.run(() => {
      applyDescriptionBinding(signal('kept until destroy'));
      applyCanonicalBinding('https://a.example/');
      applyOpenGraphBindings({ title: 'Title', images: ['/a.png', '/b.png'] });
      applyStructuredDataBinding(organization('Ethlete'));
    });
    await settle(s);

    expect(document.head.querySelectorAll('meta').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);

    c.destroy();
    await settle(s);

    expect(metaContent('name="description"')).toEqual([]);
    expect(metaContent('property^="og:"')).toEqual([]);
    expect(linkHrefs('canonical')).toEqual([]);
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });

  it('grows and shrinks array bindings in order', async () => {
    const s = scenario();
    const c = s.consumer();
    const images = signal<string[] | null>(['/a.png', '/b.png']);
    const preconnect = signal<string[] | null>(['https://cdn.a.example']);

    c.run(() => {
      applyOpenGraphBindings({ images });
      applyResourceHintsBindings({ preconnect });
    });
    await settle(s);

    expect(metaContent('property="og:image"')).toEqual(['/a.png', '/b.png']);
    expect(linkHrefs('preconnect')).toEqual(['https://cdn.a.example']);

    images.set(['/a.png', '/b.png', '/c.png']);
    preconnect.set(['https://cdn.a.example', 'https://cdn.b.example']);
    await settle(s);

    expect(metaContent('property="og:image"')).toEqual(['/a.png', '/b.png', '/c.png']);
    expect(linkHrefs('preconnect')).toEqual(['https://cdn.a.example', 'https://cdn.b.example']);

    images.set(['/c.png']);
    preconnect.set(['https://cdn.b.example']);
    await settle(s);

    expect(metaContent('property="og:image"')).toEqual(['/c.png']);
    expect(linkHrefs('preconnect')).toEqual(['https://cdn.b.example']);

    images.set(null);
    preconnect.set(null);
    await settle(s);

    expect(metaContent('property="og:image"')).toEqual([]);
    expect(linkHrefs('preconnect')).toEqual([]);

    images.set(['/d.png']);
    await settle(s);

    expect(metaContent('property="og:image"')).toEqual(['/d.png']);

    c.destroy();
  });

  it('follows a signal-driven title and falls back to the default when it empties', async () => {
    const s = scenario();
    const c = s.consumer();
    const page = signal<string | null>('Teams');

    const hadTitleElement = !!document.head.querySelector('title');

    document.title = 'App';

    await s.run(() => inject(Router)).navigateByUrl('/');
    c.run(() => applyHeadTitleBinding(page));
    await settle(s);

    expect(document.title).toBe('Teams');

    page.set('Players');
    await settle(s);

    expect(document.title).toBe('Players');

    page.set(null);
    await settle(s);

    expect(document.title).toBe('App');

    c.destroy();
    document.title = '';
    if (!hadTitleElement) document.head.querySelector('title')?.remove();
  });

  it('keeps a closing script tag in structured data inside the JSON', async () => {
    const s = scenario();
    const c = s.consumer();
    const data = signal<JsonLD.WithContext<JsonLD.Thing> | null>(organization(PAYLOAD));

    c.run(() => applyStructuredDataBinding(data));
    await settle(s);

    const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0]?.textContent ?? '')).toEqual(organization(PAYLOAD));
    expect(document.querySelectorAll('img')).toHaveLength(0);

    data.set(null);
    await settle(s);

    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);

    c.destroy();
  });

  it('keeps a closing script tag inside the JSON of <et-structured-data>', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StructuredDataComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentRef.setInput('data', organization(PAYLOAD));
    await settle(s);

    expect(Array.from(host.children).map((child) => child.tagName)).toEqual(['SCRIPT']);
    expect(JSON.parse(host.querySelector('script')?.textContent ?? '')).toEqual(organization(PAYLOAD));

    fixture.componentRef.setInput('data', organization('Ethlete'));
    await settle(s);

    expect(JSON.parse(host.querySelector('script')?.textContent ?? '')).toEqual(organization('Ethlete'));

    fixture.componentRef.setInput('data', null);
    await settle(s);

    expect(host.children).toHaveLength(0);

    fixture.destroy();
  });
});
