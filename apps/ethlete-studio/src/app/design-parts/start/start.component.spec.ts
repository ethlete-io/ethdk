import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StartComponent } from './start.component';

const render = async (repo?: string, busy = false, repos: string[] = []) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(StartComponent);

  fixture.componentRef.setInput('repo', repo);
  fixture.componentRef.setInput('busy', busy);
  fixture.componentRef.setInput('repos', repos);
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

  it('turns Repo öffnen into a busy button that takes no click while busy', async () => {
    const { fixture, element } = await render(undefined, true);
    let opened = 0;

    fixture.componentInstance.openRepo.subscribe(() => opened++);
    const open = element.querySelector<HTMLButtonElement>('button[variant="filled"]');

    open?.click();

    expect(open?.getAttribute('aria-busy')).toBe('true');
    expect(open?.querySelector('et-spinner')).not.toBeNull();
    expect(opened).toBe(0);
  });

  it('turns Anderes Repo into a busy button while busy', async () => {
    const { fixture, element } = await render('zweites-repo', true);
    let other = 0;

    fixture.componentInstance.otherRepo.subscribe(() => other++);
    const button = element.querySelector<HTMLButtonElement>('header button');

    button?.click();

    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(other).toBe(0);
  });

  it('lists the other known repos in both cards and emits the picked name', async () => {
    const known = ['ethlete-sdk', 'tomflix', 'fifagg-frontend'];
    const withRepo = await render('tomflix', false, known);
    const picked: string[] = [];

    withRepo.fixture.componentInstance.projectChange.subscribe((name) => picked.push(name));
    withRepo.button('fifagg-frontend')?.click();

    expect(withRepo.element.textContent).toContain('Zuletzt geöffnet');
    expect(withRepo.button('tomflix')).toBeUndefined();
    expect(withRepo.button('ethlete-sdk')).toBeDefined();
    expect(picked).toEqual(['fifagg-frontend']);

    TestBed.resetTestingModule();
    const noRepo = await render(undefined, true, known);

    expect(noRepo.element.textContent).toContain('Zuletzt geöffnet');
    expect(noRepo.button('tomflix')?.disabled).toBe(true);
  });

  it('shows no label without known repos', async () => {
    const { element } = await render('solo', false, ['solo']);

    expect(element.textContent).not.toContain('Zuletzt geöffnet');
  });
});
