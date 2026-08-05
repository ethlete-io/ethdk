import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { DESCRIPTION_LIST_IMPORTS } from './description-list.imports';

@Component({
  selector: 'et-test-description-list-host',
  template: `
    <dl et-description-list>
      <dt>Name</dt>
      <dd>Jane Doe</dd>
      <dt>Email</dt>
      <dd>jane&#64;example.com</dd>
    </dl>
  `,
  imports: [DESCRIPTION_LIST_IMPORTS],
})
class DescriptionListHostComponent {}

describe('DescriptionListComponent', () => {
  it('applies its class to the native dl and preserves the dt/dd children unchanged', () => {
    const fixture = TestBed.createComponent(DescriptionListHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const dl = host.querySelector('dl');

    expect(dl?.classList).toContain('et-description-list');
    expect([...host.querySelectorAll('dt')].map((el) => el.textContent)).toEqual(['Name', 'Email']);
    expect([...host.querySelectorAll('dd')].map((el) => el.textContent)).toEqual(['Jane Doe', 'jane@example.com']);
  });

  it('only matches a real <dl>, never a plain attribute', () => {
    TestBed.overrideComponent(DescriptionListHostComponent, {
      set: {
        template: `<div et-description-list><dt>Name</dt><dd>Jane Doe</dd></div>`,
      },
    });

    const fixture = TestBed.createComponent(DescriptionListHostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('div')?.classList).not.toContain('et-description-list');
  });
});
