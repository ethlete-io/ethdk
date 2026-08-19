import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { provideContentfulConfig } from '../../utils/contentful.util';
import { ContentfulLinkComponent } from './contentful-link.component';

const setup = (href: string, internalHosts: string[] = []) => {
  TestBed.configureTestingModule({
    imports: [ContentfulLinkComponent],
    providers: [provideRouter([]), provideContentfulConfig({ internalHosts })],
  });

  const fixture = TestBed.createComponent(ContentfulLinkComponent);
  fixture.componentRef.setInput('href', href);
  fixture.componentRef.setInput('text', 'Link');
  fixture.detectChanges();

  return fixture;
};

describe('ContentfulLinkComponent', () => {
  it.each(['mailto:sales@example.com', 'tel:+4912345', '#section', 'ftp://files.example.com/file'])(
    'renders %s as a native anchor',
    (href) => {
      const fixture = setup(href);
      const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

      expect(anchor.getAttribute('href')).toBe(href);
      expect(fixture.debugElement.query(By.directive(RouterLink))).toBeNull();
    },
  );

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

  it('does not treat a public-suffix sibling as internal', () => {
    const fixture = setup('https://attacker.co.uk/file', ['example.co.uk']);
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(fixture.debugElement.query(By.directive(RouterLink))).toBeNull();
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toBe('noopener noreferrer');
  });
});
