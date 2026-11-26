# `queryField<T>()` is typed by its default and reads the URL into that type

`queryField<T>()` used to be typed `T | null` whatever its default, and guessed the type of a URL
value: `?id=123` became the number `123` even in a `queryField<string>()`. Now:

- A field with a non-null `defaultValue` is typed `T`, and a reset or an unreadable URL value falls
  back to the default.
- A URL value is read into the type of the default (number, boolean, string, string list). Without a
  default it stays a string.
- Any other `T` needs a `queryParamToValue`: `queryField<number>()` without a default, a `Date` or an
  object default.
- `searchQueryField()` and `sortQueryField()` no longer count in `activeFilterCount`, whatever their key.

The type check finds every call site that has to change.

## Find the call sites

```bash
grep -rnE '\bqueryField<' apps libs --include='*.ts'
```

## What to change

1. `queryField<number>()` or `queryField<boolean>()` without a default: give it the `defaultValue` it
   effectively had, or add `queryParamToValue: transformToNumber` (`transformToBoolean`, …) and keep
   the `null` start. Both transforms are exported from `@ethlete/query`.
2. A `Date` or object default without a `queryParamToValue`: add one (`transformToDate` for a date).
3. A field that must hold `null` beside a non-null default - an explicit "none" - is declared
   `queryField<T | null>({ defaultValue: … })`.
4. Delete the `?? DEFAULT` on reads of a field that now has a non-null type, and any `!` or cast that
   only existed to strip `null`.
5. A field bound to a native `<input type="number">` is declared `number | null`: the input writes
   `null` when cleared.
6. A field that relied on the old guess - a `queryField<string>()` read as a number somewhere - gets
   the type it was really used as.
7. A UI that counted a search or sort field as a filter: pass `skipInFilterCount: false` to keep it.

## When you are done

Run the type check, the lint task and the tests of every project you changed, and check in the
browser that a reload restores each list.

The query forms guide is at <https://ethlete-sdk-docs.web.app/query/query-forms>.
