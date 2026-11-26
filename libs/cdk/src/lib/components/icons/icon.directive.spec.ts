import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconDirective } from './icon.directive';
import { provideIcons } from './icon-provider';

@Component({
  template: `<span [etIcon]="name()"></span>`,
  imports: [IconDirective],
})
class IconHostComponent {
  name = input.required<string>();
}

const renderIcon = (name: string) => {
  const fixture = TestBed.createComponent(IconHostComponent);
  fixture.componentRef.setInput('name', name);
  fixture.detectChanges();
};

describe('IconDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideIcons({
          name: 'check',
          data: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"></svg>',
        }),
      ],
    });
  });

  it.each(['constructor', 'toString', 'missing'])('reports %s as not found', (name) => {
    expect(() => renderIcon(name)).toThrow(`Icon with name ${name} not found.`);
  });
});

describe('provideIcons', () => {
  it('accepts an icon named after an Object.prototype member', () => {
    expect(() => provideIcons({ name: 'constructor', data: '<svg></svg>' })).not.toThrow();
  });
});
