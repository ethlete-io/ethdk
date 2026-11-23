---
status: accepted
built: 835a0f96d
decided: 2026-11-23
source: doc-agent session 2026-11-23 (late morning), B678, tomflix clean-slate run
---

# The agent opens its checkout in Studio after asking

In the tomflix clean-slate run the human had to open the new checkout in Studio by hand ("Projekt öffnen…", pick the
folder) and got "In diesem Ordner liegt keine Design-Arbeit." on the wrong folder. The human (German, verbatim): "in ein
neues repo kommen ist nicht optimal. vielleicht kann das ja eine cli funktion werden sodass der agent nach nachfrage
automatisch dahin swappen kann".

1. **Ask, then add and switch** (recommendation accepted: "q1ok"): a design CLI command lets the agent add its checkout to
   Studio's list and switch Studio to it. The agent asks the human first. The other checkouts stay in the list.
2. **No Studio start by the agent.** The human on starting Studio when it is not running: "naja bald wandert der chat ja
   auch in studio. dass man aktuell die claude cli u.ä. nutzen muss ist eher eine krücke." Until the chat lives in
   Studio, the agent tells the human to open Studio and then switches.
