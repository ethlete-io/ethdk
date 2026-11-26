// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./prefer-element-dimensions');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const el = `const el = document.querySelector('.box');\n`;

tester.run('prefer-element-dimensions', rule, {
  valid: [
    { code: `${el}effect(() => { function read() { return el.scrollWidth; } });` },
    { code: `${el}effect(() => { const x = { read() { return el.clientHeight; } }; });` },
    {
      code: `import { effect } from 'some-other-lib';
${el}effect(() => { const w = el.offsetWidth; });`,
    },
    // Reading size outside reactive context — fine (one-shot snapshots are valid)
    { code: `${el}const w = el.offsetWidth;` },
    { code: `${el}const r = el.getBoundingClientRect();` },
    // Inside effect but using signal utility — fine (the utility returns the value)
    { code: `effect(() => { const d = this.dimensions(); });` },
    { code: `${el}effect(() => { el.addEventListener('resize', () => el.offsetWidth); });` },
    { code: `${el}effect(() => { untracked(() => el.getBoundingClientRect()); });` },
    { code: `${el}effect(() => { afterNextRender(() => el.clientHeight); });` },
    { code: `${el}effect(() => { setTimeout(function () { el.scrollHeight; }); });` },
    { code: `${el}effect(() => { const read = () => el.offsetWidth; });` },
    { code: `class A { layout = input(); width = computed(() => this.layout().scrollWidth); }` },
    { code: `computed(() => options.scrollHeight);` },
    { code: `const box = { offsetWidth: 1 }; computed(() => box.offsetWidth);` },
    { code: `computed(() => response.body.scrollHeight);` },
    { code: `computed(() => { for (const item of this.items()) item.offsetWidth; });` },
    { code: `computed(() => this.items().map((item) => item.offsetWidth));` },
  ],
  invalid: [
    {
      code: `${el}effect(() => { el.clientHeight; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}effect(() => { el.scrollHeight; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}effect(() => { el.offsetHeight; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}effect(() => { el.getClientRects(); });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}effect(() => { if (a) { for (;;) { el.scrollWidth; } } });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `import { effect as ngEffect } from '@angular/core';
${el}ngEffect(() => { const w = el.offsetWidth; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}effect(() => { const w = el.offsetWidth; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}effect(() => { items.forEach(() => el.offsetWidth); });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `${el}computed(() => el.getBoundingClientRect().width);`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `class A { elementRef = inject(ElementRef); w = computed(() => this.elementRef.nativeElement.offsetWidth); }`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `class A { ref = viewChild('box', { read: ElementRef }); w = computed(() => this.ref()?.nativeElement.clientWidth); }`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `class A { host = inject(ElementRef).nativeElement; w = computed(() => this.host.scrollWidth); }`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `class A { host = injectHostElement(); w = computed(() => this.host.getBoundingClientRect()); }`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `computed(() => { for (const child of this.scrollableChildren()) child.offsetWidth; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `computed(() => [...host.children].map((child) => child.offsetWidth));`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `computed(() => Array.from(document.querySelectorAll('.row')).map((row) => row.clientHeight));`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `computed(() => document.documentElement.clientHeight);`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `computed(() => document.querySelectorAll('.row')[0].offsetHeight);`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `const read = (box: HTMLDivElement) => computed(() => box.offsetWidth);`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `class A { box: HTMLElement | null = null; w = computed(() => this.box?.offsetWidth); }`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
  ],
});
