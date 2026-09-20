# Move picker is filtered to each species' own learnset, preferring @pkmn/mods' real Champions data

The move picker (`MoveSlot`'s `MoveCombobox`) used to offer every move in the app's generation
regardless of the slot's own species — no way to tell "this species can actually learn this move"
from "no Pokémon can". It's now filtered to what the slot's species can currently learn
(`calc/learnsets.ts`'s `movesOf`), backed by two new dependencies — `@smogon/calc` (vendored or
not) and the already-installed `@pkmn/sets` carry no learnset data at all.

## How it works

- **Primary source: `@pkmn/mods`' `champions` mod** (`Learnsets` exported from
  `@pkmn/mods/champions`, itself pulled from `pkmn/ps`'s `mods/src/champions/learnsets.ts`) — a
  genuinely Champions-specific learnset, not a Scarlet/Violet approximation. Verified by hand: it
  isn't SV's movepool with a few numbers patched the way base power is (`moves.ts`'s
  `effectiveBasePower`) — it's a flat, TM-only teach system with no level-up/egg/tutor moves at
  all (every source in the whole file is tagged `"9M"`), so e.g. Pikachu can Champions-teach Volt
  Tackle (an SV egg-only move) but not Tera Blast (a universal SV TM Champions doesn't give it).
  This is a real divergence a Scarlet/Violet-only source could never reproduce.
- **Fallback: `@pkmn/dex`'s Scarlet/Violet learnset.** `@pkmn/mods`' Champions data doesn't cover
  the format's entire roster yet — about 90% of Regulation M-C's own roster has an entry there,
  verified by hand; the rest (Salamence, Persian, Toxtricity, Indeedee, ... — a mix of very
  ordinary and DLC-added species, no obvious pattern beyond "not added to this file yet") falls
  back to `Dex.forGen(GEN_NUM).learnsets.get(name)` (async — the ~475KB learnset JSON is loaded
  lazily on first call, not a network fetch, unlike `abilities.ts`'s PokeAPI-backed
  `abilitiesOf`), filtered to sources tagged for the current generation (starting `"9"`) — the
  same convention Pokémon Showdown's own team builder uses.
- **Further fallback: that same species' full historical movepool**, when even `@pkmn/dex`'s own
  learnset exists but has zero gen-9-tagged sources anywhere in it. Verified by hand: every species
  this hits (Absol, Aerodactyl, Aggron, ... — Scarlet/Violet's Indigo Disk DLC added them back via
  HOME transfer, and `@pkmn/dex`'s bundled data hasn't been updated with current-gen tags for them)
  is also one `@pkmn/mods` doesn't cover, so this only ever runs after both of the above have
  already come up empty. An empty picker for that many species would be a worse failure than
  occasionally offering a move that generation can no longer actually re-teach.
- A battle-only/stance forme with no learnset entry of its own in whichever source is being
  consulted (Mega Evolutions, Aegislash's Shield/Blade stances, Terapagos-Stellar, ...) falls back
  to its `baseSpecies`'s entry in that same source — neither `@pkmn/mods` nor `@pkmn/dex` duplicate
  an entry per forme when the movepool doesn't actually change with it. Aegislash needs an explicit
  override (`LEARNSET_NAME_OVERRIDES`) since `@smogon/calc`'s own species data has no plain,
  unprefixed "Aegislash" for that `baseSpecies` fallback to chase (same data quirk `abilities.ts`'s
  `SLUG_OVERRIDES` already works around for PokeAPI) — every other species resolves cleanly through
  its own name or `baseSpecies`, in either source.
- `@pkmn/mods/champions`'s own package export has no `"types"` condition in its `exports` map, only
  the legacy `typesVersions` field — which this project's `moduleResolution: "bundler"` doesn't
  fall back to once `exports` is present at all. `calc/pkmn-mods.d.ts` hand-declares the one export
  this app actually reads (`Learnsets`, as the minimal shape used) rather than pulling in
  `@pkmn/mods`'s own declaration, which types itself against `@pkmn/sim` — a dependency this app
  has no other reason to install.

## Considered options

- PokeAPI, the same source `abilities.ts` already uses for a species' full ability list: it does
  carry per-species move lists (`/pokemon/{slug}`'s `moves`), but keyed by _game version group_,
  and PokeAPI has no version group for Pokémon Champions at all — would still need a network fetch
  per species (cold on every first pick, unlike both sources actually used, which are bundled data)
  for a dataset that, being SV-only, is no more accurate than `@pkmn/dex`'s own fallback layer.
- Using only `@pkmn/dex`'s Scarlet/Violet data, no Champions-specific source: simpler (one data
  source, no `@pkmn/mods` dependency or `pkmn-mods.d.ts` workaround), but wrong wherever Champions
  actually diverges from SV's movepool — verified by hand to be a real, not hypothetical, gap
  (Pikachu/Volt Tackle vs. Tera Blast, above).
- Hand-curating a per-species move list: no existing source to seed it from, and would need manual
  upkeep every time Champions' roster grows — the same trade `generation.ts`'s
  `championsGen`-over-hand-typed-table already argues against for base power.

## Consequences

- Two new runtime dependencies, `@pkmn/dex` and `@pkmn/mods` (`@pkmn/sets` was already one;
  `@pkmn/dex` was previously deliberately left out of PokePaste import specifically, since nothing
  there needed to resolve display names to IDs — a learnset is a genuinely new need none of this
  app's existing dependencies carry).
- `@pkmn/mods`' Champions coverage will presumably keep growing release over release — bumping it
  (and `@pkmn/dex`, kept at the same version deliberately, `0.10.11`, since both ship from the same
  `pkmn/ps` release) is an ordinary `pnpm update`, not a vendoring/pinning act like
  `vendor/smogon-calc` or `vendor/ncp-common-sets` — their data ships inside the published packages
  themselves.
- The remaining SV-based fallback layers mean the movepool shown isn't perfectly precise for
  the ~10% of the roster neither source has real Champions data for yet, and within that, the
  smaller slice `@pkmn/dex` also has no current-gen tags for — it can include a move that
  generation can't currently re-teach, or omit a genuine Champions-only unlock like Volt Tackle
  (SV wouldn't know to offer it either). Accepted deliberately, on the expectation that the reader
  spot-checks an unusual pick rather than treating this as programmatic move-legality enforcement.
