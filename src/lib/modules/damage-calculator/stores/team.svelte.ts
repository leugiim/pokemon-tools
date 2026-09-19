import { hasTypeShift } from '../calc/typeShift';
import type { SpeciesItem } from '$lib/modules/shared/species/generation';
import type { HeldItem } from '$lib/modules/damage-calculator/calc/items';
import type { MoveItem } from '$lib/modules/damage-calculator/calc/moves';
import {
	emptyStatBoosts,
	emptyStatPoints,
	NEUTRAL_NATURE,
	type NatureInfo,
	type StatBoosts,
	type StatPoints
} from '$lib/modules/damage-calculator/calc/format';
import { applySetData, slotToData } from '$lib/modules/damage-calculator/calc/setData';
import type { PokemonSetData } from '$lib/modules/shared';

/** A Pokémon's 4 move slots — any of them can be empty. */
export type MoveSlots = [MoveItem | null, MoveItem | null, MoveItem | null, MoveItem | null];

/**
 * A move slot's own Damage Matrix calculation overrides: "assume crit"
 * (#14), off by default, and a manual multi-hit hit-count override (#15) —
 * `null` means no override, falling back to `@smogon/calc`'s own default
 * (3 hits, or the attacker's ability's fixed count when it has one, e.g.
 * Skill Link — see `multiHitRange`). Kept as one object, rather than a
 * separate parallel array per field, since every reader/writer of these
 * (matrix.ts, and `species`'s reset below) always handles both together,
 * indexed by the same move slot.
 */
export interface MoveCalcOptions {
	isCrit: boolean;
	hits: number | null;
}

/** Per-move-slot Damage Matrix overrides — parallel to `MoveSlots`. */
export type MoveOptionsSlots = [MoveCalcOptions, MoveCalcOptions, MoveCalcOptions, MoveCalcOptions];

/** The most fainted allies the selector allows. */
export const MAX_ALLIES_FAINTED = 5;

function emptyMoves(): MoveSlots {
	return [null, null, null, null];
}

function defaultMoveOptions(): MoveCalcOptions {
	return { isCrit: false, hits: null };
}

function defaultMoveOptionsSlots(): MoveOptionsSlots {
	return [defaultMoveOptions(), defaultMoveOptions(), defaultMoveOptions(), defaultMoveOptions()];
}

/**
 * A team's shared ally-support state (ADR-0003, #13) — one set of
 * toggles per `TeamId`, not per `TeamSlot`: these six flags describe
 * conditions on the *side*, not a specific Pokémon, so a manual override
 * applies to the whole team at once rather than needing to be set (and kept
 * in sync) on each of its two slots separately.
 *
 * `friendGuard`/`battery`/`powerSpot`/`steelySpirit` are `null` (the
 * default) to auto-derive from whichever slot's own `ability` actually
 * grants it — auto mode still only credits the one real ally that has it,
 * never both team members, see `allySupport.ts`'s `providesStaticSupport`
 * — or `true`/`false` to force the flag on or off for the whole team
 * regardless of any slot's actual ability, for testing a hypothetical.
 * `helpingHand`/`tailwind` have no static data source at all (they depend
 * on an action taken that turn, not a fixed ability/item), so they're
 * plain manual toggles, default off.
 */
export interface TeamAllySupport {
	friendGuard: boolean | null;
	battery: boolean | null;
	powerSpot: boolean | null;
	steelySpirit: boolean | null;
	helpingHand: boolean;
	tailwind: boolean;
}

export function defaultTeamAllySupport(): TeamAllySupport {
	return {
		friendGuard: null,
		battery: null,
		powerSpot: null,
		steelySpirit: null,
		helpingHand: false,
		tailwind: false
	};
}

/**
 * A team's shared side conditions: screens, Stealth Rock, Spikes and
 * Intimidate — real `@smogon/calc` `Side` state for the first four, but a
 * distinct concept from ally support (`TeamAllySupport`): screens/Stealth
 * Rock/Spikes never derive from any Pokémon's own `ability`, so there's no
 * Auto mode for those, just plain manual toggles/counts, off/zero by
 * default. Team-wide for the same reason as ally support — they describe a
 * condition on the whole side, not one specific Pokémon. `protect` is a
 * deliberate simplification: real Protect is a single Pokémon's action for
 * one turn, but this toggle is for testing the hypothetical "what if this
 * side's target had protected" against every calculation involving either
 * of its two Pokémon at once. `intimidate` is the one exception with a real
 * Auto mode — see its own doc comment below.
 */
export interface TeamSideConditions {
	protect: boolean;
	reflect: boolean;
	lightScreen: boolean;
	auroraVeil: boolean;
	stealthRock: boolean;
	/** 0-3 layers of Spikes. */
	spikes: number;
	/**
	 * A flat, unconditional -1 Attack stage applied to whichever Pokemon
	 * attacks this team, same simplification as `protect` (ADR-0001):
	 * real Intimidate only triggers on switch-in and can be blocked
	 * (Clear Body, Own Tempo, ...) or backfire (Contrary, Simple) — none
	 * of that is modeled, this is just "what if this team's attacker took
	 * an Intimidate". Unlike Protect/the screens, it doesn't map to any
	 * `@smogon/calc` `Side` flag at all — it's a per-Pokemon `boosts.atk`
	 * adjustment applied in `matrix.ts`, not `sideConditionFlags`.
	 *
	 * Unlike the other side conditions, this one *does* have an Auto mode
	 * (`null`), same Auto/On/Off convention as `FieldConditions`' field
	 * abilities and `TeamAllySupport`'s static flags: auto-derived from
	 * whether either of this team's own two Pokemon has the Intimidate
	 * ability equipped (`sideConditions.ts`'s `providesIntimidate`), with a
	 * manual override available for a "what if" the roster's own abilities
	 * don't cover.
	 */
	intimidate: boolean | null;
}

export function defaultTeamSideConditions(): TeamSideConditions {
	return {
		protect: false,
		reflect: false,
		lightScreen: false,
		auroraVeil: false,
		stealthRock: false,
		spikes: 0,
		intimidate: null
	};
}

/**
 * The species' "family" root — the same for every forme of a given
 * Pokémon (Charizard, Charizard-Mega-X, and Charizard-Mega-Y all
 * resolve to `Charizard`), so switching between them can be told apart
 * from switching to a genuinely different Pokémon.
 */
function familyOf(species: SpeciesItem): string {
	return species.baseSpecies ?? species.name;
}

/**
 * Neither side is fixed as "the attacker" — damage is calculated both
 * ways (every Pokémon on team A against every Pokémon on team B, and
 * vice versa), so the two sides are just A and B.
 */
export type TeamId = 'teamA' | 'teamB';

/** A single team slot. */
export class TeamSlot {
	#species = $state<SpeciesItem | null>(null);
	item = $state<HeldItem | null>(null);
	ability = $state<string | null>(null);
	nature = $state<NatureInfo>(NEUTRAL_NATURE);
	statPoints = $state<StatPoints>(emptyStatPoints());
	/** In-battle stat stages (-6..+6, 0 by default) — a "what if" on top of `statPoints`, not part of the build itself; see `StatPointBars`. */
	boosts = $state<StatBoosts>(emptyStatBoosts());
	/**
	 * The type a Protean/Libero holder currently has (`null` = Auto: the
	 * ability's own "STAB on every move"). A "what if" like `boosts`, and
	 * only in effect while the ability is one of those — see `shiftedType`.
	 */
	currentType = $state<string | null>(null);
	/**
	 * Fainted allies (0-5) — the stack count behind Supreme Overlord and
	 * Last Respects. A "what if" on top of the build, like `boosts`.
	 */
	alliesFainted = $state(0);
	moves = $state<MoveSlots>(emptyMoves());
	moveOptions = $state<MoveOptionsSlots>(defaultMoveOptionsSlots());

	get species(): SpeciesItem | null {
		return this.#species;
	}

	/**
	 * A new slot holding `data`'s build (see `applySetData`; names that
	 * don't match this app's data are skipped, use `applySetData` directly
	 * to get them back).
	 */
	static fromData(data: PokemonSetData): TeamSlot {
		const slot = new TeamSlot();
		applySetData(slot, data);
		return slot;
	}

	/** `currentType`, when this slot's ability makes it count. */
	get shiftedType(): string | null {
		return hasTypeShift(this.ability) ? this.currentType : null;
	}

	/** The slot's types as they are right now: the species', or the one it shifted to. */
	get types(): string[] {
		return this.shiftedType ? [this.shiftedType] : [...(this.#species?.types ?? [])];
	}

	/** This slot's build as plain data, or `null` while it has no species. */
	toData(): PokemonSetData | null {
		return slotToData(this);
	}

	/**
	 * Switching to a genuinely different Pokémon voids the item, nature,
	 * stat points, fainted allies, moves, and per-move Damage Matrix overrides (assume-crit,
	 * hit-count) chosen for the previous one. Switching formes within the
	 * same family (e.g. into or out of a Mega Evolution) only changes what
	 * its base stats (and the sprite/types derived from them) are — the
	 * rest of the build carries over.
	 *
	 * Ability is the one exception: it's voided on *any* species change,
	 * same family or not, since a different forme can have a wholly
	 * different valid ability (a Mega Evolution almost always does).
	 */
	set species(value: SpeciesItem | null) {
		if (value === this.#species) return;
		const sameFamily =
			value !== null && this.#species !== null && familyOf(value) === familyOf(this.#species);
		this.#species = value;
		this.ability = null;
		this.currentType = null;
		if (!sameFamily) {
			this.item = null;
			this.nature = NEUTRAL_NATURE;
			this.statPoints = emptyStatPoints();
			this.boosts = emptyStatBoosts();
			this.alliesFainted = 0;
			this.moves = emptyMoves();
			this.moveOptions = defaultMoveOptionsSlots();
		}
	}

	/**
	 * Resets one move slot's own Damage Matrix overrides (assume-crit,
	 * hit-count) back to their defaults. Called whenever the move picked
	 * for that slot changes (see `MoveSlot.svelte`) — a crit assumption or
	 * manual hit count that made sense for the previous move would
	 * otherwise silently carry over and misrepresent an unrelated new move
	 * picked for the same slot (#14, #15).
	 */
	resetMoveOptions(index: number): void {
		this.moveOptions[index] = defaultMoveOptions();
	}
}

function createSide(): [TeamSlot, TeamSlot] {
	return [new TeamSlot(), new TeamSlot()];
}

// $state, not a plain array: TeamSlotCard binds into `teamA[i]` /
// `teamB[i]` (see +page.svelte), and Svelte's binding validator requires
// the container itself to be reactive for that — each TeamSlot's own
// fields being $state isn't enough, since a slot is never actually
// replaced wholesale, only the array's "this index is bindable" status
// is what's being checked.

/** The 2 Pokémon on team A. */
export const teamA = $state(createSide());

/** The 2 Pokémon on team B. */
export const teamB = $state(createSide());

export const sides: Record<TeamId, [TeamSlot, TeamSlot]> = { teamA, teamB };

/** Team A's shared ally-support toggles (ADR-0003, #13). */
export const teamAAllySupport = $state(defaultTeamAllySupport());

/** Team B's shared ally-support toggles (ADR-0003, #13). */
export const teamBAllySupport = $state(defaultTeamAllySupport());

export const allySupport: Record<TeamId, TeamAllySupport> = {
	teamA: teamAAllySupport,
	teamB: teamBAllySupport
};

/** Team A's shared side conditions (screens, Stealth Rock, Spikes). */
export const teamASideConditions = $state(defaultTeamSideConditions());

/** Team B's shared side conditions (screens, Stealth Rock, Spikes). */
export const teamBSideConditions = $state(defaultTeamSideConditions());

export const sideConditions: Record<TeamId, TeamSideConditions> = {
	teamA: teamASideConditions,
	teamB: teamBSideConditions
};
