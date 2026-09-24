import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectAndFlush, expectFlushAndWait } from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGetQuery, createPostQuery, createQueryClient, withArgs } from '../index';

const API = createQueryClient({ name: 'testingHelpersScenario', baseUrl: 'https://api.example.com/v1' });

const getPlayers = createGetQuery(API)<{
  response: { items: string[] };
  queryParams: { search: string };
}>('/players');

const createPlayer = createPostQuery(API)<{
  response: { id: string };
  body: { name: string };
}>('/players');

@Component({ template: `<p>{{ playersQuery.response()?.items?.join(',') ?? '-' }}</p>` })
class PlayersComponent {
  readonly search = signal('m');

  readonly playersQuery = getPlayers(withArgs(() => ({ queryParams: { search: this.search() } })));
  readonly createPlayerQuery = createPlayer(withArgs(() => ({ body: { name: 'Neuer' } })));

  save() {
    this.createPlayerQuery.execute();
  }
}

describe('query/testing helpers in a TestBed spec', () => {
  let reported: unknown[];

  beforeEach(() => {
    reported = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => reported.push(error) } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('flushes each search and renders the latest response', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PlayersComponent);
    fixture.detectChanges();
    TestBed.tick();

    expectFlushAndWait(http, 'https://api.example.com/v1/players?search=m', { items: ['Müller'] });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Müller');

    for (const search of ['mu', 'mul', 'mue']) {
      fixture.componentInstance.search.set(search);
      TestBed.tick();

      expectFlushAndWait(http, `https://api.example.com/v1/players?search=${search}`, { items: [search] });
      await fixture.whenStable();

      expect(fixture.componentInstance.playersQuery.response()).toEqual({ items: [search] });
      expect(fixture.nativeElement.textContent).toContain(search);
    }

    fixture.destroy();
  });

  it('flushes a mutation with an error status', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PlayersComponent);
    fixture.detectChanges();
    TestBed.tick();
    expectAndFlush(http, 'https://api.example.com/v1/players?search=m', { items: [] });

    fixture.componentInstance.save();
    expectAndFlush(
      http,
      'https://api.example.com/v1/players',
      { message: 'taken' },
      {
        status: 409,
        statusText: 'Conflict',
      },
    );
    TestBed.tick();

    expect(fixture.componentInstance.createPlayerQuery.error()).toMatchObject({ code: 409 });
    expect(fixture.componentInstance.createPlayerQuery.response()).toBeNull();
    expect(reported).toHaveLength(1);

    fixture.componentInstance.save();
    expectFlushAndWait(http, 'https://api.example.com/v1/players', { id: 'p1' });

    expect(fixture.componentInstance.createPlayerQuery.response()).toEqual({ id: 'p1' });

    fixture.destroy();
  });
});
