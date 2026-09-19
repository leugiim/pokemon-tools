import { Sets, type PokemonSet } from '@pkmn/sets';
import type { MoveSlots, TeamSlot } from '../stores/team.svelte';
import {
	allNatures,
	emptyStatBoosts,
	emptyStatPoints,
	LEVEL,
	MAX_SP_PER_STAT,
	NEUTRAL_NATURE,
	STAT_ORDER
} from './format';
import { allSpecies, type SpeciesItem } from '$lib/modules/shared/species/generation';
import { allItems } from './items';
import { allMoves } from './moves';

/**
 * Renders `slot` as a PokePaste/Showdown-export text block — the same
 * format `pokepast.es` and Pokemon Showdown's own team builder produce.
 * `@pkmn/sets`'s `Sets.exportSet` optionally takes a `Data` implementation
 * (e.g. `@pkmn/dex`) to resolve species/item/ability/move *IDs* into
 * display names, but this app never needs it: every field a `TeamSlot`
 * tracks is already a display name, not an ID, so there'd be nothing for
 * `data` to resolve — pulling in `@pkmn/dex` just for that would be a
 * second, unused data source alongside `@smogon/calc`'s own.
 *
 * `statPoints` is put straight into the `EVs:` line as-is (0-32 per stat)
 * rather than converted to the real-game 0-252 EV `toSmogonPokemon` feeds
 * `@smogon/calc` (`damage.ts`'s `toEvs`) — a pasted "EVs: 32 Atk" is a
 * Stat Point value to read back into this app, not a real EV investment,
 * and converting it would misrepresent it as one to anything else that
 * reads this paste.
 *
 * IVs are omitted entirely rather than set to 31 — `exportSet` treats
 * both the same (an `IVs:` line only appears for a non-31 value), and
 * this app has no IV customization to ever make that not true (`FIXED_IV`,
 * `format.ts`). Gender is omitted too: this app only tracks a species
 * *forme* pair for the handful of gender-differentiated formes (Meowstic's
 * Mega, `genderPairOf`), already reflected in the exported species name
 * itself, not a general per-slot gender a `gender:` line would add.
 */
export function exportPokePaste(slot: TeamSlot): string {
	if (!slot.species) throw new Error('exportPokePaste: slot has no species selected');

	const set: Partial<PokemonSet> = {
		species: slot.species.name,
		item: slot.item?.name,
		ability: slot.ability ?? undefined,
		moves: slot.moves.filter((move) => move !== null).map((move) => move.name),
		nature: slot.nature.name,
		evs: slot.statPoints,
		level: LEVEL
	};

	return Sets.exportSet(set).trim();
}

/**
 * The first exact (or, failing that, case-insensitive) name match in
 * `items` — this app's own data, keyed by display name, matches how
 * `@pkmn/sets` hands back an unresolved paste's fields (see
 * `exportPokePaste`'s own doc comment). Exported for `commonSets.ts`,
 * which resolves the same kind of free-text name against the same data —
 * a common (vendored, third-party) set's item/ability/nature/move names
 * are no more guaranteed to match this app's own casing than a pasted
 * one's are.
 */
export function findByName<T extends { name: string }>(
	items: readonly T[],
	name: string
): T | undefined {
	return (
		items.find((item) => item.name === name) ??
		items.find((item) => item.name.toLowerCase() === name.toLowerCase())
	);
}

/**
 * Parses `text` as a PokePaste/Showdown-export block (`@pkmn/sets`'s
 * `Sets.importSet`, no `Data` implementation needed — see `exportPokePaste`)
 * and overwrites `slot` with whatever it finds, in place — species first
 * (its own setter voids item/ability/nature/Stat Points/moves for a
 * genuinely different Pokemon, `team.svelte.ts`), then every other field
 * explicitly, so nothing from `slot`'s previous build survives by
 * accident. Stat stages (`boosts`) aren't part of a set at all (a battle-
 * time thing, not a build spec) and are always reset to 0.
 *
 * Item/ability/nature/moves that don't match this app's own data are
 * dropped silently (`findByName` returning `undefined`) rather than
 * failing the whole import — a single unrecognized field shouldn't block
 * everything else a paste got right. Species is the one exception: with
 * no species there's nothing left to import at all, so that throws.
 *
 * The `EVs:` line is read back as raw Stat Points (0-32, clamped) exactly
 * as `exportPokePaste` wrote it — never scaled as if it were a real
 * 0-252 EV, so exporting a slot and re-importing that same text round-
 * trips its Stat Points exactly.
 */
export function importPokePaste(slot: TeamSlot, text: string): void {
	const parsed = Sets.importSet(text);
	if (!parsed.species) throw new Error('importPokePaste: no species found in the pasted text');

	const species = findByName<SpeciesItem>(allSpecies, parsed.species);
	if (!species) throw new Error(`importPokePaste: unrecognized species "${parsed.species}"`);

	slot.species = species;
	slot.item = parsed.item ? (findByName(allItems, parsed.item) ?? null) : null;
	slot.ability = parsed.ability ?? null;
	slot.nature = parsed.nature
		? (findByName(allNatures, parsed.nature) ?? NEUTRAL_NATURE)
		: NEUTRAL_NATURE;
	slot.boosts = emptyStatBoosts();
	slot.currentType = null;

	const statPoints = emptyStatPoints();
	if (parsed.evs) {
		for (const stat of STAT_ORDER) {
			const value = parsed.evs[stat];
			if (typeof value === 'number') {
				statPoints[stat] = Math.max(0, Math.min(MAX_SP_PER_STAT, Math.round(value)));
			}
		}
	}
	slot.statPoints = statPoints;

	const moveNames = (parsed.moves ?? []).filter((name): name is string => !!name);
	const moves: MoveSlots = [null, null, null, null];
	for (let i = 0; i < moves.length; i++) {
		const name = moveNames[i];
		moves[i] = name ? (findByName(allMoves, name) ?? null) : null;
	}
	slot.moves = moves;
}
