import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StartComponent } from './start.component';

const render = async (repo?: string) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(StartComponent);

  fixture.componentRef.setInput('repo', repo);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );

  return { fixture, element, button };
};

describe('StartComponent', () => {
  it('names the logo and asks for a repo when none is open', async () => {
    const { fixture, element, button } = await render();
    let opened = 0;

    fixture.componentInstance.openRepo.subscribe(() => opened++);
    button('Repo öffnen')?.click();

    expect(element.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe('Ethlete Studio');
    expect(element.textContent).toContain('Kein Repo geöffnet');
    expect(button('Anderes Repo')).toBeUndefined();
    expect(opened).toBe(1);
  });

  it('puts the open repo into the prompt and emits other repo and copy', async () => {
    const { fixture, element, button } = await render('mein-monorepo-mit-langem-namen');
    const emitted: string[] = [];

    fixture.componentInstance.otherRepo.subscribe(() => emitted.push('other'));
    fixture.componentInstance.copyPrompt.subscribe(() => emitted.push('copy'));
    button('Anderes Repo')?.click();
    button('Prompt kopieren')?.click();

    expect(element.textContent).toContain('Lege in mein-monorepo-mit-langem-namen das Produkt shop an');
    expect(button('Repo öffnen')).toBeUndefined();
    expect(emitted).toEqual(['other', 'copy']);
  });
});
