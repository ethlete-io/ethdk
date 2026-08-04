---
'@ethlete/components': minor
---

Narrow the query devtools' Queries list by endpoint and live state: a filter box
matching a query's method, resolved route, request URL and client name (all
whitespace-separated terms have to hit), plus **Failing** / **Loading** / **Stale**
chips that carry their match count and widen the result when combined. The count
reads `12 of 87` while narrowed and the Insomnia download follows the filters. Every
tab now also carries how many entries it holds and a red badge with how many of them
are failing, so a failing query is visible from a tab that is not open.
