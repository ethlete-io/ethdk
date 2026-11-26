import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormFieldStateService } from '../../../../services';
import { LabelComponent } from './label.component';

@Component({
  template: `
    <et-label>One</et-label>
    <et-label>Two</et-label>
  `,
  imports: [LabelComponent],
  providers: [FormFieldStateService],
})
class LabelsHost {}

describe('LabelComponent ids', () => {
  it('gives each label a unique id outside the components label id space', () => {
    const fixture = TestBed.createComponent(LabelsHost);
    fixture.detectChanges();

    const labels = fixture.debugElement.children.map((c) => c.componentInstance as LabelComponent);
    const ids = labels.map((l) => l.id);

    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).toMatch(/^et-cdk-label-\d+$/);
      expect(id).not.toMatch(/^et-label-\d+$/);
    }
  });
});
