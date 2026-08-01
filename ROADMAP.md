# Roadmap

Eleven approved additions, four declined, decided 2026-08-01. Numerals match the review
document they were approved from.

## Approved

Ordered by what unblocks what, not by the order they were proposed.

| # | Item | Effort | Notes |
|---|---|---|---|
| V | Translate the capital cities | M | Closes a gap the six-language release introduced. Also unblocks I. |
| I | Type a country name to guess it | M | **Capital and Flag modes only** — see below. |
| VI | Miles as well as kilometres | S | Settings toggle. Reverses a stated v1 non-goal, deliberately. |
| VII | Practice by region | S | A filter over `region`/`subregion`, already in the roster. Daily stays global. |
| IV | Guess distribution in your record | S | Needs a per-round count kept in Dexie; starts empty unless backfilled. |
| II | An archive of past dailies | S | Every past day is already derivable from its date. |
| IX | Hard mode | S | Rings only. Must still expose the numeric distance — see below. |
| III | A guided first round | M | Skippable in one tap, never shown twice. |
| XI | More on the reveal | S | Neighbours need a border-adjacency table derived from the topology. |
| VIII | Where you struggle | M | Needs enough rounds to say anything honest. |
| X | Share the plate, not the text | M | Must abstract the guess trail, not draw the real geometry. |

### I — search is per-mode, and that is the point

The approval carried an amendment worth recording, because building it the obvious way
would break the game: **search belongs in Capital and Flag modes only.**

In Country mode the clue *is* the country's name. A search field there lets the player
type the answer verbatim, and the round becomes a copying exercise. In Capital and Flag
mode the clue is a city or an image, so typing a country name is a genuine act of
knowledge and the field is purely an input convenience.

It also has to match on the *localised* names, accent-insensitively, or half the roster
is unreachable in French, Spanish and Portuguese.

### IX — hard mode cannot remove the numeric distance

Dropping the compass arrow is the whole idea, but the distance readout is the app's
non-colour proximity signal (PRD §4). Removing both would leave colour as the only
channel, which the design has refused everywhere else. Hard mode therefore hides the
arrow and keeps the number — worth confirming that still feels hard enough before
building it.

## Declined

Recorded so the decision does not have to be made twice.

| # | Item | Why not |
|---|---|---|
| XII | Streak insurance | Makes the streak mean nothing, and the streak is the only stake the game has. |
| XIII | Daily reminder notification | Real push needs a server and a subscription store, breaking the zero-cost constraint. Local alternatives do not fire when the app is closed, which is the only time it matters. |
| XIV | Accounts and cross-device sync | Introduces a backend, a privacy policy, account recovery and a recurring bill. An export/import code is nine tenths of the value at a hundredth of the cost. |
| XV | Head-to-head play | Already a stated v1 non-goal. The shared daily gives the social hook without realtime infrastructure. |
