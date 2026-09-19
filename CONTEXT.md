# Pokemon Tools

Two VGC tools for Pokémon Champions (doubles) in one app: a **Damage Calculator** (2vs2 point-in-time "what if", not a turn simulator) and a **Team Planner** (teams, matches and stats, being ported in; see ADR-0007). This file is the glossary; the calculator's terms come first, then the planner's.

## Language

**TeamId**:
Identifies which of the two battle sides a team belongs to (`teamA` | `teamB`). Renamed from the app's original `Side` type to avoid colliding with `@smogon/calc`'s own `Side`, which is a different concept (see below).
_Avoid_: Side (for this concept), Team (ambiguous with the roster itself)

**Side** _(library term, `@smogon/calc`)_:
The set of field-level flags scoped to one battling party for a single calculation (e.g. Tailwind, Helping Hand active, Friend Guard). Not the same concept as `TeamId`.

**Slot**:
One of the two positions within a `TeamId`'s roster (index 0 or 1), each holding a `TeamSlot` (species, item, ability, nature, stat points, moves). The two slots of one side are always allies of each other.

**Ally**:
The Pokémon occupying the other slot of the same side as a given attacker or defender. Every damage calculation involves exactly one ally per side (fixed 2vs2). A side can also hold a whole team behind those two slots (see **Roster** below), but only the two on the field take part in a calculation.

**Roster** _(calculator)_:
The whole team behind one `TeamId` (up to 6, `TeamRoster` in `stores/roster.svelte.ts`), of which two are on the field, i.e. are the side's two `TeamSlot`s; the rest are the **bench**. Filled when the calculator is opened from a planner team or match, or built by hand: a slot card's **Save** button adds its Pokémon to the roster (disabled while the slot is empty or already a member, or the team has 6), and a member's trash button takes it out (its slot keeps its build). Next to each side's heading, **Export** copies the whole team (every member, not just the two on the field) as one PokePaste, **Import** replaces the team with a pasted one (up to 6, species this app doesn't know are left out and reported) and **Save as new team** hands it to the page, which keeps it in the planner (the calculator never imports the planner). With no roster yet, the team is what's in the two slots. Opened from an existing planner team or from one of its matches, Team A also has **Save changes**, which — after a confirmation that says the team will be overwritten — writes the edited roster over that team (name, id, date and match history kept, paste rewritten). From a match, Team A can be only part of the team, so the confirmation states how many Pokémon will replace it. The planner's **Create from calculator** opens an empty Team A (or one started from what was pasted in the new team form) to build a team in. Changing a slot to a different Pokémon (not just another forme) detaches it from its member, which keeps the build it had. Bringing a member onto the field first writes the slot's current build back into its member, so edits survive a trip to the bench; stat stages and the other in-battle "what ifs" don't. A member's build comes from a saved set, else the species' first common set, else just its name.
_Avoid_: confusing it with the planner's **Roster** (the 6 a Team had in a Match)

**Damage Matrix**:
The core result of a matchup: for every attacker (the 4 Pokémon across both sides) and every one of its up to 4 moves, the damage against each of the 2 opposing Pokémon, computed in both directions (A→B and B→A). Excludes friendly fire, except that an `allAdjacent` move's simultaneous ally damage is shown inline alongside its matrix row (see Friendly fire). Every move row is shown, including status moves (marked `—`, see below); no targeting is redirected (Follow Me, Rage Powder, Storm Drain, Lightning Rod are not modeled — the reader picks the target).
_Avoid_: 2x2 matrix (undersells that all 4 moves are shown, and ambiguous about whether it includes the ally)

A cell shows a %HP range (min-max) plus a KO chance annotation when relevant, matching the convention of Pokémon Showdown-style calculators; not a single number. A cell is `—` only for moves with no direct damage component at all (base power 0 and not a fixed-damage move like Seismic Toss) — any move with a damage formula always shows its computed number, even if that number is 0 (e.g. a Normal move into a Ghost-type). No critical hit is assumed by default; "assume crit" is a separate opt-in recalculation, not a second number shown by default. Multi-hit moves (Bullet Seed, Icicle Spear, ...) default to 3 hits (the expected average, matching `@smogon/calc`'s own default, overridden automatically when an ability fixes the count, e.g. Skill Link → 5), with a manual selector to override the hit count per move.

**Friendly fire**:
Damage calculated against a Pokémon's own ally rather than an opponent.

- Moves that can **only** target the ally (`adjacentAlly`, `allies`) are excluded from the Damage Matrix entirely — every such move is Status with no damage component, so there's nothing to show. (An earlier on-demand "vs ally" view for these was removed once that turned out to always read 0%.)
- Moves that hit the ally **simultaneously** with opponents in real play (`allAdjacent`, e.g. Earthquake) show that ally damage inline in the Damage Matrix itself — it isn't optional, since that's what using the move actually does.

**Ally support**:
Modifiers on a `Side` that originate from the acting Pokémon's ally rather than itself (Friend Guard, Battery, Power Spot, Steely Spirit, Helping Hand, Tailwind). The manual override for all six is one shared toggle per `TeamId`, not per `TeamSlot` — turning one on or off applies to the whole team at once, since these are conditions on the side, not a specific Pokémon. Auto mode (the default for the four static flags) still only credits whichever single slot's own `ability` actually grants it, never both team members at once.

- **Static ally support**: derived automatically from the ally's `ability` field (Friend Guard, Battery, Power Spot, Steely Spirit) — on by default when the specific ally has that ability, with a team-wide manual override toggle (Auto/On/Off).
- **Turn-dependent ally support**: Helping Hand, Tailwind — no static data source (they depend on an action taken that turn, not a fixed ability/item), so manual toggle only (team-wide), off by default. Tailwind also doubles the Speed number shown on each of that team's `TeamSlotCard`s — a display-only convenience in `StatPointBars`, separate from (and in addition to) the real `attackerSide.isTailwind` flag already passed into `computeDamage` for moves whose own power depends on a speed comparison (Electro Ball, Gyro Ball).

**Field conditions**:
Weather, terrain (`@smogon/calc`'s own `Field.weather`/`.terrain`), Gravity (`Field.isGravity`) and battle format (`Field.gameType`) — global to the whole battlefield, one shared value each. Unlike ally support, these are never scoped to a team: changing any of them affects both directions of the matchup (A→B and B→A) identically. Gravity is a plain boolean, not Auto/On/Off like the field abilities below — it's a move effect (grounds Flying-types and Levitate/Air Balloon holders, so Ground-type moves can hit them), not derived from any Pokemon's `ability`, so there's nothing to auto-detect.

Battle format (Singles/Doubles) defaults to Doubles, matching this app's roster shape and its pre-existing behavior. It never changes that roster shape — always a fixed 2vs2 (see above) — it only toggles which of `@smogon/calc`'s own gameType-gated mechanics apply to a calculation, chiefly the Doubles spread-damage modifier on `allAdjacent`/`allAdjacentFoes` moves (Earthquake, Rock Slide, ...): Singles turns that reduction off, letting the reader check a move's single-target numbers without switching rosters.

**Entry effects**:
Abilities that set a weather or terrain on switch-in (Drought, Drizzle, Grassy Surge, Psychic Surge, ...; `calc/entryEffects.ts`). Picking such an ability — directly, or via the species' auto-filled first ability — presets the matching Field condition once; it never clears one, and the user can still change it by hand afterwards. Distinct from Field abilities below, which stay derived (Auto/On/Off) from whoever holds them.

**Field abilities**:
Abilities whose effect (per `@smogon/calc`'s own mechanics, `gen789.ts`) applies to the whole field rather than one side — Ting-Lu's Vessel of Ruin, Wo-Chien's Tablets of Ruin, Chien-Pao's Sword of Ruin and Chi-Yu's Beads of Ruin (each lowers one stat — Sp. Atk/Atk/Def/Sp. Def respectively — for every Pokemon on the field except its own holder), plus Xerneas' Fairy Aura (boosts every Fairy-type move's power field-wide, whoever uses it). Modeled like a field condition (Auto/On/Off per ability, `null` = Auto, `calc/fieldAbilities.ts`), not like ally support: each reads off a single shared `Field.isX` flag, so Auto derives from whether _any_ of the 4 Pokemon across both teams has the ability — not just one team's own two, the way Friend Guard/Battery/Power Spot/Steely Spirit do (ADR-0003). A per-team override here would silently miss the case where the holder is on the opposing side.
_Avoid_: putting these on `TeamAllySupport` (per-team scope is mechanically wrong for an ability that isn't ally-only); Dark Aura and Aura Break (Yveltal/Zygarde's own field-wide abilities, the same shape as Fairy Aura) aren't implemented — not asked for yet

**Side conditions**:
Screens (Reflect, Light Screen, Aurora Veil), Protect, entry hazards (Stealth Rock, Spikes), and Intimidate — real `@smogon/calc` `Side` state for the first three groups, but a distinct concept from ally support: screens/Protect/hazards never derive from any Pokémon's own `ability`, so there's no Auto mode for those, just plain manual toggles/counts, off/zero by default. Team-wide for the same reason as ally support (they describe a condition on the whole side, not one specific Pokémon), applying to whichever team is the _target_ in a given calculation. `protect` is a deliberate simplification of a real, single-turn, single-Pokémon action into a team-wide "what if" toggle; `intimidate` is a similar simplification — a flat, unconditional -1 Attack stage on whichever Pokémon attacks this team, with none of real Intimidate's edge cases modeled (switch-in-only timing, Clear Body/Own Tempo/... blocking it, Contrary/Simple/Defiant reacting to it). Unlike the others, `intimidate` isn't a `@smogon/calc` `Side` flag at all — see Stat stages below for why. Unlike the other side conditions, `intimidate` _does_ have an Auto mode — same Auto/On/Off convention as the field abilities and `TeamAllySupport`'s static flags, auto-derived from whether either of the team's own two Pokémon has the Intimidate ability equipped (`sideConditions.ts`'s `providesIntimidate`), with a manual override for the "what if neither of my own Pokémon actually has it" case.

Not every field/side toggle a reference damage calculator might expose is implemented: Leech Seed and Salt Cure are genuine `@smogon/calc` `Side` fields, but only affect its free-text `result.desc()` output, which this app never renders — wiring them would be a no-op. Ingrain, Curse, Binding, Charge and Aqua Ring aren't modeled by `@smogon/calc` at all (no `Side`/`Field`/`Pokemon` flag any mechanics function reads) — a toggle for them would be pure decoration with no effect on any number this app shows.

**Stat stages**:
A Pokémon's own in-battle Attack/Defense/Sp. Atk/Sp. Def/Speed boosts (Swords Dance, ...), -6..+6, 0 by default — never HP, which no stat stage ever touches. Stored per `TeamSlot` (`boosts`, `calc/format.ts`'s `StatBoosts`), not team-wide like ally support/side conditions, since it's a property of one specific Pokémon's build, same bucket as `statPoints` (reset together on a genuinely different species, carried over across a same-family forme change like a Mega Evolution). Feeds `@smogon/calc`'s own `Pokemon.boosts` directly (`toSmogonPokemon`), so it's a real input to `calculate()`, not a display-only convenience like Tailwind's Speed-doubling (`StatPointBars`' `tailwind` prop) — though `StatPointBars` shows the _combined_ effective stat (stage + Tailwind) on every `TeamSlotCard`, for the same reason the Damage Matrix shows a computed number rather than raw inputs.

Intimidate (`TeamSideConditions.intimidate`, see Side conditions above) is the one thing that adjusts a stat stage from _outside_ the attacking Pokémon's own `boosts` — `matrix.ts` computes the attacker's effective Atk stage (`boosts.atk` minus 1 if the target's team has Intimidate up, clamped) per row and passes it to `computeDamage` as `attackerBoosts`, which `toSmogonPokemon` layers on top of (not in place of) the slot's own `boosts` — the manual Atk stage a player picked is never destructively overwritten just because Intimidate is toggled on or off.
_Avoid_: mutating `TeamSlot.boosts.atk` directly when Intimidate is toggled (loses the player's own manual stage the moment Intimidate is toggled back off)

**Fainted allies**:
The stack count (0-5) behind Supreme Overlord (`@smogon/calc`'s own `Pokemon.alliesFainted`) and Last Respects (+50 base power per ally; `@smogon/calc` only has its flat 50, so `moves.ts`'s `basePowerWithAlliesFainted` overrides it). Stored per `TeamSlot` (`alliesFainted`), reset on a genuinely different species like `boosts`. Its selector lives in the Damage Matrix, on the right of the attacker's title, and only shows when that attacker has the ability or a move that reads it.

**Auto-fill on species selection**:
Picking a species through `TeamSlotCard`'s own UI (`PokemonCombobox`, `FormeCombobox`, `GenderToggle` — anything that sets `slot.species` through a user action rather than PokePaste import) auto-fills two build fields the freshly-voided species/forme change would otherwise leave empty: the species' own first ability (`calc/abilities.ts`'s `abilitiesOf`, PokeAPI-backed and async — same data source `AbilityCombobox` itself uses) and, for a Mega Evolution specifically, its own Mega Stone as the held item (`calc/items.ts`'s `megaStoneFor`, matched off `@smogon/calc`'s own `Item.megaStone` map). Implemented in `TeamSlotCard`'s own `selectSpecies` handler, wrapped around all three components' `bind:selected`, not in `TeamSlot.species`'s own setter.

Deliberately excluded from PokePaste import (`importPokePaste` sets `slot.species` directly, bypassing `selectSpecies` entirely): a pasted set always carries its own ability/item (or explicitly none), and overwriting that with an auto-filled guess — or racing `abilitiesOf`'s async resolution against import's own synchronous, correct assignment — would silently corrupt a deliberately ability-less or item-less import.
_Avoid_: hooking this into `TeamSlot.species`'s own setter (that setter is also PokePaste import's own code path, see above) — set it up as a UI-layer handler wrapping the three species-picking components instead

**PokePaste import/export**:
A `TeamSlotCard`'s "Export"/"Import" buttons (`calc/pokepaste.ts`'s `exportPokePaste`/`importPokePaste`) round-trip one `TeamSlot` through the same Showdown-export text block `pokepast.es` and Showdown's own team builder use — species, item, ability, level, EVs, nature, moves. The `EVs:` line is `statPoints` written through (and read back) as-is (0-32 per stat, clamped on import) — deliberately **not** the real-game 0-252 EV `toSmogonPokemon` computes for `@smogon/calc` (`damage.ts`'s own, unexported `toEvs`): a pasted "EVs: 32 Atk" is this app's own Stat Point value, not a real EV investment, and exporting then re-importing the same text must land back on the exact same Stat Points. Uses `@pkmn/sets`'s `Sets.exportSet`/`importSet` with no `Data` implementation (no `@pkmn/dex`, deliberately): every field a `TeamSlot` tracks is already a display name, never an ID, so there's nothing for `data` to resolve — the one thing an omitted `data` changes is that `exportSet` assumes gen ≥ 3 formatting, which is exactly right for this app's fixed gen 9. Stat stages, side conditions, ally support and field conditions aren't part of a set at all (PokePaste has no concept of them); import always resets `boosts` to 0 rather than leaving whatever the slot had before, and export leaves them out entirely.

Import is lenient field-by-field: an item/ability/nature/move name this app's own data doesn't recognize is dropped (`null`/neutral-nature/empty slot) rather than failing the whole import — only a missing or unrecognized _species_ throws, since without one there's nothing left to import. `ability` is carried over as free text with no validity check against the target species, same as everywhere else a slot's `ability` is set directly.
_Avoid_: adding `@pkmn/dex` "just in case" (a second, unused species/move/item data source alongside `@smogon/calc`'s own); converting `statPoints` to/from a real EV for this line (right for feeding `@smogon/calc`, wrong for a paste meant to round-trip through this app); IVs and gender aren't exported — this app has no IV customization (`FIXED_IV`) or general per-slot gender to describe

**Vendored `@smogon/calc`**:
`@smogon/calc` isn't installed from npm (`"@smogon/calc": "file:vendor/smogon-calc"` in `package.json`) — npm's own published version is stuck on a release from before real Pokémon Champions support existed upstream, and releases there are rare and irregular enough that waiting for a new one isn't practical (ADR-0005). `vendor/smogon-calc/` is the compiled output of a pinned upstream commit instead, built and copied in by `scripts/vendor-smogon-calc.sh` (`COMMIT` at the top of that script is the one thing to change to move the pin) and committed to git like any other source file — there's no build step for it at `pnpm install` time.

`generation.ts`'s `championsGen` reads that same vendored package's own dedicated Champions data set (`Generations.get(0)`, a real, separate generation slot, not a gen 9 variant) — but only for `moves.ts`'s `effectiveBasePower`, which is what `damage.ts`'s `toSmogonMove` and `MoveSlot.svelte`'s displayed power both go through instead of a move's raw `basePower`. `GEN_NUM`/`gen` (still 9, SV) remains the one source for the species/move/item/ability pickers themselves: Champions' own roster is a much smaller, still-growing subset of SV's, so switching the app's main generation to it would silently drop most of what's currently supported, not just fix move power.
_Avoid_: hand-typing a base-power override table (the previous approach) — it only catches whatever divergence someone happened to notice and verify by hand, where reading `championsGen` directly gets every currently-known one for free and stays correct as the vendored commit is bumped; switching `GEN_NUM` itself to `0` to "properly" use Champions data (gates the species/move/item/ability roster down to whatever Champions currently has, which is a regression, not a fix)

**Common Sets**:
A `TeamSlotCard`'s "Common Sets" button (next to "Import") opens `CommonSetsModal`, listing every curated, named build (`calc/commonSets.ts`'s `commonSetsFor`) the vendored `vendor/ncp-common-sets/setdex.json` has for the slot's _already-selected_ species — picking one applies it (`applyCommonSet`) in place, the same fields `importPokePaste` overwrites (item, ability, nature, Stat Points, moves, boosts reset to 0) except `species` itself, which a common set is chosen _for_, not free to change. Disabled whenever `hasCommonSets` is false — no species selected, or one the vendored data's curated ~90-species list doesn't cover at all. The data's own `sps` field is already this app's own 0-32 Stat Point convention, not a real 0-252 EV, so no conversion is needed the way `exportPokePaste`'s `EVs:` line requires none either. See ADR-0006 for where it's vendored from and why.

`ability` is the one field this doesn't treat like PokePaste import does: most of the vendored sets (123 of 151 at vendoring time) simply don't specify one at all — the source tool apparently leaves it to whatever's already selected rather than treating it as part of the set — so `CommonSet.ability` is `string | undefined`, and `applyCommonSet` leaves the slot's current ability alone when it's `undefined` rather than clearing it to `null` the way a PokePaste import's genuinely-absent ability does. A Mega Evolution's sets live under its base species (holding the Mega Stone as the `item`), never a separate `"X-Mega-Y"` key — applying one never switches the slot's own forme, same as import.
_Avoid_: clearing `slot.ability` to `null` when a common set's own `ability` is `undefined` (destroys a perfectly good auto-filled ability for the ~80% of sets that just don't mention one — see ADR-0006)

## Shared language

**Set data** (`PokemonSetData`, `modules/shared`):
A Pokémon's build as plain, serializable data: species, optional nickname/item/ability/nature, Stat Points and up to 4 move names, all as display names. The format both tools agree on and what gets persisted. `TeamSlot.fromData`/`toData` convert it to and from a live slot; names the calculator can't match are skipped and reported by `applySetData`, never fatal. Not part of it: stat stages, fainted allies and per-move crit/hit-count (in-battle "what ifs", not the build), and level/IVs (fixed by the format).
_Avoid_: storing `TeamSlot` or `@smogon/calc` objects (`Specie`, `Item`, `Move`) directly

## Team Planner language

_Planned; these terms come from the standalone `pokemon-team-stats` app and will be implemented as the planner is ported (ADR-0007)._

**Team**:
A named roster of up to 6 Pokémon, created from a Pokepaste. Not to be confused with `TeamId`/`TeamSlot` above, which are the two sides and positions of one calculation.

**Match**:
One recorded match played with a Team, either **Bo1** (one **Game**) or **Bo3** (up to three, first to two wins). Holds the Team's roster at that time and the **Rival**'s team; its result is derived from its Games (win, loss or ongoing while undecided). Matches saved before Bo3 existed read as a Bo1.

**Game**:
One game of a Match: its result and, for each side, the **Selection** and **Lead** picked. Pokémon and lead stats count Games; the win/loss totals count Matches.

**Roster**:
The 6 Pokémon a Team had when a Match was played. Frozen on the Match, so later edits to the Team don't rewrite history.

**Selection**:
The 4 Pokémon of a Roster brought to a Match. The Rival also has one.

**Lead**:
The 2 Pokémon of a Selection that start on the field. The Rival also has one.

**Rival**:
The opponent of a Match. By default only 6 Pokémon names; optionally with full sets, so the calculator can be opened from a Match (missing sets are filled from Common Sets).
