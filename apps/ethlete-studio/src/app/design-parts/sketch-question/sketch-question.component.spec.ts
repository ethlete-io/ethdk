import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SketchQuestionComponent } from './sketch-question.component';

@Component({
  imports: [SketchQuestionComponent],
  template: `<ethlete-sketch-question [question]="question()" class="absolute top-14" />`,
})
class HostComponent {
  question = signal('Welche Farbe bekommt der Rahmen der gewählten Variante, wenn sie gerade gezeichnet wird?');
}

describe('SketchQuestionComponent', () => {
  it('shows the question on one truncated line and keeps the classes its page places it with', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);

    await fixture.whenStable();

    const line = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ethlete-sketch-question')!;

    expect(line.textContent?.trim()).toBe(
      'Welche Farbe bekommt der Rahmen der gewählten Variante, wenn sie gerade gezeichnet wird?',
    );
    expect(line.hasAttribute('data-sk-question')).toBe(true);
    expect(line.classList).toContain('truncate');
    expect(line.classList).toContain('top-14');

    fixture.componentInstance.question.set('Kurz?');
    await fixture.whenStable();

    expect(line.textContent?.trim()).toBe('Kurz?');
  });
});
