# Move picker is filtered to each species' own learnset, via @pkmn/dex

The move picker (`MoveSlot`'s `MoveCombobox`) used to offer every move in the app's generation
regardless of the slot's own species — no way to tell "this species can actually learn this move"
from "no Pokémon can". It's now filtered to what the slot's species can currently learn
(`calc/learnsets.ts`'s `movesOf`), backed by `@pkmn/dex`'s own bundled learnset data — a new
dependency, since neither `@smogon/calc` (vendored or not) nor the already-installed `@pkmn/sets`
carry any learnset data at all.

## How it works

- `Dex.forGen(GEN_NUM).learnsets.get(name)` (async — the ~475KB learnset JSON is loaded lazily on
  first call, not a network fetch, unlike `abilities.ts`'s PokeAPI-backed `abilitiesOf`) returns a
  `.learnset` map of move ID to `MoveSource[]`, e.g. `thunderbolt: ["9M", "9L36", "8M", ...]` — one
  entry per generation/method the move has ever been obtainable through.
- A move counts as learnable "now" when at least one of its sources is tagged for the current
  generation (starts with `"9"`) — the same convention Pokémon Showdown's own team builder uses.
- Falls back to the species' entire historical movepool (no generation filter at all) when its
  learnset exists but has zero gen-9-tagged sources anywhere in it. Verified by hand against
  Regulation M-C's actual roster: ~40% of it (Absol, Aerodactyl, Aggron, ... — mostly species
  Scarlet/Violet's Indigo Disk DLC added back via HOME transfer) hits this, because `@pkmn/dex`'s
  bundled data hasn't been updated with current-gen tags for them yet. An empty picker for that
  much of the roster would be a worse failure than occasionally offering a move that generation
  can no longer actually re-teach.
- A battle-only/stance forme with no learnset entry of its own (Mega Evolutions,
  Aegislash's Shield/Blade stances, Terapagos-Stellar, ...) falls back to its `baseSpecies`'s
  moveset instead — `@pkmn/dex`'s data simply doesn't duplicate an entry per forme when the
  movepool doesn't actually change with it. Aegislash needs an explicit override
  (`LEARNSET_NAME_OVERRIDES`) since `@smogon/calc`'s own species data has no plain, unprefixed
  "Aegislash" for that `baseSpecies` fallback to chase (same data quirk `abilities.ts`'s
  `SLUG_OVERRIDES` already works around for PokeAPI) — every other species resolves cleanly
  through its own name or `baseSpecies`.
- Champions itself has no learnset data of its own for `@pkmn/dex` to have picked up (too recent a
  game) — Scarlet/Violet's is used as the practical proxy, the same one `championsGen` itself
  falls back to elsewhere for move data it has no Champions-specific patch for (`moves.ts`'s
  `effectiveBasePower`).

## Considered options

- PokeAPI, the same source `abilities.ts` already uses for a species' full ability list: it does
  carry per-species move lists (`/pokemon/{slug}`'s `moves`), but keyed by _game version group_,
  and PokeAPI has no version group for Pokémon Champions (too recent) — would still need a network
  fetch per species (cold on every first pick, unlike `@pkmn/dex`'s bundled data) for a dataset no
  more current than `@pkmn/dex`'s own.
- Hand-curating a per-species move list: no existing source to seed it from, and would need manual
  upkeep every time Champions' roster grows — the same trade `generation.ts`'s
  `championsGen`-over-hand-typed-table already argues against for base power.

## Consequences

- A new runtime dependency, `@pkmn/dex` (`@pkmn/sets` was already one; `@pkmn/dex` was previously
  deliberately left out of PokePaste import specifically, since nothing there needed to resolve
  display names to IDs — a learnset is a genuinely new need none of this app's existing
  dependencies carry).
- The gen-9-tag fallback means the movepool a species' picker shows isn't perfectly precise for the
  ~40% of the roster `@pkmn/dex`'s data lags on — it can include a move that generation can't
  currently re-teach. Accepted deliberately (an empty picker is the worse failure mode), on the
  expectation that the reader spot-checks an unusual pick rather than treating this as
  programmatic move-legality enforcement.
- Bumping `@pkmn/dex` to a newer release (if its learnset data catches up on the currently-stale
  species) is an ordinary `pnpm update`, not a vendoring/pinning act like `vendor/smogon-calc` or
  `vendor/ncp-common-sets` — its data ships inside the published package itself.
