import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CommentTargetComponent } from './comment-target.component';

@Component({
  imports: [CommentTargetComponent],
  template: `<ethlete-comment-target [frame]="frame" (comment)="events.push($event.type)" />`,
})
class HostComponent {
  public frame = 'Kopf-Zeile mit langem Namen';
  public events: string[] = [];
}

describe('CommentTargetComponent', () => {
  it('labels the button with the frame and reports a click and Enter', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const target = fixture.nativeElement.querySelector('ethlete-comment-target') as HTMLElement;

    expect(target.getAttribute('aria-label')).toBe('Kommentar zu Kopf-Zeile mit langem Namen');
    expect(target.getAttribute('role')).toBe('button');
    expect(target.tabIndex).toBe(0);

    target.click();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(fixture.componentInstance.events).toEqual(['click', 'keydown', 'keydown']);
  });
});
