# FIFA.GG: SDK-Findings aus der ngrx-toolkit-Migration

Stand: 2026-11-06. Consumer: `fifagg-frontend`, Branch `chore/ngrx-toolkit-to-query-v3` (auf `chore/query-v3-migration`, MR !1978).
Installiert: `@ethlete/query` 6.0.0-next.62. Generator: `@ethlete/query:migrate-from-ngrx-toolkit`.
Ergänzt [fifagg-sdk-findings-2026-11-06.md](fifagg-sdk-findings-2026-11-06.md). Code im SDK wurde nicht verändert.

Lauf: `--client=ggApiClientConfig --clientImport=@fifa-gg/queries --publicRoutes=/public --serviceApiBase=environment.apiBaseURL`.
Ergebnis: 44 von 49 Features umgestellt, 151 Creators geschrieben, 66 wiederverwendet, 225 Dateien gelöscht,
123 Consumer-Dateien verschoben, 98 Folgeaufgaben.

## 1. Der Generator hinterlässt einen nicht kompilierenden Stand (hoch)

Vor dem Lauf: 315 eindeutige `ngc`-Fehler (Baseline, Datei + Code + Meldung). Nach dem Lauf: 484. Neu durch den Generator: **217**.
Häufigste Codes der neuen Fehler: TS2345 (83), TS2344 (49), TS2339 (40), TS2739 (30), TS2684 (4).

Typisch: `MappedEntityState<QueryCreator<…>>` wird dort übergeben, wo der Consumer noch den alten Handle-Typ
erwartet (`NTK-UNCONVERTED-ACTION-GROUP`, 35 Aufgaben; `NTK-DUPLICATE-ROUTE-MISMATCH`, 26 Aufgaben), und
`withArgs()` ist Pflicht, weil die Route `pathParams` nutzt (TS2684).

Die Anleitung sagt, `NTK-UNCONVERTED-ACTION-GROUP` sei „resolved by re-running". Hier reichte ein erneuter Lauf nicht:
Die Typen mussten von Hand auf die Interop-Typen oder die v3-Creators umgestellt werden. Bitte prüfen, ob der Generator
solche Consumer-Typen selbst umschreiben kann, wenn die Action-Gruppe des Features nicht zur Toolkit-Gruppe zählt,
und sonst die Anleitung korrigieren.

## 2. `moduleResolution: node` findet `@ethlete/query/ngrx-toolkit` nicht (mittel)

Die Libs `env`, `queries` und `uikit-mocks` hatten `moduleResolution: node` in `tsconfig.lib.json`. Der neue Subpath-Export
löste dort nicht auf. Der Generator meldete das nicht. Der Consumer stellte die drei Libs auf `bundler` um.
Erwartung: Der Generator prüft das `moduleResolution` der betroffenen Projekte und meldet eine manuelle Aufgabe oder
ändert es. Die Anleitung nennt Schritt 4 („tsc over every affected project") nur allgemein.

## 3. `NTK-FACADE-ON` hat keinen Ersatz im Interop (mittel)

13 Aufgaben, 31 Typfehler allein im Team-Roster. Die Anleitung rät: auf `response$` / `error$` des Handles reagieren.
Für Listen, die nach einer Mutation neu laden, und für Erfolgsmeldungen baute der Consumer in zwei Libs je einen kleinen
Service (`RosterChangesService`, `TeamMembersChangesService`), der bei `callState$ === SUCCESS` eines Handles emittiert.
Die Form ist in beiden Fällen gleich. Bitte prüfen, ob das Interop dafür einen Helfer anbietet (zum Beispiel ein
`toolkitOnSuccess(handle)`), damit nicht jeder Consumer das nachbaut.

## 4. ET800 trifft Tests und schnelle Reloads (niedrig bis mittel)

Die v3-Laufzeit wirft ET800, wenn dieselbe Query mehr als 5-mal in Folge in weniger als 100 ms ausgeführt wird
(`ethlete-query.mjs:2376-2388`). v2 hatte keine solche Prüfung. Der Consumer-Test `rw-drops-collect-error`
(`apps/e2e/src/public/rewards/drops/drops.spec.ts`) löst 11 gefälschte Fehler direkt nacheinander aus. Jeder ruft `reload()`
auf, das `meQuery.execute({ skipCache: true })` ausführt. Die 7. Anfrage ging nie hinaus. Der Test schlug in 5 von 8
Einzelläufen fehl. Behoben im Consumer mit 150 ms Verzögerung je gefälschter Antwort.
Bitte prüfen: Gehört ET800 in die Migrationsanleitung als bekannter Unterschied zu v2? Ein Hinweis im Fehlertext auf
`skipCache`-Reloads wäre hilfreich.

## 5. Kleinere Beobachtungen

- Der Generator löschte den Service eines Features, der einen Header nur unter `isPlatformServer` setzte
  (`NTK-SERVICE-HEADERS`). Das war hier toter Code (keine SSR-App). Die Aufgabe nennt nur „headers", nicht die Bedingung.
- Für Features auf dem Toolkit nennt der Generator `NTK-STORE-FILE-KEPT` nur einmal, obwohl der Barrel-Export der
  Stage-Actions nach dem Lauf noch 60 Fehler auslöste. Ein Hinweis „Barrel exportiert gelöschte Gruppe" fehlt.
