import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  queryErrorMessage,
  queryErrorMessages,
  ParseHttpErrorCodeToMessageDePipe,
  ParseHttpErrorCodeToMessageEnPipe,
  ParseHttpErrorCodeToTitleDePipe,
  ParseHttpErrorCodeToTitleEnPipe,
} from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

@Component({
  imports: [
    ParseHttpErrorCodeToTitleEnPipe,
    ParseHttpErrorCodeToMessageEnPipe,
    ParseHttpErrorCodeToTitleDePipe,
    ParseHttpErrorCodeToMessageDePipe,
  ],
  template: `
    <p data-slot="title-en">{{ status() | parseHttpErrorCodeToTitleEn }}</p>
    <p data-slot="message-en">{{ status() | parseHttpErrorCodeToMessageEn }}</p>
    <p data-slot="title-de">{{ status() | parseHttpErrorCodeToTitleDe }}</p>
    <p data-slot="message-de">{{ status() | parseHttpErrorCodeToMessageDe }}</p>
  `,
})
class ErrorTextHost {
  status = input.required<HttpStatusCode>();
}

describe('http error pipes scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const renderStatus = (status: number) => {
    const fixture = TestBed.createComponent(ErrorTextHost);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();

    const text = (slot: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(`[data-slot="${slot}"]`)?.textContent?.trim();

    return {
      titleEn: text('title-en'),
      messageEn: text('message-en'),
      titleDe: text('title-de'),
      messageDe: text('message-de'),
      destroy: () => fixture.destroy(),
    };
  };

  it("translates a failed query's status into an English and a German title and message", () => {
    const s = scenario();
    s.api.on('GET', '/missing', () => ({ status: 404, body: { message: 'nope' } }));

    const getMissing = s.get<{ response: unknown }>('/missing');

    const c = s.consumer();
    const query = c.run(() => getMissing());
    s.flush();

    const status = query.error()?.raw.status;
    expect(status).toBe(404);

    const rendered = renderStatus(status ?? 0);

    expect(rendered).toMatchObject({
      titleEn: 'Not found',
      messageEn: 'The requested resource was not found.',
      titleDe: 'Nicht gefunden',
      messageDe: 'Die angeforderte Ressource wurde nicht gefunden.',
    });

    rendered.destroy();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 404);
    c.destroy();
  });

  it('names a server error in both languages', () => {
    const s = scenario();
    s.api.on('GET', '/broken', () => ({ status: 500, body: { message: 'boom' } }));

    const getBroken = s.get<{ response: unknown }>('/broken');

    const c = s.consumer();
    const query = c.run(() => getBroken());
    s.flush();

    const rendered = renderStatus(query.error()?.raw.status ?? 0);

    expect(rendered).toMatchObject({
      titleEn: 'Internal server error',
      messageEn: 'Something went wrong on our end. Please try again later.',
      titleDe: 'Interner Serverfehler',
      messageDe: 'Etwas ist schief gelaufen. Bitte versuchen Sie es später erneut.',
    });

    rendered.destroy();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });

  it('names the 416 out-of-range page in both languages', () => {
    const s = scenario();
    s.api.on('GET', '/items', () => ({ status: 416, body: { message: 'page out of range' } }));

    const getItems = s.get<{ response: unknown }>('/items');

    const c = s.consumer();
    const query = c.run(() => getItems());
    s.flush();

    expect(query.error()?.raw.status).toBe(416);

    const rendered = renderStatus(query.error()?.raw.status ?? 0);

    expect(rendered).toMatchObject({
      titleEn: 'Page out of range',
      messageEn: 'The requested page does not exist. Go back to the first page and try again.',
      titleDe: 'Seite nicht vorhanden',
      messageDe:
        'Die angeforderte Seite existiert nicht. Gehen Sie zurück zur ersten Seite und versuchen Sie es erneut.',
    });

    rendered.destroy();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);
    c.destroy();
  });

  it('translates the request timeout, the gone resource and the early-data refusal faithfully', () => {
    scenario();

    const timeout = renderStatus(HttpStatusCode.RequestTimeout);
    expect(timeout).toMatchObject({
      messageEn: 'The server timed out waiting for the request.',
      messageDe: 'Der Server hat zu lange auf die Anforderung gewartet.',
    });
    timeout.destroy();

    const gone = renderStatus(HttpStatusCode.Gone);
    expect(gone).toMatchObject({ titleEn: 'Gone', titleDe: 'Nicht mehr verfügbar' });
    gone.destroy();

    const tooEarly = renderStatus(HttpStatusCode.TooEarly);
    expect(tooEarly).toMatchObject({
      messageEn: 'The server refuses to process a request that could be a replay. Please try again.',
      messageDe:
        'Der Server verarbeitet die Anforderung nicht, weil sie eine Wiederholung sein könnte. Bitte versuchen Sie es erneut.',
    });
    tooEarly.destroy();
  });

  it('falls back to a generic text for a status without a translation, such as a network error', () => {
    const s = scenario();
    s.api.on('GET', '/offline', () => ({ status: 0 }));

    const getOffline = s.get<{ response: unknown }>('/offline');

    const c = s.consumer();
    const query = c.run(() => getOffline());
    s.flush();

    expect(query.error()?.raw.status).toBe(0);

    const rendered = renderStatus(query.error()?.raw.status ?? -1);

    expect(rendered).toMatchObject({
      titleEn: 'Something went wrong',
      messageEn: 'Something went wrong. Check your internet connection and try again later.',
      titleDe: 'Etwas ist schief gelaufen',
      messageDe:
        'Etwas ist schief gelaufen. Überprüfen Sie Ihre Internetverbindung und versuchen Sie es später erneut.',
    });

    rendered.destroy();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 0);
    c.destroy();
  });

  it('flattens a single message and a violation list into the same string[]', () => {
    const s = scenario();
    s.api.on('GET', '/single-message', () => ({ status: 400, body: { message: 'The report is gone.' } }));
    s.api.on('GET', '/several-messages', () => ({
      status: 400,
      body: ['Email is required.', 'Name is too short.'],
    }));

    const getSingle = s.get<{ response: unknown }>('/single-message');
    const getSeveral = s.get<{ response: unknown }>('/several-messages');

    const a = s.consumer();
    const b = s.consumer();
    const singleQuery = a.run(() => getSingle());
    const severalQuery = b.run(() => getSeveral());

    s.flush();

    expect(singleQuery.error()?.isList).toBe(false);
    expect(severalQuery.error()?.isList).toBe(true);

    expect(queryErrorMessages(singleQuery.error())).toEqual(['The report is gone.']);
    expect(queryErrorMessages(severalQuery.error())).toEqual(['Email is required.', 'Name is too short.']);
    expect(queryErrorMessages(null)).toEqual([]);

    expect(queryErrorMessage(singleQuery.error())).toBe('The report is gone.');
    expect(queryErrorMessage(severalQuery.error())).toBe('Email is required.');
    expect(queryErrorMessage(null)).toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    a.destroy();
    b.destroy();
  });
});
