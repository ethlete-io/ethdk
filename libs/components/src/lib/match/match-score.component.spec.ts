import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { MatchScoreComponent } from './match-score.component';

@Component({
  template: `<et-match-score [value]="value()" [subject]="subject()" animate />`,
  imports: [MatchScoreComponent],
})
class HostComponent {
  public value = signal('1');
  public subject = signal<unknown>('match-a');
}

const create = () => {
  const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;

  const change = (value: string) => {
    fixture.componentInstance.value.set(value);
    fixture.detectChanges();
  };
  const end = (selector: string) => {
    root.querySelector(selector)?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
  };
  const digits = () =>
    Array.from(root.querySelectorAll('.et-match-score-digit')).map((digit) => [
      digit.textContent?.trim(),
      digit.getAttribute('data-state'),
    ]);
  const flashCount = () => root.querySelectorAll('.et-match-score-flash').length;

  return { fixture, change, end, digits, flashCount };
};

describe('MatchScoreComponent', () => {
  it('draws the first value without a roll', () => {
    const driver = create();

    expect(driver.digits()).toEqual([['1', 'static']]);
    expect(driver.flashCount()).toBe(0);
  });

  it('rolls a changed value and drops the outgoing one when its roll ends', () => {
    const driver = create();
    driver.change('2');

    expect(driver.digits()).toEqual([
      ['1', 'out'],
      ['2', 'in'],
    ]);

    driver.end('.et-match-score-digit');

    expect(driver.digits()).toEqual([['2', 'static']]);
  });

  it('keeps the flash until its own animation ends, not the shorter roll', () => {
    const driver = create();
    driver.change('2');

    driver.end('.et-match-score-digit');

    expect(driver.flashCount()).toBe(1);

    driver.end('.et-match-score-flash');

    expect(driver.flashCount()).toBe(0);
  });

  it('draws the value of a new subject without a roll', () => {
    const driver = create();
    driver.fixture.componentInstance.subject.set('match-b');
    driver.change('5');

    expect(driver.digits()).toEqual([['5', 'static']]);
    expect(driver.flashCount()).toBe(0);
  });
});
