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

- `items`?: unknown[] = []
- `initialValue`?: unknown | unknown[] = null // Must be set if the formControl already has a value (e.g. from a server response)
- `loading`?: boolean = false
- `error`?: unknown = null
- `placeholder`?: string
- `multiple`?: boolean = false
- `bindLabel`?: string // Only works if items are objects
- `bindValue`?: string // Only works if items are objects
- `allowCustom`?: boolean = false // Only works if items are strings

## Outputs

- `filterChange`?: EventEmitter<string>

```html
<et-combobox
  [items]="[]"
  [initialValue]="[]"
  [loading]="true"
  [error]="null"
  (filterChange)="loadOtherData($event)"
  placeholder="Combobox something"
  multiple="false"
  bindLabel="name"
  bindValue="id"
  allowCustom="false"
/>

<et-combobox
  [items]="[]"
  [initialValue]="[]"
  [loading]="true"
  [error]="null"
  (filterChange)="loadOtherData($event)"
  placeholder="Combobox something"
  multiple="false"
  bindLabel="name"
  bindValue="id"
  allowCustom="false"
>
  <ng-template etComboboxOption let-item="item" let-checked="checked">
    <span> {{ item.name }} ({{ item.rating }}) </span> <i *ngIf="checked" class="fas fa-check"></i>
  </ng-template>
  <ng-template etComboboxValue let-item="item"> <span> {{ item.name }} ({{ item.rating }}) </span> </ng-template>
  <ng-template etComboboxLoading> <span> Loading it </span> </ng-template>
  <ng-template etComboboxError> <span> Ops, something went wrong </span> </ng-template>
  <ng-template etComboboxEmpty> <span> Empty, change filter... </span> </ng-template>
</et-combobox>
```

Notes

- Needs to keep track of selected options internally, because the options might be a filtered server response
- Could use something like `[etQueryUiController]="query"` to handle inputs for items, loading and error

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
