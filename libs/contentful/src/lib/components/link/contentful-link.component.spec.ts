import { APP_BASE_HREF } from '@angular/common';
import { Component, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterLink } from '@angular/router';
import { provideContentfulConfig } from '../../utils/contentful.util';
import { ContentfulLinkComponent } from './contentful-link.component';

@Component({ template: '' })
class EmptyRouteComponent {}

const setup = (
  href: string,
  internalHosts: string[] = [],
  inputs: Record<string, string> = {},
  providers: Provider[] = [],
) => {
  TestBed.configureTestingModule({
    imports: [ContentfulLinkComponent],
    providers: [
      provideRouter([{ path: '**', component: EmptyRouteComponent }]),
      provideContentfulConfig({ internalHosts }),
      ...providers,
    ],
  });

  const fixture = TestBed.createComponent(ContentfulLinkComponent);
  fixture.componentRef.setInput('href', href);
  fixture.componentRef.setInput('text', 'Link');

  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }

  fixture.detectChanges();

  return fixture;
};

describe('ContentfulLinkComponent', () => {
  it.each(['mailto:sales@example.com', 'tel:+4912345', 'ftp://files.example.com/file'])(
    'renders %s as a native anchor',
    (href) => {
      const fixture = setup(href);
      const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

      expect(anchor.getAttribute('href')).toBe(href);
      expect(anchor.getAttribute('target')).toBeNull();
      expect(fixture.debugElement.query(By.directive(RouterLink))).toBeNull();
    },
  );

  it.each([
    ['without a base href', [], '/news/article-1?page=1#comments'],
    ['under a base href', [{ provide: APP_BASE_HREF, useValue: '/app/' }], '/app/news/article-1?page=1#comments'],
  ])('points a fragment-only href at the current page %s', async (_, providers, expected) => {
    const fixture = setup('#comments', [], {}, providers);

    await TestBed.inject(Router).navigateByUrl('/news/article-1?page=1');
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(anchor.getAttribute('href')).toBe(expected);
    expect(anchor.getAttribute('target')).toBeNull();
    expect(fixture.debugElement.query(By.directive(RouterLink))).toBeNull();
  });

  it('uses router navigation for relative paths', () => {
    const fixture = setup('/news/article');

    expect(fixture.debugElement.query(By.directive(RouterLink))).not.toBeNull();
  });

  it('uses router navigation for configured hosts and their subdomains', () => {
    const fixture = setup('https://media.example.co.uk/news?id=1#intro', ['example.co.uk']);
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(fixture.debugElement.query(By.directive(RouterLink))).not.toBeNull();
    expect(anchor.getAttribute('href')).toContain('/news?id=1#intro');
  });

  it('uses router navigation for the current host', () => {
    const fixture = setup(`${document.location.origin}/news`);

    expect(fixture.debugElement.query(By.directive(RouterLink))).not.toBeNull();
  });

  it.each([
    ['a subdomain of the current host', `${document.location.protocol}//shop.${document.location.host}/cart`],
    ['another port on the current host', `${document.location.protocol}//${document.location.hostname}:1/cart`],
  ])('does not treat %s as internal', (_, href) => {
    const fixture = setup(href);

    expect(fixture.debugElement.query(By.directive(RouterLink))).toBeNull();
  });

  it('does not treat a public-suffix sibling as internal', () => {
    const fixture = setup('https://attacker.co.uk/file', ['example.co.uk']);
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(fixture.debugElement.query(By.directive(RouterLink))).toBeNull();
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toBe('noopener noreferrer');
  });

  it('renders a standalone anchor without the rich-text classes', () => {
    const anchor = setup('https://example.com').nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(anchor.getAttribute('class')).toBeNull();
  });

  it('puts anchorClass and textClass on the anchor', () => {
    const fixture = setup('https://example.com', [], { anchorClass: 'rich', textClass: 'mark' });
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect([...anchor.classList].sort()).toEqual(['mark', 'rich']);
  });

  it.each([
    ['a query-only href', '?page=2', '/articles/first?page=2'],
    ['a dot-relative href', './second', '/articles/second'],
    ['a parent-relative href', '../teams', '/teams'],
  ])('resolves %s against the current route', async (_, href, expected) => {
    const fixture = setup(href);

    await TestBed.inject(Router).navigateByUrl('/articles/first?page=1');
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(fixture.debugElement.query(By.directive(RouterLink))).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe(expected);
  });

  it('re-resolves a relative href after a navigation', async () => {
    const fixture = setup('./second');
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/articles/first');
    fixture.detectChanges();
    await router.navigateByUrl('/teams/first');
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe('/teams/second');
  });
});
