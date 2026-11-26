import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideStreamLabels } from '../stream-labels';
import { STREAM_PLAYER_ERROR_CONTEXT_TOKEN } from './headless/stream-player-error.directive';
import { StreamPlayerErrorComponent } from './stream-player-error.component';

describe('StreamPlayerErrorComponent', () => {
  it('renders its heading as a paragraph, not a heading that would break the page outline', () => {
    TestBed.configureTestingModule({
      imports: [StreamPlayerErrorComponent],
      providers: [
        provideStreamLabels({ errorHeading: 'Playback failed' }),
        { provide: STREAM_PLAYER_ERROR_CONTEXT_TOKEN, useValue: { error: signal(null), retry: () => undefined } },
      ],
    });

    const fixture = TestBed.createComponent(StreamPlayerErrorComponent);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const heading = host.querySelector('.et-stream-player-error-heading')!;

    expect(heading.tagName).toBe('P');
    expect(heading.textContent).toContain('Playback failed');
    expect(host.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
  });
});
