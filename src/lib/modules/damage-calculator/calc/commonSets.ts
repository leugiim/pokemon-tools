import rawSetdex from '../../../../../vendor/ncp-common-sets/setdex.json';
import {
	allNatures,
	emptyStatBoosts,
	emptyStatPoints,
	MAX_SP_PER_STAT,
	NEUTRAL_NATURE,
	STAT_ORDER,
	type NatureInfo,
	type StatPoints
} from './format';
import { allItems, megaStoneFor, type HeldItem } from './items';
import { allMoves } from './moves';
import { findByName } from './pokepaste';
import { speciesLabel, type SpeciesItem } from '$lib/modules/shared/species/generation';
import type { MoveSlots, TeamSlot } from '../stores/team.svelte';

/**
 * One species' worth of vendored `setdex.json` entries, keyed by set name.
 * `ability` is missing entirely on most sets (123 of 151 at vendoring
 * time) — the source tool apparently leaves it to whatever ability its own
 * UI already has selected, rather than specifying one per set — so it's
 * optional here, unlike `nature`/`sps`/`moves`, which every set has.
 * `item` is missing on exactly one (Talonflame's "Itemless Acrobatics"),
 * meaning "no item" as a deliberate build choice, not "unspecified" —
 * see `toCommonSet`'s different handling of the two.
 */
interface RawCommonSet {
	sps: { hp: number; at: number; df: number; sa: number; sd: number; sp: number };
	nature: string;
	ability?: string;
	item?: string;
	moves: string[];
}

type RawSetdex = Record<string, Record<string, RawCommonSet>>;

/**
 * A vendored common set (ADR-0006), already resolved against this app's own
 * data — an item/nature/move name the vendored set gives that this app's
 * own data doesn't recognize is dropped (`null`/neutral nature/empty move
 * slot) rather than failing the whole set, the same leniency
 * `pokepaste.ts`'s `importPokePaste` applies to a pasted set for the same
 * reason: a single unrecognized field shouldn't hide an otherwise-usable
 * set. `ability` is carried over as free text with no validity check, same
 * as everywhere else a slot's `ability` is set (`importPokePaste`) — this
 * app has no static abilities dex to check it against in the first place.
 */
export interface CommonSet {
	name: string;
	statPoints: StatPoints;
	nature: NatureInfo;
	/**
	 * `undefined` when the vendored set doesn't specify one at all — see
	 * `RawCommonSet`. `applyCommonSet` leaves the slot's own current
	 * ability untouched in that case rather than clearing it to `null`,
	 * unlike `item`, which *is* meant to end up `null` when the set leaves
	 * it out (an intentionally itemless build).
	 */
	ability: string | undefined;
	item: HeldItem | null;
	moves: MoveSlots;
}

/** `RawCommonSet['sps']`'s abbreviated keys, in `StatPoints`'/`STAT_ORDER`'s own order. */
const RAW_STAT_KEYS = {
	hp: 'hp',
	atk: 'at',
	def: 'df',
	spa: 'sa',
	spd: 'sd',
	spe: 'sp'
} as const;

function toStatPoints(raw: RawCommonSet['sps']): StatPoints {
	const sp = emptyStatPoints();
	for (const stat of STAT_ORDER) {
		const value = raw[RAW_STAT_KEYS[stat]];
		if (typeof value === 'number') {
			sp[stat] = Math.max(0, Math.min(MAX_SP_PER_STAT, Math.round(value)));
		}
	}
	return sp;
}

function toCommonSet(name: string, raw: RawCommonSet): CommonSet {
	const moveNames = raw.moves ?? [];
	const moves: MoveSlots = [null, null, null, null];
	for (let i = 0; i < moves.length; i++) {
		const moveName = moveNames[i];
		moves[i] = moveName ? (findByName(allMoves, moveName) ?? null) : null;
	}

	return {
		name,
		statPoints: toStatPoints(raw.sps),
		nature: raw.nature ? (findByName(allNatures, raw.nature) ?? NEUTRAL_NATURE) : NEUTRAL_NATURE,
		ability: raw.ability,
		item: raw.item ? (findByName(allItems, raw.item) ?? null) : null,
		moves
	};
}

/**
 * `rawSetdex`'s own species keys are plain display names (`"Charizard"`,
 * `"Rotom-Wash"`, `"Indeedee-F"`) matching this app's own `species.name` —
 * a Mega Evolution's sets live under its *base* species instead (e.g.
 * Charizard's Mega Y sets are under `"Charizard"`, holding a Mega Stone
 * `item`, not under a `"Charizard-Mega-Y"` key of their own), so a Mega
 * gets all of its base species' sets (`megaSetsFor`) — picking one switches
 * the slot to the forme its item calls for (`TeamSlotCard`).
 */
function rawSetsByName(name: string): Record<string, RawCommonSet> | undefined {
	const setdex = rawSetdex as RawSetdex;
	const key = Object.keys(setdex).find((k) => k.toLowerCase() === name.toLowerCase());
	return key ? setdex[key] : undefined;
}

function megaSetsFor(species: SpeciesItem): Record<string, RawCommonSet> | undefined {
	const base = species.baseSpecies;
	if (!megaStoneFor(species) || !base) return undefined;
	return rawSetsByName(COMMON_SET_ALIASES[base] ?? base);
}

function rawSetsFor(species: SpeciesItem): Record<string, RawCommonSet> | undefined {
	return (
		rawSetsByName(species.name) ??
		rawSetsByName(speciesLabel(species)) ??
		(COMMON_SET_ALIASES[species.name]
			? rawSetsByName(COMMON_SET_ALIASES[species.name])
			: undefined) ??
		megaSetsFor(species)
	);
}

/**
 * Species whose sets are vendored under a different forme's name: Floette's
 * are all Floette-Eternal's (the only Floette Champions has), and Aegislash's
 * are under its bare name for both stances.
 */
const COMMON_SET_ALIASES: Record<string, string> = {
	Floette: 'Floette-Eternal',
	'Aegislash-Blade': 'Aegislash'
};

/** Every vendored common set for `species`, or `[]` if it has none. */
export function commonSetsFor(species: SpeciesItem): CommonSet[] {
	const raw = rawSetsFor(species);
	if (!raw) return [];
	return Object.entries(raw).map(([name, set]) => toCommonSet(name, set));
}

/** Whether `species` has at least one vendored common set — the "Common Sets" button's own enabled condition. */
export function hasCommonSets(species: SpeciesItem | null): boolean {
	if (!species) return false;
	const raw = rawSetsFor(species);
	return !!raw && Object.keys(raw).length > 0;
}

/**
 * Overwrites `slot`'s build fields with `set`, in place — everything
 * `importPokePaste` overwrites except `species` itself, which a common set
 * never changes (it's chosen *for* the slot's current species, unlike a
 * PokePaste import, which can bring its own different one). In-battle
 * stat stages (`boosts`) are reset to 0, same as an import, since a common
 * set is a build, not a battle state.
 */
export function applyCommonSet(slot: TeamSlot, set: CommonSet): void {
	slot.item = set.item;
	if (set.ability !== undefined) slot.ability = set.ability;
	slot.nature = set.nature;
	slot.statPoints = set.statPoints;
	slot.boosts = emptyStatBoosts();
	slot.moves = set.moves;
}
