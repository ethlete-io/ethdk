# M7 sync: the rules for several machines of one user

M7 merges the days of several machines of one user. The research of 2026-10-08
(`plans/timetrack/m7-sync-research.md`) put six decisions to the human, each with one recommendation. The human decided
all six on 2026-10-08 as recommended, plus mDNS discovery with pairing by a 6-digit code. ADR 0039 records event
identity and the merge.

1. Day owner: the machine you book from owns the day. The claim travels to the peers; the Tempo marker (description
   suffix + machine id) is the lock while a peer is offline.
2. Clock skew: measure the offset at each handshake. Under 2 min: merge. 2-10 min: correct and warn. Over 10 min:
   refuse and name the machine.
3. Stream key: one stream per checkout, keyed by the normalized `origin` URL, with a path alias per machine (dir name,
   manual alias as fallback). Rules match through the alias.
4. Merge mode: continuous pull with a cursor per origin. No freeze while a peer is behind for that day. A booked day
   that changes shows "changed after booking" and is not re-cut.
5. Peer needs: the same full app on every machine, credentials set up per machine; secrets never travel. The merge
   works with no Jira, Tempo or Google. Settings and stand-ins stay on the booking machine until slice 6.
6. Retention: raw events, filtered at the receiver at read time (its own exclusion rules and private links);
   transcripts never sent. Received events follow the 30-day retention by event time; spend stays with its origin.
7. Discovery: mDNS, and pairing by a 6-digit code.
