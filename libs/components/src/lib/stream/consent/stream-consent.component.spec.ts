import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideStreamLabels } from '../stream-labels';
import { StreamConsentComponent } from './stream-consent.component';

describe('StreamConsentComponent', () => {
  let fixture: ComponentFixture<StreamConsentComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StreamConsentComponent],
      providers: [
        provideStreamLabels({
          consentHeading: 'Consent required',
          consentDescription: 'Please grant consent',
          consentAccept: 'Accept',
        }),
      ],
    });
    fixture = TestBed.createComponent(StreamConsentComponent);
    host = fixture.nativeElement;
  });

  it('displays lock icon', () => {
    fixture.detectChanges();
    const icon = host.querySelector('.et-stream-consent-icon');
    expect(icon).not.toBeNull();
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
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Accept');
  });
});
