export type FieldErrorSpec = string | { kind: string; message?: string };

export type FieldSpec = { value: unknown; errors?: FieldErrorSpec[]; touched?: boolean };

type SignalForms = {
  form: (model: unknown, schema: (path: Record<string, unknown>) => void) => Record<string, () => FieldStateLike>;
  validate: (path: unknown, logic: () => { kind: string; message?: string }[]) => void;
};

type FieldStateLike = { markAsTouched: () => void };

const toError = (error: FieldErrorSpec) => (typeof error === 'string' ? { kind: error } : error);

/**
 * A signal form tree with one field per entry of `specs`, each holding its value, its fixed
 * errors and its touched state. Must run in an injection context.
 */
export const buildFields = (options: {
  specs: Record<string, FieldSpec>;
  forms: SignalForms;
  signal: <T>(value: T) => unknown;
}) => {
  const { specs, forms, signal } = options;
  const entries = Object.entries(specs);
  const model = signal(Object.fromEntries(entries.map(([name, spec]) => [name, spec.value])));
  const tree = forms.form(model, (path) => {
    for (const [name, spec] of entries) {
      const errors = (spec.errors ?? []).map(toError);

      if (errors.length > 0) forms.validate(path[name], () => errors);
    }
  });

  // A field tree is a proxy whose every property is a child field, so `field?.()` breaks once it
  // is compiled down to `field.call(...)`.
  for (const [name, spec] of entries) {
    const field = tree[name];

    if (spec.touched && field) field().markAsTouched();
  }

  return tree;
};
