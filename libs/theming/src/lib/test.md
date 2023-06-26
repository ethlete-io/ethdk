1. Provide themes

```ts

const THEME_BLUE = 'blue';

provideThemes([
    {
        name: THEME_BLUE,
        isDefault: true,
        color: {
            default: '#0000ff',
            hover: '#0000ee',
            active: '#0000dd'
            disabled: '#0000cc'
        },
        onColor: {
            default: '#ffffff',
            hover: '#eeeeee',
            active: '#dddddd'
            disabled: '#cccccc'
        }
    }
    // ...
])
```

2. Use theme

```html
<div etProvideTheme="blue">
  <button etThemed>
    <span etOnThemed>Button</span>
  </button>
</div>
```
