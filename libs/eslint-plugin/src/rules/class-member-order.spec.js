// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./class-member-order');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('class-member-order', rule, {
  valid: [
    {
      code: `class C {
  private service = inject(Service);
  size = input(0);
  selected = output();
  panel = contentChild.required('panel');
  private state = signal(false);
  label = computed(() => (this.state() ? 'on' : 'off'));

  constructor() {}

  focus() {
    return this.label;
  }

  private sync() {}
}`,
    },
    {
      code: `class C {
  label = this.buildLabel();

  buildLabel() {
    return 'ready';
  }
}`,
    },
    {
      code: `class C {
  warningBanner = computed(() => this.detectApiEnvironmentLabel());

  detectApiEnvironmentLabel() {
    return 'warning';
  }
}`,
    },
    {
      code: `class C {
  private service = inject(Service);
  size = model(0);
  panel = viewChild.required('panel');
}`,
    },
    {
      code: `class C {
  private state = signal(false);
  readonly ID = nextId++;
}`,
    },
  ],
  invalid: [
    {
      code: `class C {
  state = signal(false);
  private service = inject(Service);
}`,
      output: `class C {
  private service = inject(Service);
  state = signal(false);
}`,
      errors: [{ messageId: 'groupOrder' }],
    },
    {
      code: `class C {
  label = computed(() => 'ready');
  size = input(0);
}`,
      output: `class C {
  size = input(0);
  label = computed(() => 'ready');
}`,
      errors: [{ messageId: 'groupOrder' }],
    },
    {
      code: `class C {
  focus() {}
  constructor() {}
}`,
      output: `class C {
  constructor() {}
  focus() {}
}`,
      errors: [{ messageId: 'groupOrder' }],
    },
    {
      code: `class C {
  private calculate() {}

  // Focus remains with the moved method.
  handleFocusout() {}
}`,
      output: `class C {

  // Focus remains with the moved method.
  handleFocusout() {}
  private calculate() {}
}`,
      errors: [{ messageId: 'groupOrder' }],
    },
    {
      code: `class C {
  buildLabel() {
    return 'ready';
  }

  label = this.buildLabel();
}`,
      output: `class C {

  label = this.buildLabel();
  buildLabel() {
    return 'ready';
  }
}`,
      errors: [{ messageId: 'groupOrder' }],
    },
  ],
});
