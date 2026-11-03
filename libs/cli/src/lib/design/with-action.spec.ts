import { describe, expect, it } from 'vitest';
import { withAction } from '../../../design/define-part';

const sdkButton =
  '<button class="et-surface-interactive et-button" data-et-control="button" data-can-animate type="button"><div class="et-button-contents">Übernehmen</div></button>';

describe('withAction', () => {
  it('declares the action on the first button of SDK button markup', () => {
    expect(withAction(sdkButton, 'emit:merge')).toBe(
      sdkButton.replace('<button ', '<button data-et-action="emit:merge" '),
    );
  });

  it('finds the button behind a wrapper and attribute values that hold a >', () => {
    const markup = `<span class="[&>.x]:flex" data-a='>'><button>Go</button></span>`;

    expect(withAction(markup, 'emit:go')).toBe(
      `<span class="[&>.x]:flex" data-a='>'><button data-et-action="emit:go">Go</button></span>`,
    );
  });

  it('targets an element by class', () => {
    const markup = '<div class="et-select"><button type="button" class="et-select-trigger x">A</button></div>';

    expect(withAction(markup, { action: 'emit:roundChange', on: '.et-select-trigger' })).toBe(
      '<div class="et-select"><button data-et-action="emit:roundChange" type="button" class="et-select-trigger x">A</button></div>',
    );
  });

  it('throws when nothing matches', () => {
    expect(() => withAction('<a class="et-button">Go</a>', 'emit:go')).toThrow('no button in the markup');
    expect(() => withAction('<button-like>Go</button-like>', 'emit:go')).toThrow('no button');
    expect(() =>
      withAction('<div class="et-select-trigger-x"></div>', { action: 'emit:a', on: '.et-select-trigger' }),
    ).toThrow('no .et-select-trigger');
  });

  it('throws when the matched element already declares an action', () => {
    expect(() => withAction('<button data-et-action="emit:a">A</button>', 'emit:b')).toThrow('already declares');
  });
});
