import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { FacebookPlayerParamsDirective } from './facebook-player-params.directive';

@Component({
  selector: 'et-test-facebook-params-host',
  template: '',
  hostDirectives: [{ directive: FacebookPlayerParamsDirective, inputs: ['videoId', 'width', 'height'] }],
})
class HostComponent {}

const setup = (inputs: Record<string, unknown>) => {
  const fixture = TestBed.createComponent(HostComponent);

  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }

  fixture.detectChanges();

  return fixture.debugElement.injector.get(FacebookPlayerParamsDirective);
};

describe('FacebookPlayerParamsDirective', () => {
  it('should derive the player id from the videoId', () => {
    expect(setup({ videoId: 'abc123' }).playerId()).toBe('facebook-abc123');
  });

  it('should follow videoId changes in the player id', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentRef.setInput('videoId', 'one');
    fixture.detectChanges();
    const params = fixture.debugElement.injector.get(FacebookPlayerParamsDirective);

    fixture.componentRef.setInput('videoId', 'two');
    fixture.detectChanges();

    expect(params.playerId()).toBe('facebook-two');
  });

  it('should default the size to 100%', () => {
    const params = setup({ videoId: 'a' });

    expect(params.width()).toBe('100%');
    expect(params.height()).toBe('100%');
  });

  it('should turn numeric size strings into numbers and keep other units', () => {
    const params = setup({ videoId: 'a', width: '640', height: '50vh' });

    expect(params.width()).toBe(640);
    expect(params.height()).toBe('50vh');
  });

  it('should create 3 input bindings', () => {
    expect(setup({ videoId: 'a' }).createBindings()).toHaveLength(3);
  });
});
