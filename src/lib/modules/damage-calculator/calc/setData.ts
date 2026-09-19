import type { PokemonSetData } from '$lib/modules/shared';
import { clampStatPoints, emptyStatPointsData } from '$lib/modules/shared';
import type { MoveSlots, TeamSlot } from '../stores/team.svelte';
import { allNatures, emptyStatBoosts, emptyStatPoints, NEUTRAL_NATURE, STAT_ORDER } from './format';
import { allSpecies, type SpeciesItem } from '$lib/modules/shared/species/generation';
import { allItems } from './items';
import { allMoves } from './moves';
import { findByName } from './pokepaste';

/**
 * Turns a `TeamSlot` into plain data. `null` for an empty slot (no
 * species). The nickname isn't kept (a slot has none), and neither are the
 * "what if" fields (stat stages, fainted allies, per-move crit/hit-count):
 * they aren't part of the build.
 */
export function slotToData(slot: TeamSlot): PokemonSetData | null {
	if (!slot.species) return null;

	const statPoints = emptyStatPointsData();
	for (const stat of STAT_ORDER) statPoints[stat] = slot.statPoints[stat];

	const data: PokemonSetData = {
		species: slot.species.name,
		statPoints,
		moves: slot.moves.filter((move) => move !== null).map((move) => move.name)
	};
	if (slot.item) data.item = slot.item.name;
	if (slot.ability) data.ability = slot.ability;
	// A neutral nature is the default, so there's nothing to keep.
	if (slot.nature.name !== NEUTRAL_NATURE.name) data.nature = slot.nature.name;
	return data;
}

/**
 * Overwrites `slot` with `data`, in place — species first, since its setter
 * voids item/ability/nature/Stat Points/moves for a different Pokémon, then
 * every other field explicitly so nothing from the previous build survives.
 * Stat stages and the other "what ifs" are reset.
 *
 * Names are matched against this app's own data (`findByName`, exact then
 * case-insensitive). A name that doesn't match is skipped instead of failing
 * the whole set, and reported in the returned list (e.g. `item: "Foo"`), so
 * a caller can tell the reader. An unknown species leaves the slot empty.
 */
export function applySetData(slot: TeamSlot, data: PokemonSetData): string[] {
	const issues: string[] = [];

	const species = findByName<SpeciesItem>(allSpecies, data.species);
	slot.species = species ?? null;
	if (!species) {
		issues.push(`species: "${data.species}"`);
		return issues;
	}

	if (data.item) {
		const item = findByName(allItems, data.item);
		if (!item) issues.push(`item: "${data.item}"`);
		slot.item = item ?? null;
	} else {
		slot.item = null;
	}

	slot.ability = data.ability ?? null;

	if (data.nature) {
		const nature = findByName(allNatures, data.nature);
		if (!nature) issues.push(`nature: "${data.nature}"`);
		slot.nature = nature ?? NEUTRAL_NATURE;
	} else {
		slot.nature = NEUTRAL_NATURE;
	}

	const statPoints = emptyStatPoints();
	for (const stat of STAT_ORDER) statPoints[stat] = clampStatPoints(data.statPoints[stat] ?? 0);
	slot.statPoints = statPoints;
	slot.boosts = emptyStatBoosts();
	slot.currentType = null;

	const moves: MoveSlots = [null, null, null, null];
	data.moves.slice(0, moves.length).forEach((name, i) => {
		const move = findByName(allMoves, name);
		if (!move) issues.push(`move: "${name}"`);
		moves[i] = move ?? null;
	});
	slot.moves = moves;

	return issues;
}
