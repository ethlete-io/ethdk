import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  FORM_FIELD_IMPORTS,
  provideFormFieldLabels,
  RATING_ERROR_CODES,
  RATING_IMPORTS,
  RatingComponent,
  RatingDirective,
  RatingIconDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-match-review',
  imports: [FORM_FIELD_IMPORTS, RATING_IMPORTS, FormField],
  template: `
    <et-rating [formField]="review.stars" [allowHalf]="allowHalf()" [max]="max()" class="stars">
      <et-label>Match rating</et-label>
      <et-hint>Required</et-hint>
    </et-rating>
    <et-rating [(value)]="hearts" class="hearts" aria-label="Atmosphere">
      <ng-template let-state let-index="index" etRatingIcon>
        <span [attr.data-index]="index" class="heart">{{ state }}</span>
      </ng-template>
    </et-rating>
  `,
})
class MatchReviewComponent {
  model = signal({ stars: null as number | null });
  review = form(this.model, (path) => required(path.stars));
  allowHalf = signal(false);
  max = signal<number | undefined>(undefined);
  hearts = signal<number | null>(2);
}

@Component({
  selector: 'et-scenario-double-icon-rating',
  imports: [RATING_IMPORTS],
  template: `
    <et-rating aria-label="Broken">
      <ng-template etRatingIcon>A</ng-template>
      <ng-template etRatingIcon>B</ng-template>
    </et-rating>
  `,
})
class DoubleIconRatingComponent {}

@Component({
  selector: 'et-scenario-venue-rating',
  imports: [RatingComponent, RatingIconDirective, RatingDirective],
  template: `
    <et-rating [(value)]="venue" [readonly]="readonly()" class="venue" aria-label="Venue">
      <ng-template let-state etRatingIcon>
        <b class="dot">{{ state }}</b>
      </ng-template>
    </et-rating>
    <div #stars="etRating" [(value)]="custom" [max]="3" class="custom" etRating allowHalf aria-label="Custom">
      @for (index of [1, 2, 3]; track index) {
        <button
          [attr.data-state]="stars.iconState(index)"
          (click)="stars.commitPointer(index)"
          (pointerenter)="stars.setHoverValue(index - 0.5)"
          tabindex="-1"
          type="button"
        >
          {{ index }}
        </button>
      }
    </div>
  `,
})
class VenueRatingComponent {
  venue = signal<number | null>(4);
  custom = signal<number | null>(null);
  readonly = signal(false);
  rating = viewChild.required(RatingComponent);
  headless = viewChild.required('stars', { read: RatingDirective });
}

@Component({
  selector: 'et-scenario-localized-rating',
  imports: [RATING_IMPORTS],
  providers: [
    provideFormFieldLabels({ ratingEmpty: 'Keine Bewertung', ratingValue: (value, max) => `${value} von ${max}` }),
  ],
  template: `<et-rating [(value)]="stars" [max]="4" class="localized" aria-label="Bewertung" />`,
})
class LocalizedRatingComponent {
  stars = signal<number | null>(null);
}

const code = (value: number) => `ET${value}`;

const slider = () => document.querySelector<HTMLElement>('.stars')!;

const hearts = () => document.querySelector<HTMLElement>('.hearts')!;

const press = (s: Scenario, key: string, target = slider()) => {
  const event = s.keydown(key, target);

  s.tick();

  return event;
};

const render = (s: Scenario) => {
  const fixture = TestBed.createComponent(MatchReviewComponent);

  document.body.appendChild(fixture.nativeElement);
  s.tick();
  s.frame(2);

  return fixture;
};

describe('rating scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('is a labelled slider driven by the arrow, Home, End and Delete keys', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    expect(slider().getAttribute('role')).toBe('slider');
    expect(slider().getAttribute('tabindex')).toBe('0');
    expect(slider().getAttribute('aria-labelledby')).toBe(document.querySelector('et-label')?.id);
    expect(slider().getAttribute('aria-valuemax')).toBe('5');
    expect(slider().getAttribute('aria-valuenow')).toBe('0');
    expect(slider().getAttribute('aria-valuetext')).toBe('No rating');
    expect(slider().getAttribute('aria-required')).toBe('true');

    expect(press(s, 'ArrowRight').defaultPrevented).toBe(true);
    press(s, 'ArrowUp');
    expect(page.model().stars).toBe(2);
    expect(slider().getAttribute('aria-valuetext')).toBe('2 of 5');

    press(s, 'End');
    press(s, 'ArrowRight');
    expect(page.model().stars).toBe(5);

    press(s, 'Home');
    expect(page.model().stars).toBe(1);

    press(s, 'ArrowLeft');
    expect(page.model().stars).toBeNull();

    press(s, 'End');
    press(s, 'Delete');
    expect(page.model().stars).toBeNull();

    expect(press(s, 'a').defaultPrevented).toBe(false);

    slider().dispatchEvent(new FocusEvent('blur'));
    s.tick();
    s.frame(2);

    expect(page.review.stars().touched()).toBe(true);
    expect(slider().getAttribute('aria-invalid')).toBe('true');
  });

  it('announces its value text through the consumer-provided form field labels', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedRatingComponent);
    const rating = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.localized')!;

    document.body.appendChild(fixture.nativeElement);
    s.tick();

    expect(rating.getAttribute('aria-valuetext')).toBe('Keine Bewertung');

    press(s, 'ArrowRight', rating);
    press(s, 'ArrowRight', rating);

    expect(fixture.componentInstance.stars()).toBe(2);
    expect(rating.getAttribute('aria-valuetext')).toBe('2 von 4');
    s.flush();
  });

  it('commits a clicked star, clears it on a second click and steps in halves when allowed', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;
    const star = (index: number) => slider().querySelectorAll<HTMLElement>('.et-rating-row .et-rating-icon')[index]!;

    star(3).click();
    s.tick();
    expect(page.model().stars).toBe(4);

    star(3).click();
    s.tick();
    expect(page.model().stars).toBeNull();

    page.allowHalf.set(true);
    page.max.set(10);
    s.tick();

    expect(slider().getAttribute('aria-valuemax')).toBe('10');

    press(s, 'ArrowRight');
    expect(page.model().stars).toBe(0.5);
    expect(slider().getAttribute('aria-valuetext')).toBe('0.5 of 10');
  });

  it('caps aria-valuenow and the keyboard start at a lowered max', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    page.model.set({ stars: 5 });
    page.max.set(3);
    s.tick();

    expect(slider().getAttribute('aria-valuemax')).toBe('3');
    expect(slider().getAttribute('aria-valuenow')).toBe('3');
    expect(slider().getAttribute('aria-valuetext')).toBe('3 of 3');

    press(s, 'ArrowLeft');
    expect(page.model().stars).toBe(2);
  });

  it('flips the horizontal arrow keys in RTL', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    slider().style.direction = 'rtl';
    page.model.set({ stars: 2 });
    s.tick();

    press(s, 'ArrowLeft');
    expect(page.model().stars).toBe(3);

    press(s, 'ArrowRight');
    press(s, 'ArrowRight');
    expect(page.model().stars).toBe(1);

    press(s, 'ArrowUp');
    expect(page.model().stars).toBe(2);
  });

  it('renders a custom icon per step with its state', () => {
    const s = scenario();
    const fixture = render(s);
    const states = () => Array.from(hearts().querySelectorAll('.heart')).map((heart) => heart.textContent);

    expect(states()).toEqual(['full', 'full', 'empty', 'empty', 'empty']);
    expect(hearts().getAttribute('aria-label')).toBe('Atmosphere');
    expect(Array.from(hearts().querySelectorAll('.heart')).map((heart) => heart.getAttribute('data-index'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);

    press(s, 'ArrowRight', hearts());
    expect(fixture.componentInstance.hearts()).toBe(3);
    expect(states()).toEqual(['full', 'full', 'full', 'empty', 'empty']);
  });

  it('reports a second icon template', () => {
    const s = scenario();

    expect(() => {
      TestBed.createComponent(DoubleIconRatingComponent);
      s.tick();
    }).toThrow(code(RATING_ERROR_CODES.DUPLICATE_ICON_TEMPLATE));

    s.tick(1);
    s.frame(2);

    const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');
    const context = s.errors.splice(index, 1)[0]?.error as { element?: Node } | undefined;

    expect(context?.element?.nodeType).toBe(Node.COMMENT_NODE);
    s.errors.splice(0, s.errors.length);
  });

  it('builds a readonly custom-icon rating and a fully headless one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(VenueRatingComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const venue = host.querySelector<HTMLElement>('.venue')!;
    const custom = host.querySelector<HTMLElement>('.custom')!;
    const states = () => Array.from(custom.querySelectorAll('button')).map((button) => button.dataset['state']);

    document.body.appendChild(host);
    s.tick();
    s.frame(2);

    expect(Array.from(venue.querySelectorAll('.dot')).map((dot) => dot.textContent)).toEqual([
      'full',
      'full',
      'full',
      'full',
      'empty',
    ]);

    app.readonly.set(true);
    s.tick();
    s.keydown('ArrowRight', venue);
    s.tick();

    expect(app.venue()).toBe(4);
    expect(venue.getAttribute('aria-readonly')).toBe('true');

    app.rating().focus();
    expect(document.activeElement).toBe(venue);

    expect(custom.getAttribute('role')).toBe('slider');
    expect(custom.getAttribute('aria-valuemax')).toBe('3');
    expect(custom.getAttribute('aria-valuetext')).toBe('No rating');

    custom.querySelectorAll('button')[1]!.dispatchEvent(new Event('pointerenter'));
    s.tick();

    expect(states()).toEqual(['full', 'half', 'empty']);

    custom.dispatchEvent(new Event('pointerleave'));
    custom.querySelectorAll('button')[2]!.click();
    s.tick();

    expect(app.custom()).toBe(3);
    expect(custom.getAttribute('aria-valuetext')).toBe('3 of 3');

    s.keydown('ArrowLeft', custom);
    s.tick();

    expect(app.custom()).toBe(2.5);
    expect(app.headless().hasValue()).toBe(true);
    expect(states()).toEqual(['full', 'full', 'half']);
    s.flush();
  });
});
