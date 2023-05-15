# Select

## Inputs

- `placeholder`?: string
- `multiple`?: boolean = false

```html
<et-select placeholder="Select something" multiple="false">
  <et-select-option value="1">1</et-select-option>
  <et-select-option value="2" disabled>2</et-select-option>
  <et-select-option value="3">3</et-select-option>
</et-select>
```

# ComboBox

## Inputs

- `placeholder`?: string
- `multiple`?: boolean = false

```html
<et-combobox placeholder="Combobox something" multiple="false">
  <et-combobox-option value="1">1</et-combobox-option>
  <et-combobox-option value="2" disabled>2</et-combobox-option>
  <et-combobox-option value="3">3</et-combobox-option>
</et-combobox>
```

# Tree Select

## Inputs

- `placeholder`?: string
- `multiple`?: boolean = false

```ts
const options = [
  {
    label: '1',
    value: '1',
    children: [
      {
        label: '1.1',
        value: '1.1',
        children: [
          {
            label: '1.1.1',
            value: '1.1.1',
          },
          {
            label: '1.1.2',
            value: '1.1.2',
          },
        ],
      },
      {
        label: '1.2',
        value: '1.2',
        disabled: true,
      },
    ],
  },
];
```

```html
<et-tree-select placeholder="Tree Select something" multiple="false">
  <et-tree-select-option *ngFor="let option of options" [option]="option" />
</et-tree-select>
```
