# FIFA.GG: SDK-Findings nach dem Release-Update

Stand: 2026-11-06, ca. 10:48 CET. Consumer: `fifagg-frontend`, Branch `chore/query-v3-migration`.
Update durch `yarn et update` in der vorherigen Session. Dieses Dokument ist eine Übergabe für SDK-Fixes;
Code und Tests wurden hier nicht verändert.

Installierte Versionen: `@ethlete/query` **6.0.0-next.62**, `@ethlete/core` **5.0.0-next.73**,
`@ethlete/query-devtools` **1.0.0-next.17**, `@ethlete/cdk` **5.0.0-next.48**;
CLI-Manifest: `@ethlete/cli: ^3.0.0-next.27`.

Bestehende SDK-Triage: [et-update-findings.md](et-update-findings.md), insbesondere Abschnitt 10.
Dessen Nummern sind unten ausdrücklich als „SDK #…“ bezeichnet. Die Nummern im persönlichen
Consumer-Handoff sind teilweise anders. Historische Meldungen sind keine erneute Bestätigung auf next.62.

## 1. Offen: Legacy `state$` emittiert beim Refresh weiterhin den alten Success

**Priorität: hoch. SDK #16 erneut öffnen; auf dem installierten next.62 beobachtet.**

Der Changelog von next.62 verspricht, dass ein Subscriber direkt nach `execute()` zuerst Loading und
keinen alten Success erhält. Die Consumer-Session hat genau diese Zusicherung getestet. Der Test schlug fehl:

```text
legacy queries on the released SDK
  waits for the new response when subscribed immediately after a refresh

Expected: ["LOADING"]
Received: ["LOADING", "SUCCESS"]
```

### Reproduktion

Testumgebung: `setupQueryTest()` aus `@ethlete/query/testing`, Angular `fakeAsync`, `TestBed.tick()`.

1. GET-Legacy-Creator mit `createLegacyQueryCreator` vorbereiten. Der Consumer verwendet den dünnen
   Wrapper `createSilentLegacyQueryCreator`, der nur `creator.clone({ reportErrors: false })` ergänzt.
2. Einen Subscriber auf `query.state$` während des gesamten Ablaufs aktiv lassen (`keepAlive`).
3. `query.execute()`, `TestBed.tick()`, erste HTTP-Antwort `{ id: 'a', name: 'Before' }` flushen,
   `tick()` und `TestBed.tick()` ausführen.
4. `query.execute({ skipCache: true })` aufrufen.
5. Sofort einen zweiten Subscriber auf `query.state$` anmelden, ohne die zweite HTTP-Antwort zu flushen.
6. Erwartet: Loading, noch kein Success. Beobachtet: synchron Loading und anschließend Success.
7. Erst eine zweite HTTP-Antwort `{ id: 'a', name: 'After' }` darf den neuen Success liefern.

**Auswirkung:** `filterSuccess(), take(1)` kann beim Refresh die alten Benutzerrollen übernehmen.
Betroffen: `libs/core/src/lib/auth/user-state.ts`, Funktion `refreshUserSuccessfully`, verwendet u. a.
beim Erstellen eines Teams mit Organisation.

**Aktueller Workaround:** Nach `filterSuccess()` zusätzlich den synchronen Raw-State prüfen:

```typescript
filter(() => !isQueryStateLoading(query()?.rawState));
```

Der entsprechende Regressionstest in
`fifagg-frontend/libs/queries/src/lib/legacy-query-creator.spec.ts` ist inzwischen mit diesem Filter grün.
**Das bestätigt den Workaround, nicht den SDK-Fix.** Für eine SDK-Reproduktion den Filter weglassen.

**Fix-Auftrag:** Szenario ohne Filter auf dem veröffentlichten Paket reproduzieren, besonders mit bereits
aktivem Subscriber. `state$`-Initialemission und nachfolgende Observable-Emissionen gegen den aktuellen
Execution-State abgleichen. Die frühere Diagnose in SDK #16 (`shareReplay`, Fix `3ade7f27f`) allein hat
diesen Consumer-Ablauf offenbar nicht abgedeckt; die konkrete neue Ursache ist noch nicht verifiziert.
Akzeptanz: Bis zur zweiten HTTP-Antwort erreicht kein alter Success einen Subscriber, auch nicht bei
bestehendem `keepAlive`. Als Vergleich auf nativem v2 und Legacy-Interop ausführen.

## 2. Auf next.62 erfolgreich geprüft: Entity-Store vor Success

**SDK #18, einschließlich der `destroyOnResponse`-Reihenfolge.**

Consumer-Regressionstest: `writes the entity before onSuccess with destroyOnResponse=%s`, jeweils
mit `false` und `true`. Beide Varianten sind grün: `onSuccess` erhält die Antwort und der EntityStore
enthält sie anschließend. Der frühere Store-Synchronisierungs-Workaround wurde aus
`libs/queries/src/lib/legacy-query-creator.ts` entfernt.

Damit ist der geprüfte Ablauf bestätigt. Weitere historische Broadcast-/Collection-E2E-Meldungen sind
nicht allein aufgrund dieses Unit-Tests geschlossen.

## 3. Absichtlich beibehalten: `reportErrors: false`

**SDK #15; beschlossene Migrationseinstellung, kein erneut offener Runtime-Defekt.**

v3 meldet Request-Fehler standardmäßig an Angulars `ErrorHandler`. Erwartbare 401/404/422 können dadurch
Consumer-E2E-Checks auf Konsolenfehler auslösen. Laut bestehender Entscheidung schreibt der Migrator
`reportErrors: false` ausdrücklich in migrierte Creator; der Legacy-Default selbst bleibt bestehen.

Der Consumer bündelt das weiterhin in `createSilentLegacyQueryCreator`.
Der Test `delivers request errors to the consumer without reporting them to ErrorHandler` ist grün:
422 erscheint als Failure im Query-State und wird nicht an `ErrorHandler` weitergereicht.
Diesen Wrapper erst entfernen, wenn alle betroffenen Creator die gewünschte Konfiguration selbst tragen.

## 4. Devtools bei Browser-Automation: Release-Verhalten noch per E2E prüfen

**SDK #20.** Der Release verspricht, Panel, Toggle und Pills unter `navigator.webdriver` auszublenden;
`showInAutomation: true` soll dies explizit überschreiben. Im installierten Panel ist der Contract
`isQueryDevtoolsHiddenInAutomation` eingebunden. Die Consumer-Session hat den zusätzlichen
`!navigator.webdriver`-Guard in den App-Komponenten entfernt.

Das Vorhandensein des Contracts ist kein Browser-Nachweis. Akzeptanz: Unter Playwright blockiert
`#et-query-devtools-pill` keine Save-/Submit-Schaltflächen; mit `showInAutomation: true` bleibt die UI testbar.
Der dynamische Import hinter `ngDevMode` bleibt zur Produktions-Bundle-Optimierung bestehen.

## 5. Historische Migrator-Findings: Release vorhanden, Consumer-Replay nicht erneut verifiziert

Die folgenden Befunde stammen überwiegend aus next.61. Viele Fixes werden im next.62-Changelog genannt.
Für einen Regressionstest einen unveränderten Stand vor der Migration verwenden; der heutige Consumer
enthält bereits Handkorrekturen und eignet sich nicht als Beweis, dass der Migrator diese Stellen korrekt löst.

| Befund                                                                                          | Erwartung an den Migrator / Verifikation                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth-Scaffold nutzt undefinierte Namen (`postRefreshToken`, `AUTH_COOKIE_DOMAIN`)               | Benötigte Imports erzeugen; lokale Deklarationen ausdrücklich als manuelle Aufgabe melden.                                                                                 |
| `extractTokens` liefert `{ token, refreshToken }`; `buildArgs` behandelt String als Tokenobjekt | Auf `{ accessToken, refreshToken }` abbilden und erzeugtes Scaffold kompilieren.                                                                                           |
| Fehlendes `defaultRememberMe: true`                                                             | Persistenz der vorherigen v2-Cookie-Konfiguration erhalten.                                                                                                                |
| Gemeinsames Cookie auf Geschwister-Hosts                                                        | Per-Origin-Verschlüsselung von `withPersistentAuth` ist eine Verhaltensänderung; nicht still als gleichwertig migrieren.                                                   |
| Alte Auth-Hooks und Authorization-Interceptor bleiben zurück                                    | Jede verbleibende Stelle mit Datei/Zeile melden; doppelte Bearer-Header verhindern.                                                                                        |
| v2-`retryFn` wird unverändert übernommen                                                        | Portieren oder konkrete manuelle Aufgabe statt inkompatibler Konfiguration.                                                                                                |
| GraphQL-Creator nicht vollständig migriert                                                      | `gqlQuery` erkennen; bei `request.gql.transferVia: 'GET'` passenden GET-Creator nennen.                                                                                    |
| `withEthleteApiErrors()` auf Contentful                                                         | Nicht für fremde APIs hinzufügen.                                                                                                                                          |
| SDK #10: Union `AnyV2Query \| AnyLegacyQuery` kollabiert                                        | Keine doppelten Imports oder Typverengung erzeugen.                                                                                                                        |
| SDK #11: Creator als Objektwert / gleiche Namen in mehreren Projekten                           | Alle Wertreferenzen auf den richtigen Legacy-Wrapper umschreiben, nach Deklaration statt nur Name auflösen.                                                                |
| SDK #13: Devtools statisch im Produktionsbundle                                                 | Lazy-/Provider-Mount erzeugen; Produktionsbundle anhand Build-Metadaten prüfen.                                                                                            |
| SDK #14/#17: Legacy-Aufruf außerhalb Injection-Context                                          | Auch `createSignal`, `createSubject`, `behaviorSubject`, Callbacks und Property-Receiver abdecken oder konkrete Injector-Aufgabe melden.                                   |
| SDK #19: Neue Wrapper bei gleichen Prepare-Argumenten                                           | Identität innerhalb desselben Injector-Scope wiederverwenden; NG0103-Loop vermeiden.                                                                                       |
| SDK #21: Falsches `destroyOnResponse`                                                           | Nur nachweislich einmalige Queries zerstören; gespeicherte, zurückgegebene oder erneut ausgeführte Queries erhalten. Consumer musste 36 Stellen in 23 Dateien korrigieren. |
| SDK #25: Injector-Feld trennt `eslint-disable-next-line` vom Member                             | Vor den führenden Kommentaren einfügen; Lint auf dem generierten Ergebnis ausführen.                                                                                       |

Korrektur zur historischen Bundle-Diagnose: Laut SDK-Triage war das eager importierte Panel die
wesentliche Ursache. Die Behauptung, der Lazy-Einstieg helfe grundsätzlich nicht, war nicht gemessen
und wurde später korrigiert. Den Barrel-Import allein nicht als Hauptursache weitergeben.

## 6. Abgrenzung: kein offener SDK-Auftrag

- **SDK #26 / Consumer-Handoff #14, Loader nach 401:** Die SDK-Reproduktion endet mit Error 401 und
  ohne Loading. Der Consumer wertet nur Response/Loading aus und behandelt eine leere Response als
  ewiges Laden. `queryStateErrorSignal` auswerten und Fehlerzustand darstellen. Keine bestätigte
  SDK-Endlosschleife bei identischem Refresh-Token.
- **SDK #22, ET800-Pollingloop:** Timer/Refresh-Schleife im Consumer, auf dem Branch korrigiert.
- **SDK #12, PATCH-Query in POST-Signal:** Consumer-Typfehler, durch strengere Typen sichtbar geworden.
- **Swiss-Seeding:** Test wartete nur auf Match-Anzahl statt vollständig besetzte Paarungen; die andere
  Consumer-Session hat den Wait angepasst. Kein bestätigter SDK-Defekt.
- **V2BearerAuthProvider-Cookie-Domain:** next.62 nennt den Parent-Domain-Fix. Der Consumer verwendet
  nach der v3-Migration eigenes Shared-Cookie-Handling. Dessen Entfernung folgt nicht automatisch aus
  dem V2-Fix; getrennte Hosts und die Persistenzsemantik müssen berücksichtigt werden.
- **SDK #27, asynchrone Cancelled-/Loading-Reihenfolge, Fokus-Refetch und Blur-Polling:** Laut vorhandener
  Entscheidung akzeptierte Interop-Unterschiede. Nicht erneut als ungeklärte Paritätsfehler aufmachen.

## Belege und Session-Stand

- SDK-Triage: [et-update-findings.md](et-update-findings.md), Abschnitt 10.
- Historischer Consumer-Handoff: `fifagg-frontend/.claude/handoffs/query-v3/findings.md`
  (gitignoriert, daher hier nicht als dauerhafte Übergabe vorausgesetzt).
- Regressionstests: `fifagg-frontend/libs/queries/src/lib/legacy-query-creator.spec.ts`.
- Letztes geprüftes Check-Log: `/tmp/query-sdk-checks.log`; Lint und Tests für Core und Queries erfolgreich,
  Queries: 2 Suites / 21 Tests grün. Temporäre Logs sind keine dauerhaften Artefakte.
- `/tmp/query-sdk-build-remaining.log`: vier App-Builds erfolgreich; Public war laut Session vorher erfolgreich.
  Der vollständige E2E-Stand ist dadurch nicht bestätigt.
- Vorherige Consumer-Session: `01a1b038-7be3-7bb3-813c-d6b53146c781`. Ihr Protokoll enthält nach dem
  Server-Neustart neue Tool-Ergebnisse bis mindestens **10:47:17 CET am 2026-11-06**. Sie wurde also
  tatsächlich fortgesetzt. Diese Übergabe-Session startet deshalb keine zweite Migration oder E2E-Serie.
