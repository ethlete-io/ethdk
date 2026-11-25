import { buttonStyles, iconButtonStyles } from '@ethlete/components/design/button';
import { definePart } from '@design-system';
import { buttonPart, tfButton, tfIcons, type TfButtonKind, type TfButtonOptions } from '@shared/button-kit';
import css from './button.css?inline';

export { tfButton, tfIcons, type TfButtonKind, type TfButtonOptions };

/** The stylesheets a host needs next to `tfButton()` markup: the SDK button CSS and the Tomflix look. */
export const tfButtonStyles = `${buttonStyles}\n${iconButtonStyles}\n${css}`;

export default definePart({
  note: 'Weiches Rechteck mit feinem Rahmen für Zweitknöpfe, 44 Pixel hoch.',
  madeBy: ['claude-opus-5-5'],
  styles: tfButtonStyles,
  consumerAction: 'a button whose click the consumer binds',
  controls: { button: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true } },
  describe: {
    abspielen:
      'The primary Abspielen button with the play icon; check the shape, the 44px height and that the label reads.',
    'abspielen-hover': 'The Abspielen button, hovered; check that its fill changes from rest at a glance.',
    'abspielen-focus-visible': 'The Abspielen button with keyboard focus; check the focus ring outside its edge.',
    'abspielen-active': 'The Abspielen button, pressed; check that it goes a step past hover.',
    'abspielen-disabled': 'The Abspielen button, disabled; check that it fades and still reads as the same button.',
    'mehr-infos':
      'The secondary Mehr Infos button with the info icon; check the shape, the 44px height and that the label reads.',
    'mehr-infos-hover': 'The Mehr Infos button, hovered; check that its fill and edge change from rest at a glance.',
    'mehr-infos-focus-visible': 'The Mehr Infos button with keyboard focus; check the focus ring outside its edge.',
    'mehr-infos-active': 'The Mehr Infos button, pressed; check that it goes a step past hover.',
    'mehr-infos-disabled': 'The Mehr Infos button, disabled; check that it fades and still reads as the same button.',
    filter: 'The icon-only Filter button; check that it is a 44px circle or square matching the labelled buttons.',
    'filter-hover': 'The Filter button, hovered; check that its fill and edge change from rest at a glance.',
    'filter-focus-visible': 'The Filter button with keyboard focus; check the focus ring outside its edge.',
    'filter-active': 'The Filter button, pressed; check that it goes a step past hover.',
    'filter-disabled': 'The Filter button, disabled; check that it fades and still reads as the same button.',
    merken: 'The secondary Merken button with a plus; check that a second secondary label keeps the same shape.',
    'ueber-bild':
      'Abspielen, Mehr Infos and an icon-only button over a film backdrop, as the hero draws them; check that each reads on the picture.',
  },
  ...buttonPart,
});
