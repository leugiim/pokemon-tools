import type { State } from '@smogon/calc';

// `@smogon/calc`'s own `Weather`/`Terrain` types aren't re-exported from
// its package root (only `State`, `Field`, `Side`, ... are) — derived from
// `State.Field`'s own fields instead of reaching into an internal,
// unexported module path.
export type Weather = NonNullable<State.Field['weather']>;
export type Terrain = NonNullable<State.Field['terrain']>;
// Unlike Weather/Terrain, `@smogon/calc`'s own `gameType` is never nullable
// (its `Field` constructor defaults an omitted one to 'Singles') — there's
// no "none" state to model, so no `NonNullable` needed here.
export type BattleFormat = State.Field['gameType'];

/**
 * Field-wide weather and terrain (`@smogon/calc`'s own `Field`, #24) —
 * global to the whole battlefield, shared by both sides alike, unlike ally
 * support (`TeamAllySupport`, per team) or a move's own calculation
 * overrides (per slot). `null` means "none" for either.
 *
 * `gravity` (the move Gravity's field effect — grounds Flying-types and
 * Levitate/Air Balloon holders, letting Ground-type moves hit them) is a
 * plain boolean here, not nullable like the flags below: it's a move
 * effect, not derived from any Pokemon's `ability`, so there's no Auto
 * mode to fall back to — off by default, same as `TeamSideConditions`.
 *
 * The four Ruin abilities (Vessel/Tablets/Sword/Beads, held by Ting-Lu,
 * Wo-Chien, Chien-Pao and Chi-Yu respectively) plus Fairy Aura (Xerneas)
 * belong here rather than on `TeamAllySupport` for the same reason:
 * `@smogon/calc`'s own mechanics apply each one field-wide — to every
 * Pokemon on the field (Fairy Aura: every Fairy-type move used by anyone),
 * not just one team's own side — from a single shared `Field.isX` flag
 * (see `calc/fieldAbilities.ts`), so a per-team override wouldn't match how
 * the ability actually works. `null` means Auto (derive from whether any
 * of the 4 Pokemon on the field has the ability), matching the
 * Auto/On/Off convention `TeamAllySupport`'s own static flags use.
 *
 * `statPointsUnlimited` isn't a field condition either, same as
 * `battleFormat` above — it lives here anyway as this app's other single,
 * whole-calculator (not per-team, not per-Pokemon) toggle, rather than a
 * one-field store of its own. See `format.ts`'s `MAX_SP_TOTAL`.
 */
export interface FieldConditions {
	/**
	 * `@smogon/calc`'s own `Field.gameType` — doesn't change the roster
	 * shape (this app is always a fixed 2vs2 Pokemon on each side, see
	 * `CONTEXT.md`), only which of its own mechanics that key off `gameType`
	 * apply to a given calculation: chiefly the Doubles spread-damage
	 * modifier on `allAdjacent`/`allAdjacentFoes` moves (Earthquake, Rock
	 * Slide, ...), which 'Singles' turns off. Defaults to 'Doubles' — this
	 * app modeled Doubles exclusively before this field existed, so that's
	 * the behavior every existing team/matchup should keep seeing unless the
	 * user opts into 'Singles'.
	 */
	battleFormat: BattleFormat;
	weather: Weather | null;
	terrain: Terrain | null;
	gravity: boolean;
	vesselOfRuin: boolean | null;
	tabletsOfRuin: boolean | null;
	swordOfRuin: boolean | null;
	beadsOfRuin: boolean | null;
	fairyAura: boolean | null;
	/** Lifts `format.ts`'s `MAX_SP_TOTAL` (66) cap on every slot's Stat Point spread — the per-stat `MAX_SP_PER_STAT` (32) cap still applies regardless, see `StatPointBars`' own `setStat`. Off by default: matches Regulation M-C's real rule. */
	statPointsUnlimited: boolean;
}

export function defaultFieldConditions(): FieldConditions {
	return {
		battleFormat: 'Doubles',
		weather: null,
		terrain: null,
		gravity: false,
		vesselOfRuin: null,
		tabletsOfRuin: null,
		swordOfRuin: null,
		beadsOfRuin: null,
		fairyAura: null,
		statPointsUnlimited: false
	};
}

/**
 * Every selectable weather value except `Hail` — gen 9 replaced it with
 * `Snow`, and the two aren't equivalent (e.g. Snow's Ice-type Defense
 * boost only triggers on `Snow`, never `Hail` — see `@smogon/calc`'s
 * `mechanics/gen789.ts`), so offering `Hail` here would silently produce
 * an incomplete result for this app's fixed gen-9 ruleset (`GEN_NUM`).
 */
export const WEATHER_OPTIONS: Weather[] = [
	'Sun',
	'Rain',
	'Sand',
	'Snow',
	'Harsh Sunshine',
	'Heavy Rain',
	'Strong Winds'
];

export const TERRAIN_OPTIONS: Terrain[] = ['Electric', 'Grassy', 'Psychic', 'Misty'];

/**
 * Unlike Weather/Terrain (a mutually-exclusive group with a "none" state),
 * one of these two is always active — there's no `toggleX`-style
 * click-to-deselect for `battleFormat`, see `FieldConditionsPicker`.
 */
export const BATTLE_FORMAT_OPTIONS: BattleFormat[] = ['Singles', 'Doubles'];

export const field = $state<FieldConditions>(defaultFieldConditions());
