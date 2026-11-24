import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StartComponent } from './start.component';

const render = async (repo?: string, busy = false, repos: string[] = [], repoPath?: string) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(StartComponent);

  fixture.componentRef.setInput('repo', repo);
  fixture.componentRef.setInput('busy', busy);
  fixture.componentRef.setInput('repos', repos);
  fixture.componentRef.setInput('repoPath', repoPath);
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

  it('asks for the colour base and the accent and copies a prompt with both answers', async () => {
    const { fixture, element, button } = await render('tomflix');
    const copied: string[] = [];

    fixture.componentInstance.copyPrompt.subscribe((prompt) => copied.push(prompt));
    button('Dunkel')?.click();
    button('Blau')?.click();
    await fixture.whenStable();
    button('Prompt kopieren')?.click();

    const pressed = [...element.querySelectorAll('[aria-pressed="true"]')].map((node) => node.textContent?.trim());
    const groups = [...element.querySelectorAll('[role="group"]')].map((group) => group.getAttribute('aria-label'));

    expect(groups).toEqual(['Farb-Grundlage', 'Akzent', 'Ethlete SDK']);
    expect(pressed).toEqual(['Dunkel', 'Blau']);
    expect(copied).toEqual([
      'Lege in tomflix das Produkt shop an, für das Design-System der Shop-App, mit dunkler Farb-Grundlage und dem Akzent Blau (#2563eb).',
    ]);
    expect(element.textContent).toContain('mit dunkler Farb-Grundlage und dem Akzent Blau (#2563eb).');
  });

  it('starts on both colour bases and the first accent', async () => {
    const { element } = await render('shop-repo');

    const pressed = [...element.querySelectorAll('[aria-pressed="true"]')].map((node) => node.textContent?.trim());

    expect(pressed).toEqual(['Beides', 'Rot']);
    expect(element.textContent).toContain('mit heller und dunkler Farb-Grundlage und dem Akzent Rot (#e50914).');
  });

  it('asks whether the product inherits from the SDK and says nothing about a base without an answer', async () => {
    const { fixture, element, button } = await render('tomflix');
    const copied: string[] = [];

    fixture.componentInstance.copyPrompt.subscribe((prompt) => copied.push(prompt));
    expect(element.textContent).not.toContain('erbt');

    button('Erbt vom SDK')?.click();
    await fixture.whenStable();
    button('Prompt kopieren')?.click();
    button('Eigenständig')?.click();
    await fixture.whenStable();
    button('Prompt kopieren')?.click();

    expect(copied.map((prompt) => prompt.slice(prompt.indexOf('(#e50914).') + 10))).toEqual([
      ' Es erbt vom Ethlete SDK (@ethlete/components).',
      ' Es erbt nicht vom Ethlete SDK.',
    ]);
    expect(fixture.componentInstance.base()).toBe('own');
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

  it('keeps three same-name roots apart by path and tells the runs by date and time', async () => {
    const own = '/home/tom/dev/tomflix';
    const early = '/home/tom/dev/client-runs/2026-11-24-0056/tomflix';
    const late = '/home/tom/dev/client-runs/2026-11-24-1109/tomflix';
    const { fixture, element } = await render('tomflix', false, [early, late, own, '/home/tom/dev/ethlete-sdk'], own);
    const picked: string[] = [];
    const labels = () => [...element.querySelectorAll<HTMLButtonElement>('button')].map((b) => b.textContent?.trim());

    fixture.componentInstance.projectChange.subscribe((path) => picked.push(path));
    element.querySelectorAll<HTMLButtonElement>('button')[labels().indexOf('tomflix24.11. 11:09')]?.click();

    expect(labels()).toContain('tomflix24.11. 00:56');
    expect(labels()).toContain('tomflix24.11. 11:09');
    expect(labels()).toContain('ethlete-sdk');
    expect(labels()).not.toContain('tomflix');
    expect(picked).toEqual([late]);
  });

  it('shows no label without known repos', async () => {
    const { element } = await render('solo', false, ['solo']);

    expect(element.textContent).not.toContain('Zuletzt geöffnet');
  });
});
