import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, tap } from '../support';

const INPUT_STORY_ID = 'components-forms-input--default';
const DESCRIPTION_STORY_ID = 'components-forms-input--description';
const WARNING_STORY_ID = 'components-forms-warning--default';
const COUNTER_STORY_ID = 'components-forms-counter--default';

interface FieldParts {
  field: Locator;
  frame: Locator;
  label: Locator;
  control: Locator;
}

function fieldParts(scope: Locator): FieldParts {
  const field = scope.locator('et-form-field').first();

  return {
    field,
    frame: field.locator('.et-form-field-control-frame'),
    label: field.locator('.et-form-field-label-area'),
    control: field.locator('input.et-input-native'),
  };
}

async function openLabelMode(page: Page, labelMode: string, value = ''): Promise<FieldParts> {
  const root = await openStory(page, INPUT_STORY_ID, { args: { labelMode, value } });

  return fieldParts(root);
}

async function labelOffsetFromFrameTop({ label, frame }: FieldParts): Promise<number> {
  const [labelBox, frameBox] = [await boxOf(label), await boxOf(frame)];

  return labelBox.y - frameBox.y;
}

async function labelBottomAboveControlCentre({ label, control }: FieldParts): Promise<number> {
  const [labelBox, controlBox] = [await boxOf(label), await boxOf(control)];

  return controlBox.y + controlBox.height / 2 - (labelBox.y + labelBox.height);
}

async function labelBottomAboveFrameTop({ label, frame }: FieldParts): Promise<number> {
  const [labelBox, frameBox] = [await boxOf(label), await boxOf(frame)];

  return frameBox.y - (labelBox.y + labelBox.height);
}

async function labelCentreOffset({ label, frame }: FieldParts): Promise<number> {
  const [labelBox, frameBox] = [await boxOf(label), await boxOf(frame)];

  return Math.abs(labelBox.y + labelBox.height / 2 - (frameBox.y + frameBox.height / 2));
}

async function placeholderColor(control: Locator): Promise<string> {
  return control.evaluate((el) => getComputedStyle(el, '::placeholder').color);
}

async function expectLabelAtRestInside(parts: FieldParts): Promise<void> {
  await expect(parts.field).not.toHaveAttribute('data-label-floated');
  await expect.poll(() => labelCentreOffset(parts)).toBeLessThanOrEqual(4);
  await expect.poll(() => placeholderColor(parts.control)).toBe('rgba(0, 0, 0, 0)');
}

async function expectLabelFloatedInside(parts: FieldParts): Promise<void> {
  await expect(parts.field).toHaveAttribute('data-label-floated', '');
  await expect.poll(() => labelBottomAboveControlCentre(parts)).toBeGreaterThan(0);
  expect(await labelOffsetFromFrameTop(parts)).toBeGreaterThanOrEqual(0);
}

async function supportHeights(field: Locator): Promise<{ region: number; active: number }> {
  return field.evaluate((el) => {
    const region = el.querySelector('.et-form-field-support');
    const active = el.querySelector('.et-form-field-support-content[data-active]');

    return {
      region: region?.getBoundingClientRect().height ?? -1,
      active: active?.getBoundingClientRect().height ?? -2,
    };
  });
}

const HIDDEN_ROOT_STYLE_ID = 'e2e-hidden-root';

async function mountStoryHidden(page: Page): Promise<void> {
  await page.addInitScript((styleId) => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');

      style.id = styleId;
      style.textContent = '#storybook-root { display: none; }';
      document.head.append(style);
    });
  }, HIDDEN_ROOT_STYLE_ID);
}

async function revealStory(page: Page): Promise<void> {
  await page.evaluate((styleId) => document.getElementById(styleId)?.remove(), HIDDEN_ROOT_STYLE_ID);
}

async function supportTransitions(field: Locator): Promise<string[]> {
  return field.evaluate(
    (el) =>
      new Promise<string[]>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve(
              el
                .getAnimations({ subtree: true })
                .filter((animation) =>
                  (animation.effect as KeyframeEffect | null)?.target?.closest('.et-form-field-support'),
                )
                .map((animation) => (animation as CSSTransition).transitionProperty),
            ),
          ),
        ),
      ),
  );
}

async function expectSupportFitsActiveMessage(field: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const { region, active } = await supportHeights(field);

      return Math.abs(region - active);
    })
    .toBeLessThanOrEqual(1);
}

test.describe('form-field / floating label', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('floating-inside rests centred in the frame and hides the placeholder', async ({ page }) => {
    const parts = await openLabelMode(page, 'floating-inside');

    await expectLabelAtRestInside(parts);
  });

  test('floating-inside floats to the top of the frame on focus, shrinks and reveals the placeholder', async ({
    page,
  }) => {
    const parts = await openLabelMode(page, 'floating-inside');
    const restHeight = (await boxOf(parts.label)).height;

    await pressKey(page, 'Tab');
    await expect(parts.control).toBeFocused();

    await expectLabelFloatedInside(parts);
    await expect.poll(async () => (await boxOf(parts.label)).height).toBeLessThan(restHeight);
    await expect.poll(() => placeholderColor(parts.control)).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('floating-inside stays floated after blur while it holds a value, and drops back once cleared', async ({
    page,
  }) => {
    const parts = await openLabelMode(page, 'floating-inside');

    await pressKey(page, 'Tab');
    await page.keyboard.type('team-a');
    await pressKey(page, 'Tab');

    await expect(parts.control).not.toBeFocused();
    await expectLabelFloatedInside(parts);

    await parts.control.focus();
    await parts.control.fill('');
    await parts.control.blur();

    await expectLabelAtRestInside(parts);
  });

  test('a prefilled floating-inside field loads with the label floated', async ({ page }) => {
    const parts = await openLabelMode(page, 'floating-inside', 'team-a');

    await expectLabelFloatedInside(parts);
  });

  test('floating-outside rests inside the frame and floats above it on focus', async ({ page }) => {
    const parts = await openLabelMode(page, 'floating-outside');

    await expect.poll(() => labelCentreOffset(parts)).toBeLessThanOrEqual(4);

    await pressKey(page, 'Tab');

    await expect(parts.field).toHaveAttribute('data-label-floated', '');
    await expect.poll(() => labelBottomAboveFrameTop(parts)).toBeGreaterThanOrEqual(0);
  });

  test('static keeps the label above the frame, focused or not', async ({ page }) => {
    const parts = await openLabelMode(page, 'static');

    expect(await labelBottomAboveFrameTop(parts)).toBeGreaterThanOrEqual(0);
    const restY = (await boxOf(parts.label)).y;

    await pressKey(page, 'Tab');

    await expect(parts.control).toBeFocused();
    await expect(parts.field).not.toHaveAttribute('data-label-floated');
    expect((await boxOf(parts.label)).y).toBe(restY);
  });

  test('inline puts the label on the control row, before the input', async ({ page }) => {
    const parts = await openLabelMode(page, 'inline');
    const [labelBox, controlBox, frameBox] = [
      await boxOf(parts.label),
      await boxOf(parts.control),
      await boxOf(parts.frame),
    ];

    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(controlBox.x);
    expect(labelBox.y).toBeGreaterThanOrEqual(frameBox.y);
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height);
  });
});

test.describe('form-field / support region', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard editing');

  test('a warning takes the hint slot, is announced politely and describes the control', async ({ page }) => {
    const root = await openStory(page, WARNING_STORY_ID);
    const { field, control } = fieldParts(root);
    const warning = field.locator('.et-form-field-warnings');

    await expect(warning).toHaveAttribute('data-active', 'true');
    await expect(warning).toHaveAttribute('aria-live', 'polite');
    await expect(warning).toContainText('leaked-password');
    await expect(field.locator('et-hint')).toBeHidden();
    await expect(control).toHaveAttribute('aria-describedby', (await warning.getAttribute('id')) ?? '');
    await expectSupportFitsActiveMessage(field);
  });

  test('an error replaces the warning once the edited field is touched', async ({ page }) => {
    const root = await openStory(page, WARNING_STORY_ID);
    const { field, control } = fieldParts(root);
    const errors = field.locator('.et-form-field-errors');

    await control.fill('abc');
    await control.blur();

    await expect(errors).toHaveAttribute('data-active', 'true');
    await expect(errors).toHaveAttribute('aria-live', 'polite');
    await expect(errors).toContainText('Use at least 8 characters');
    await expect(field.locator('.et-form-field-warnings[data-active]')).toHaveCount(0);
    await expect(control).toHaveAttribute('aria-describedby', (await errors.getAttribute('id')) ?? '');
    await expectSupportFitsActiveMessage(field);
  });

  test('the hint returns once neither an error nor a warning applies', async ({ page }) => {
    const root = await openStory(page, WARNING_STORY_ID);
    const { field, control } = fieldParts(root);
    const hint = field.locator('.et-form-field-hint');

    await control.fill('correct-horse-battery');
    await control.blur();

    await expect(hint).toHaveAttribute('data-active', 'true');
    await expect(hint).toContainText('At least 8 characters.');
    await expect(field.locator('.et-form-field-support-content[data-active]')).toHaveCount(1);
    await expect(control).toHaveAttribute('aria-describedby', (await hint.getAttribute('id')) ?? '');
    await expectSupportFitsActiveMessage(field);
  });

  test('a message shown from the first render does not animate in when its hidden field is revealed', async ({
    page,
  }) => {
    await mountStoryHidden(page);
    const root = await openStory(page, WARNING_STORY_ID);
    const { field } = fieldParts(root);

    await revealStory(page);

    expect(await supportTransitions(field)).toEqual([]);
    await expectSupportFitsActiveMessage(field);
  });

  test('a message that replaces another later animates in', async ({ page }) => {
    const root = await openStory(page, WARNING_STORY_ID);
    const { field, control } = fieldParts(root);

    await control.fill('correct-horse-battery');

    expect(await supportTransitions(field)).toContain('opacity');
  });
});

test.describe('form-field / description', () => {
  test('an et-description describes the control', async ({ page }) => {
    const root = await openStory(page, DESCRIPTION_STORY_ID);
    const control = root.getByRole('textbox', { name: 'IBAN' });

    await expect(control).toHaveAccessibleDescription(/Payouts go to this account within two working days\./);
  });
});

test.describe('form-field / busy', () => {
  test('a busy field reports aria-busy and shows a spinner in its suffix', async ({ page }) => {
    const root = await openStory(page, COUNTER_STORY_ID);
    const field = root.locator('et-form-field[busy]');

    await expect(field).toHaveAttribute('aria-busy', 'true');
    await expect(field.locator('.et-form-field-suffix .et-form-field-busy-spinner')).toBeVisible();
  });
});

test.describe('form-field / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap');

  test('a tap on a floating-inside field focuses the control and floats the label', async ({ page }) => {
    const parts = await openLabelMode(page, 'floating-inside');

    await expectLabelAtRestInside(parts);

    await tap(parts.frame);

    await expect(parts.control).toBeFocused();
    await expectLabelFloatedInside(parts);
  });
});
