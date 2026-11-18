import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ShellCollapseComponent } from './shell-collapse.component';

describe('ShellCollapseComponent', () => {
  it('labels its button and emits collapse on each click', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(ShellCollapseComponent);
    let collapsed = 0;

    fixture.componentInstance.collapse.subscribe(() => collapsed++);
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button');

    button?.click();
    button?.click();

    expect(button?.getAttribute('aria-label')).toBe('Hide panel');
    expect(collapsed).toBe(2);
  });
});
