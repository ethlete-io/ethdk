import { Component, provideZonelessChangeDetection, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { MergeComponent } from './merge.component';
import { MergeRow } from './merge-sample';

@Component({
  template: `<ng-template #shot let-src="src"><img [attr.data-src]="src" alt="" /></ng-template>`,
})
class ShotHostComponent {
  public shot = viewChild.required<TemplateRef<{ $implicit: MergeRow; src: string }>>('shot');
}

const RECT = { x: 40, y: 80, width: 120, height: 32 };

const ROW: MergeRow = {
  part: 'pages/home',
  state: 'default',
  instances: 1,
  width: 1440,
  height: 900,
  now: 'now.html',
  after: 'after.html',
  crop: { now: RECT, after: RECT },
};

const shotTemplate = () => {
  const host = TestBed.createComponent(ShotHostComponent);

  host.detectChanges();

  return host.componentInstance.shot();
};

const render = async (inputs: Record<string, unknown>) => {
  const fixture = TestBed.createComponent(MergeComponent);

  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();

  return fixture;
};

describe('MergeComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

  it('shows the unchanged disclosure when states are unchanged', async () => {
    const el = (await render({ unchangedStates: { part: 'pages/inbox', states: ['all'] } }))
      .nativeElement as HTMLElement;

    expect(el.querySelector('ethlete-disclosure')).not.toBeNull();
  });

  it('hides the unchanged disclosure when no state is unchanged', async () => {
    const el = (await render({ unchangedStates: { part: 'pages/inbox', states: [] } })).nativeElement as HTMLElement;

    expect(el.querySelector('ethlete-disclosure')).toBeNull();
  });

  it('picks a changed row on Space and prevents the page scroll', async () => {
    const fixture = await render({});
    const picked: string[] = [];

    fixture.componentInstance.pick.subscribe((row) => picked.push(row));

    const row = (fixture.nativeElement as HTMLElement).querySelector('li[tabindex="0"]') as HTMLElement;
    const space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });

    row.dispatchEvent(space);

    expect(picked).toHaveLength(1);
    expect(space.defaultPrevented).toBe(true);
  });

  it('crops the changed instance from each side and draws no sample content', async () => {
    const el = (await render({ changed: [ROW], selected: 0, shotTemplate: shotTemplate() }))
      .nativeElement as HTMLElement;

    expect(el.textContent).not.toContain(STUDIO_LABELS.system.copyPrompt);
    expect([...el.querySelectorAll('img')].map((img) => img.dataset['src'])).toEqual([
      'now.html',
      'after.html',
      'now.html',
      'after.html',
    ]);
  });

  it('shows no crop without an outline and labels the empty side of a state the variant adds', async () => {
    const added: MergeRow = { ...ROW, state: 'added', now: '', missing: 'now', crop: { now: null, after: RECT } };
    const el = (
      await render({
        changed: [added],
        selected: 0,
        shotTemplate: shotTemplate(),
        target: { part: 'components/button', name: 'button', variant: 'a', note: '' },
      })
    ).nativeElement as HTMLElement;

    expect(el.querySelector('figure')?.textContent).toContain(STUDIO_LABELS.merge.addedIn('a'));
    expect([...el.querySelectorAll('img')].map((img) => img.dataset['src'])).toEqual(['after.html', 'after.html']);
  });

  it('shows the Merge button loading while merging and ignores its click', async () => {
    const fixture = await render({ merging: true });
    const merges: unknown[] = [];

    fixture.componentInstance.merge.subscribe((event) => merges.push(event));

    const merge = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === STUDIO_LABELS.merge.merge,
    );

    merge?.click();

    expect(merge?.getAttribute('aria-busy')).toBe('true');
    expect(merges).toEqual([]);
  });
});
