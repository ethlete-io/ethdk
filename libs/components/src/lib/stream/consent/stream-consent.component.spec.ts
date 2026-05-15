import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideStreamConsentConfig } from './stream-consent-config';
import { StreamConsentComponent } from './stream-consent.component';

describe('StreamConsentComponent', () => {
  let fixture: ComponentFixture<StreamConsentComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StreamConsentComponent],
      providers: [
        provideStreamConsentConfig({
          heading: 'Consent required',
          description: 'Please grant consent',
          acceptLabel: 'Accept',
          acceptButtonColor: null,
          transformer: (text: string) => text,
        }),
      ],
    });
    fixture = TestBed.createComponent(StreamConsentComponent);
    host = fixture.nativeElement;
  });

  it('renders component', () => {
    fixture.detectChanges();
    expect(host).toBeDefined();
  });

  it('has et-stream-consent-card class', () => {
    fixture.detectChanges();
    expect(host.querySelector('.et-stream-consent-card')).toBeDefined();
  });

  it('displays lock icon', () => {
    fixture.detectChanges();
    const icon = host.querySelector('.et-stream-consent-icon');
    expect(icon).toBeDefined();
  });

  it('displays consent heading', () => {
    fixture.detectChanges();
    const heading = host.querySelector('.et-stream-consent-heading');
    expect(heading?.textContent).toContain('Consent required');
  });

  it('displays consent description', () => {
    fixture.detectChanges();
    const description = host.querySelector('.et-stream-consent-description');
    expect(description?.textContent).toContain('Please grant consent');
  });

  it('renders accept button', () => {
    fixture.detectChanges();
    const button = host.querySelector('button');
    expect(button).toBeDefined();
    expect(button?.textContent).toContain('Accept');
  });
});
