import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { KickPlayerParamsDirective } from './kick-player-params.directive';

@Component({
  selector: 'et-test-kick-params-host',
  template: '',
  hostDirectives: [{ directive: KickPlayerParamsDirective, inputs: ['channel', 'width', 'height', 'muted'] }],
})
class HostComponent {}

const setup = (inputs: Record<string, unknown>) => {
  const fixture = TestBed.createComponent(HostComponent);

  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }

  fixture.detectChanges();

  return fixture.debugElement.injector.get(KickPlayerParamsDirective);
};

describe('KickPlayerParamsDirective', () => {
  it('should derive the player id from the channel', () => {
    expect(setup({ channel: 'abc123' }).playerId()).toBe('kick-abc123');
  });

  it('should follow channel changes in the player id', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentRef.setInput('channel', 'one');
    fixture.detectChanges();
    const params = fixture.debugElement.injector.get(KickPlayerParamsDirective);

    fixture.componentRef.setInput('channel', 'two');
    fixture.detectChanges();

    expect(params.playerId()).toBe('kick-two');
  });

  it('should default the size to 100%', () => {
    const params = setup({ channel: 'a' });

    expect(params.width()).toBe('100%');
    expect(params.height()).toBe('100%');
  });

  it('should turn numeric size strings into numbers and keep other units', () => {
    const params = setup({ channel: 'a', width: '640', height: '50vh' });

    expect(params.width()).toBe(640);
    expect(params.height()).toBe('50vh');
  });

  it('should create 4 input bindings', () => {
    expect(setup({ channel: 'a' }).createBindings()).toHaveLength(4);
  });

  it('should default muted to false and coerce the attribute', () => {
    expect(setup({ channel: 'a' }).muted()).toBe(false);
    expect(setup({ channel: 'a', muted: '' }).muted()).toBe(true);
    expect(setup({ channel: 'a', muted: 'false' }).muted()).toBe(false);
  });
});
