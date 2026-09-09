import { CollectedEvent } from '../model/event';
import { redactEventTitles, redactTitleUrls } from './title';

describe('redactTitleUrls', () => {
  it('drops the query string of a URL a browser put in the title', () => {
    expect(
      redactTitleUrls(
        'accounts.google.com/signin/oauth/v3/consent?as=S-871351748&client_id=1062961139910&rapt=AEjHL4Na - Google Chrome',
      ),
    ).toBe('accounts.google.com/signin/oauth/v3/consent - Google Chrome');
  });

  it('drops the query string of a URL that names its scheme', () => {
    expect(redactTitleUrls('https://gitlab.com/search?q=secret')).toBe('https://gitlab.com/search');
  });

  it('drops a fragment', () => {
    expect(redactTitleUrls('https://example.com/doc#section-4')).toBe('https://example.com/doc');
  });

  it('drops the query string of a URL wrapped in brackets', () => {
    expect(redactTitleUrls('Ticket (jira.example.com/browse/FIP-1?focus=comment)')).toBe(
      'Ticket (jira.example.com/browse/FIP-1',
    );
  });

  it('keeps a URL that carries neither', () => {
    expect(redactTitleUrls('https://example.com/doc - Google Chrome')).toBe('https://example.com/doc - Google Chrome');
  });

  it('keeps an ordinary title', () => {
    expect(redactTitleUrls('timer.rs - ethlete-sdk - Visual Studio Code')).toBe(
      'timer.rs - ethlete-sdk - Visual Studio Code',
    );
  });

  it('keeps a question mark that ends a sentence', () => {
    expect(redactTitleUrls('Is 3.14 enough? - Notes')).toBe('Is 3.14 enough? - Notes');
  });
});

describe('redactEventTitles', () => {
  const focus = (title: string): CollectedEvent => ({
    source: 'window',
    kind: 'window-focus',
    at: new Date('2026-09-09T09:23:00Z'),
    appId: 'google-chrome',
    title,
  });

  it('redacts the title of an event that has one', () => {
    const [event] = redactEventTitles([focus('example.com/a?token=1')]);

    expect(event && 'title' in event ? event.title : null).toBe('example.com/a');
  });

  it('returns the same object when there is nothing to redact', () => {
    const event = focus('timer.rs - Visual Studio Code');

    expect(redactEventTitles([event])[0]).toBe(event);
  });

  it('passes through an event that carries no title', () => {
    const event: CollectedEvent = {
      source: 'idle',
      kind: 'idle-start',
      at: new Date('2026-09-09T09:23:00Z'),
    };

    expect(redactEventTitles([event])[0]).toBe(event);
  });
});
