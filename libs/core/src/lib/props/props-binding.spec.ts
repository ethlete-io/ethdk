import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Props, createProps } from './create-props';
import { PropsDirective } from './props.directive';

@Component({
  template: '<div [etProps]="props()"></div>',
  imports: [PropsDirective],
})
class PropsHostComponent {
  props = signal<Props>(null as unknown as Props);
}

describe('bindProps / unbindProps', () => {
  const clicks: string[] = [];

  const createTestProps = (label: string) =>
    createProps({
      name: `props-${label}`,
      staticClasses: [`static-${label}`],
      staticAttributes: { [`data-static-${label}`]: label },
      staticStyles: { [`--static-${label}`]: '1' },
      classes: { [`signal-${label}`]: signal(true) },
      attributes: { [`data-signal-${label}`]: signal(label) },
      listeners: ({ on }) => on('click', () => clicks.push(label)),
    });

  const setup = (props: Props) => {
    const fixture = TestBed.createComponent(PropsHostComponent);
    fixture.componentInstance.props.set(props);
    fixture.detectChanges();

    return { fixture, element: fixture.nativeElement.querySelector('div') as HTMLElement };
  };

  beforeEach(() => {
    clicks.length = 0;
  });

  it('removes what it applied when the props are rebound', () => {
    const first = createTestProps('a');
    const second = createTestProps('b');
    const { fixture, element } = setup(first);

    expect(element.classList.contains('static-a')).toBe(true);
    expect(element.classList.contains('signal-a')).toBe(true);
    expect(element.getAttribute('data-static-a')).toBe('a');
    expect(element.getAttribute('data-signal-a')).toBe('a');
    expect(element.style.getPropertyValue('--static-a')).toBe('1');

    fixture.componentInstance.props.set(second);
    fixture.detectChanges();

    expect(element.classList.contains('static-a')).toBe(false);
    expect(element.classList.contains('signal-a')).toBe(false);
    expect(element.hasAttribute('data-static-a')).toBe(false);
    expect(element.hasAttribute('data-signal-a')).toBe(false);
    expect(element.style.getPropertyValue('--static-a')).toBe('');

    expect(element.classList.contains('static-b')).toBe(true);
    expect(element.getAttribute('data-static-b')).toBe('b');

    element.click();

    expect(clicks).toEqual(['b']);

    fixture.destroy();
  });

  it('removes what it applied when the host is destroyed', () => {
    const { fixture, element } = setup(createTestProps('a'));

    fixture.destroy();

    expect(element.classList.contains('static-a')).toBe(false);
    expect(element.hasAttribute('data-static-a')).toBe(false);

    element.click();

    expect(clicks).toEqual([]);
  });
});
