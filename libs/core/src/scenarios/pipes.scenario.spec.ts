import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatchListView } from '@ethlete/types';
import {
  HtmlToMarkdownPipe,
  MarkdownToHtmlPipe,
  normalizeMatchParticipant,
  NormalizeGameResultTypePipe,
  NormalizeMatchParticipantsPipe,
  ToArrayPipe,
} from '../index';
import { useScenario } from './harness';

const match = (overrides: Partial<Record<'status' | 'home' | 'away', unknown>>) =>
  ({
    status: 'started',
    isCompletedByReferee: false,
    round: { state: 'started' },
    home: { type: 'team', name: 'Home FC' },
    away: { type: 'team', name: 'Away FC' },
    ...overrides,
  }) as unknown as MatchListView;

@Component({
  selector: 'et-scenario-text-widget',
  imports: [MarkdownToHtmlPipe],
  template: '<div class="text" [innerHTML]="markdown() | markdownToHtml"></div>',
})
class TextWidgetComponent {
  markdown = signal('**Hello** partner');
}

@Component({
  selector: 'et-scenario-aligned-source',
  imports: [HtmlToMarkdownPipe],
  template: '<div class="source" [innerHTML]="html() | htmlToMarkdown"></div>',
})
class AlignedSourceComponent {
  html = signal('<p style="text-align: center">Centered</p><p>body</p>');
}

@Component({
  selector: 'et-scenario-pagination',
  imports: [ToArrayPipe],
  template: `
    @for (page of maxPage() | toArray; track page) {
      <button>{{ page + 1 }}</button>
    }
  `,
})
class PaginationComponent {
  maxPage = signal(3);
}

@Component({
  selector: 'et-scenario-match-card',
  imports: [NormalizeMatchParticipantsPipe, NormalizeGameResultTypePipe],
  template: `
    @if (match() | etNormalizeMatchParticipants; as participants) {
      <span class="home">{{
        participants.home?.type === 'participant' ? participants.home?.data?.name : participants.home?.text
      }}</span>
      <span class="away">{{
        participants.away?.type === 'participant' ? participants.away?.data?.name : participants.away?.text
      }}</span>
    }
    <span class="result">{{ (resultType() | etNormalizeGameResultType)?.shortCode }}</span>
  `,
})
class MatchCardComponent {
  match = signal<MatchListView | null>(match({}));
  resultType = signal<string | null>('penalty');
}

describe('pipe scenarios', () => {
  const scenario = useScenario();

  it('renders markdown as html and follows the source', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TextWidgetComponent);
    const text = () => (fixture.nativeElement as HTMLElement).querySelector('.text') as HTMLElement;

    s.tick();

    expect(text().querySelector('strong')?.textContent).toBe('Hello');

    fixture.componentInstance.markdown.set('<script>alert(1)</script>');
    s.tick();

    expect(text().querySelector('script')).toBeNull();

    fixture.destroy();
  });

  it('keeps block alignment in markdown as a class, not a style attribute a strict CSP blocks', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AlignedSourceComponent);
    const source = () => (fixture.nativeElement as HTMLElement).querySelector('.source') as HTMLElement;

    s.tick();

    expect(source().querySelector('p.et-rte-align-center')?.textContent).toBe('Centered');
    expect(source().querySelector('[style]')).toBeNull();

    fixture.destroy();
  });

  it('turns a page count into one button per page', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaginationComponent);
    const labels = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map((button) =>
        button.textContent?.trim(),
      );

    s.tick();

    expect(labels()).toEqual(['1', '2', '3']);

    fixture.componentInstance.maxPage.set(0);
    s.tick();

    expect(labels()).toEqual([]);

    fixture.destroy();
  });

  it('names both sides of a match and the result type, with placeholders for a missing side', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCardComponent);
    const card = fixture.componentInstance;
    const text = (selector: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? null;

    s.tick();

    expect([text('.home'), text('.away'), text('.result')]).toEqual(['Home FC', 'Away FC', 'PSO']);

    card.match.set(match({ status: 'preparing', away: null }));
    card.resultType.set(null);
    s.tick();

    expect([text('.home'), text('.away'), text('.result')]).toEqual(['Home FC', 'TBD', '']);

    card.match.set(match({ status: 'finished', away: null }));
    card.resultType.set('default');
    s.tick();

    expect([text('.away'), text('.result')]).toEqual(['No opponent', 'FT']);

    card.match.set(null);
    s.tick();

    expect(text('.home')).toBeNull();

    fixture.destroy();
  });

  it('labels a match option from one side at a time', () => {
    scenario();

    const label = (option: MatchListView) =>
      `${normalizeMatchParticipant(option, 'home')?.data?.['name'] ?? 'TBD'} vs ${normalizeMatchParticipant(option, 'away')?.data?.['name'] ?? 'TBD'}`;

    expect(label(match({}))).toBe('Home FC vs Away FC');
    expect(label(match({ status: 'preparing', home: null }))).toBe('TBD vs Away FC');
    expect(normalizeMatchParticipant(null, 'home')).toBeNull();
  });
});
