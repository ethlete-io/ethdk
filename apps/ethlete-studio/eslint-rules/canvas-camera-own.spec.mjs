import { Linter, RuleTester } from 'eslint';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import tseslint from 'typescript-eslint';
import { CANVAS_CAMERA_KNOWN } from './canvas-camera-known.mjs';
import { canvasCameraOwn as rule } from './canvas-camera-own.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const PART = '/repo/apps/ethlete-studio/src/app/design-parts/demo/demo.component.ts';
const SKETCHES = 'apps/ethlete-studio/src/app/design-parts/sketches/sketches.component.ts';

const TEMPLATED = (name) => new URL(`./fixtures/templated/${name}.component.ts`, import.meta.url).pathname;

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

tester.run('canvas-camera-own', rule, {
  valid: [
    { filename: PART, code: `class A { panel = input<'open' | 'hidden'>('open'); }` },
    { filename: PART, code: `class A { zoomOut = output(); camera = input<Camera | null>(null); }` },
    { filename: PART, code: `class A { zoom = computed(() => this.canvas().camera().zoom); }` },
    { filename: PART, code: `class A { readonly ZOOM_STEP = 1.25; }` },
    { filename: PART, code: `const columns = Math.max(1, Math.min(MAX_COLUMNS, most));` },
    { filename: PART, code: `const fit = Math.min(1, width / frame.offsetWidth);` },
    { filename: PART, code: `class A { cropZoom = computed(() => Math.min(CROP.scale, fit)); }` },
    { filename: PART, code: `this.canvas.show({ kind: 'visible', zoom: this.canvas.camera().zoom * factor });` },
    { filename: PART, code: `element.addEventListener('click', onClick);` },
    { filename: PART, code: '@Component({ template: `<button (click)="zoomIn.emit()"></button>` }) class A {}' },
    { filename: TEMPLATED('click'), code: `@Component({ templateUrl: './click.component.html' }) class A {}` },
    {
      filename: PART,
      code: `class A { pan = signal({ x: 0, y: 0 }); }`,
      options: [{ known: { 'design-parts/demo/demo.component.ts': ['pan:state'] } }],
    },
  ],
  invalid: [
    { filename: PART, code: `class A { pan = signal({ x: 0, y: 0 }); }`, errors: [{ messageId: 'state' }] },
    { filename: PART, code: `class A { zoom = linkedSignal(() => 1); }`, errors: [{ messageId: 'state' }] },
    { filename: PART, code: `class A { camera = model<Camera>(START); }`, errors: [{ messageId: 'state' }] },
    { filename: PART, code: `class A { panOffset = { x: 0, y: 0 }; }`, errors: [{ messageId: 'state' }] },
    { filename: PART, code: `class A { camera$ = new BehaviorSubject(START); }`, errors: [{ messageId: 'state' }] },
    { filename: PART, code: `let zoom = 1;`, errors: [{ messageId: 'state' }] },
    { filename: PART, code: `list.addEventListener('wheel', onWheel);`, errors: [{ messageId: 'listener' }] },
    { filename: PART, code: `fromEvent(list, 'pointermove');`, errors: [{ messageId: 'listener' }] },
    {
      filename: PART,
      code: `class A { @HostListener('wheel', ['$event']) onWheel() {} }`,
      errors: [{ messageId: 'listener' }],
    },
    {
      filename: PART,
      code: `@Component({ host: { '(wheel)': 'pan($event)' } }) class A {}`,
      errors: [{ messageId: 'listener' }],
    },
    {
      filename: PART,
      code: '@Component({ template: `<div (pointermove.capture)="drag($event)"></div>` }) class A {}',
      errors: [{ messageId: 'listener' }],
    },
    { filename: PART, code: `list.onwheel = onWheel;`, errors: [{ messageId: 'listener' }] },
    {
      filename: TEMPLATED('wheel'),
      code: `@Component({ templateUrl: './wheel.component.html' }) class A {}`,
      errors: [{ messageId: 'listener' }],
    },
    {
      filename: PART,
      code: `const clampPan = ({ x, y }: Pan, room: Pan): Pan => ({ x: Math.min(0, x), y: Math.max(-room.y, y) });`,
      errors: [{ messageId: 'clamp' }, { messageId: 'clamp' }],
    },
    {
      filename: PART,
      code: `class A { room = computed<Pan | null>(() => ({ x: Math.max(0, w - l), y: 0 })); }`,
      errors: [{ messageId: 'clamp' }],
    },
    {
      filename: PART,
      code: `class A { shown = computed(() => clampPan(this.pan(), this.room())); }`,
      errors: [{ messageId: 'clamp' }],
    },
    {
      filename: PART,
      code: `class A { start = computed(() => ({ x: Math.min(0, this.camera().x), y: 0 })); }`,
      errors: [{ messageId: 'clamp' }],
    },
    {
      filename: PART,
      code: `class A { gutter = computed(() => Math.max(0, -this.pan().x)); }`,
      errors: [{ messageId: 'clamp' }],
    },
    { filename: PART, code: `const zoom = clampZoom(camera.zoom);`, errors: [{ messageId: 'clamp' }] },
    {
      filename: PART,
      code: `class A { pan = signal({ x: 0, y: 0 }); }`,
      options: [{ known: { 'design-parts/demo/demo.component.ts': ['pan:state', 'zoom:state'] } }],
      errors: [{ messageId: 'staleKnown' }],
    },
  ],
});

const lint = (code) =>
  new Linter({ configType: 'flat' }).verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { studio: { rules: { 'canvas-camera-own': rule } } },
        rules: { 'studio/canvas-camera-own': ['error', { known: CANVAS_CAMERA_KNOWN }] },
      },
    ],
    { filename: SKETCHES },
  );

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const hits = (messages) => messages.map((message) => `${message.line}:${message.messageId}`);

describe('canvas-camera-own on the real Sketches camera defects, with the known list of HEAD', () => {
  it('flags clampPan, room and shownPan from 030fe2f36', () => {
    const lines = fixture('sketches-030fe2f36.txt').split('\n');
    const messages = lint(lines.join('\n'));
    const flagged = (pattern) =>
      messages.some((message) => message.messageId === 'clamp' && pattern.test(lines[message.line - 1]));

    assert.ok(flagged(/x: Math\.min\(0, Math\.max\(-room\.x, x\)\)/), hits(messages).join(', '));
    assert.ok(flagged(/return \{ x: Math\.max\(0, world\.width - list\.width\)/), hits(messages).join(', '));
    assert.ok(flagged(/clampPan\(this\.pan\(\), room\)/), hits(messages).join(', '));
  });

  it('flags the Math.min(0, ...) camera from 5a29b1b94', () => {
    const lines = fixture('sketches-5a29b1b94.txt').split('\n');
    const messages = lint(lines.join('\n'));

    assert.ok(
      messages.some(
        (message) => message.messageId === 'clamp' && /x: Math\.min\(0, camera\.x\)/.test(lines[message.line - 1]),
      ),
      hits(messages).join(', '),
    );
  });
});
