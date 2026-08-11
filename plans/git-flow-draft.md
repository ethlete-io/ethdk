Ansatz nach Git Flow

Feature-Workflow

1. Prerequisites

Wir haben als Team die Entwicklung eines Features beschlossen. Hierfür wird zunächst in Jira ein Ticket mit dem passenden Scope erstellt (Story).

2. Feature und Sub-Feature Entwicklung

Jetzt branchen wir vom aktuellen next ab und nennen den Branch nach folgendem Schema: feat/[Ticket-Nummer der Story]-[Story-Subject] z.B. feat/FIP-2177-user-management. Das Story-Subject wird in der Jira-Story als Meta-Feld (hier z.b. user-management) angelegt.
--> Haupt-Feature-Branch für dieses Feature bzw. Branch, der in den next-Branch gemerged wird.

Kleinere Einheiten (Sub-Feature) werden nach Fertigstellung sukzessive in diesen Branch überführt (merged). Der Sub-Feature-Workflow sieht dafür wie folgt aus:

Es wird vom Haupt-Feature-Branch ein neuer Sub-Feature-Branch nach folgendem Schema abgespalten: sub/feat/[Ticket-Nummer der Story]-[Story-Subject]/[Ticket-Nummer der Task]-[Task-Subject], z.B. sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset.

Warum das sub/-Präfix: Git kann eine Referenz nicht gleichzeitig als Branch und als Verzeichnis von Branches führen. Solange feat/FIP-2177-user-management existiert, lässt sich feat/FIP-2177-user-management/FIP-2178-user-password-reset also gar nicht anlegen — git branch bricht mit "cannot lock ref" ab, ein Push wird mit "refname conflict" abgelehnt. Genau der Branch, von dem abgespalten und in den zurückgemerged wird, blockiert den verschachtelten Namen. Das sub/-Präfix hebt den Sub-Branch aus dem Namensraum des Eltern-Branches heraus. Der vollständige Pfad des Eltern-Branches bleibt dabei im Namen enthalten, sodass Basis- und Target-Branch weiterhin direkt am Namen ablesbar sind und kein Branch umbenannt werden muss, der heute schon existiert.

Das Sub-Feature wird lokal entwickelt.

Nach Fertigstellung wird das Sub-Feature per Merge-Request zurück in den zugehörigen Haupt-Feature-Branch gemerged, z.B. Source-Branch sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset → Target-Branch feat/FIP-2177-user-management
Wichtig:
--> Der MR muss von einem anderen nexter reviewed werden (sofern vorhanden).
--> Der Sub-Feature-Branch wird nach dem Merge gelöscht (via Checkbox im MR, ansonsten manuell)

Sind alle Sub-Features, die für dieses Release vorgesehen sind, entwickelt und zusammengeführt auf dem Haupt-Feature Branch feat/FIP-2177-user-management, wird der Haupt-Feature-Branch auf eine dedizierte Testumgebung deployed (Front- und Backendstand des jeweiligen Features) und dort vom PM getestet (Pique Umgebung). Ist der Test erfolgreich abgeschlossen und wurden ggfls. Nacharbeiten eingepflegt, kann der PM das Haupt-Feature zur Kundenabnahme / Staging-Rollout einplanen.
Wichtig:
--> Nacharbeiten oder Bugfixes zum Feature erfolgen über eigene Fix- oder Sub-Feature-Branches und werden per Merge-Request in den Haupt-Feature-Branch zurückgeführt.
--> Der Ersteller des Haupt-Feature-Branches ist dafür verantwortlich, den Branch aktuell zu halten. Geteilte Haupt-Feature-Branches werden nicht rebased, sondern bei Bedarf per Merge mit next synchronisiert. Rebase ist nur für lokale, noch nicht veröffentlichte Branches erlaubt. I.d.R wird er dies nur nach einem Rollout tun müssen, wenn das Feature zurückgehalten wurde. Trotzdem sollte er periodisch prüfen, ob der Branch aktuell ist. Bei größeren Teams, z.B. dem Frontend-Team sollte das täglich sein.

3. Staging- und Prod-Releases

Sobald alle für ein Release vorgesehenen Features fertig entwickelt, intern getestet und freigegeben sind, werden sie an einem gemeinsam festgelegten Feature-Freeze-Tag in den next-Branch gemerged.

Direkt im Anschluss wird auf Basis dieses next-Stands ein release-Branch nach folgendem Schema erstellt: release/[Datum_YYYY.MM.DD], z.B. release/2026.04.28.

Das Datum im Branch-Namen entspricht dem Feature-Freeze-Datum, also dem Tag, an dem die für das Release vorgesehenen Features in `next` zusammengeführt und der Release-Branch erstellt wurden. Der release-Branch dient anschließend als Release-Kandidat und Grundlage für das Staging-Deployment.
--> Ab hier dürfen wir in den release-Branch nur noch relevante Fixes via MR mergen.
--> Die Haupt-Feature-Branches werden nach dem Merge in next gelöscht (via Checkbox im MR, ansonsten manuell).

TODO: Daniel muss mögliche Machbarkeit für Rollout Strategien auf Basis der weiter unten genannten möglichen Optionen evaluieren.
Nach jedem erfolgreich gemergten Haupt-Feature wird der aktuelle Stand des next-Branches automatisch über Pique auf die jeweilige next-URL aller Projekte deployed, sofern die Merge-Pipeline erfolgreich durchlaufen wurde.

Dadurch kann der PM das Zusammenspiel der integrierten Features und somit den aktuellen Release-Stand testen.

Die Release-Version spiegelt den programmcodebasierten Stand des Staging-Servers wieder.

Werden auf dem Release-Branch vor der Veröffentlichung trotzdem noch Fehler gefunden, so werden Fixes für die Fehler via MR in den release-Branch gemerged. Der Fix-Branch wird nach folgendem Schema benannt: sub/release/[Datum]/[Bug-Ticket-Nummer]-[Bug-Subject] z.B. sub/release/2026.04.28/FIP-2222-button-not-visible — dasselbe sub/-Präfix wie beim Sub-Feature und aus demselben Grund (siehe Punkt 2.), da release/2026.04.28 als Branch existiert und den verschachtelten Namen sonst blockiert. Target-Branch des MR ist release/2026.04.28.

--> Der Fix-Branch wird nach dem Merge gelöscht (via Checkbox im MR, ansonsten manuell) und gesquashed?

wenn Ready dann merge in next und main → (main bekommt Version-Tag)

Hotfixes werden direkt auf main-Branch im Branch hotfix/[Ticket-Nummer]-[Subject]

Merge der Änderungen in next-Branch und main → (main bekommt Version-Tag + “.1” inkrementiert)

Release

4. Hotfixes

Sind schnelle Fixes in Produktion notwendig, so werden diese über einen Hotfix-Branch auf Production via MR in den main gebracht. Hotfix Branches werden nach folgendem Schema benannt: hotfix/[BUG-Ticket-Number]-[subject], z.B. hotfix/FIP-2799-password-recovery-broken.
Nachdem Rollout wird der main-Branch via MR in den next-Branch gemerged, damit diese wieder auf dem gleichen Stand sind.

Mögliche Umsetzungen für die CI siehe

@Daniel Neuendorf

Nächsten Schritte:

Jira: Releases für das Bündeln von Tasks / Stories nutzen [WIP] @Florian Scheske

Jira: User-Stories zukünftig in der Beschreibung über der Auflistung der Akzeptanzkritierien @Florian Scheske

Jira: Title von Stories- und Hotfix-Tickets sollten deckungsgleich mit den Branches auf Englisch benannt werden (siehe Punkt 2.) @Florian Scheske

Gitlab: main und next protecten. Direkter push auf diese Branches sollte nur für wenigste Ausnahmen möglich sein (z.B. ausschließlich Felix B.) @Tom-Rune Bornholdt

Git / Gitlab: Neue MRs / Branches (Stand 29.5.26) sollen zukünftig mit Tickettitel erstellt werden @Daniel Neuendorf @Elias Papavlassopoulos @Tom-Rune Bornholdt @Florian Börner

Gitlab CI: Gezielte Rollout-Strategie evaluieren durch @Daniel Neuendorf
