import { allSpecies, formsOf, gen } from '$lib/modules/shared/species/generation';
import type { SpeciesItem } from '$lib/modules/shared/species/generation';

/** All held items available in this generation, sorted alphabetically. */
export const allItems = [...gen.items].sort((a, b) => a.name.localeCompare(b.name));

export type HeldItem = (typeof allItems)[number];

/**
 * The names a Mega Stone's `megaStone` map may key `species` under: its
 * base species, its own name, or a sibling forme's — Floette-Eternal is a
 * forme of Floette in the data, yet Floettite is keyed by `Floette-Eternal`.
 */
function megaStoneKeys(species: SpeciesItem): SpeciesItem['name'][] {
	return [
		...(species.baseSpecies ? [species.baseSpecies] : []),
		species.name,
		...formsOf(species).map((f) => f.species.name)
	];
}

/**
 * The Mega Stone that evolves `species`' own base species into exactly
 * `species` — `null` for anything that isn't a Mega Evolution (or one
 * this generation's data doesn't carry a stone for, e.g. Meowstic's
 * hand-rolled gendered Mega, `generation.ts`'s `genderPairOf`). Each
 * `@smogon/calc` `Item.megaStone` is keyed by *base* species name (e.g.
 * `{ Charizard: 'Charizard-Mega-X' }`), covering every stone in one map
 * rather than one item per base species, so this checks each item's own
 * entry for `species.baseSpecies` against `species.name` itself rather
 * than assuming a 1:1 item/species split.
 */
export function megaStoneFor(species: SpeciesItem): HeldItem | null {
	return (
		allItems.find((item) =>
			megaStoneKeys(species).some((key) => item.megaStone?.[key] === species.name)
		) ?? null
	);
}

/**
 * The Mega form `item` turns `species` into — the reverse of `megaStoneFor`.
 * `null` when `item` isn't a Mega Stone, or isn't the stone for `species`'
 * own family (Venusaurite on Charizard). Works from a Mega form too, so
 * swapping Charizardite X for Charizardite Y on Mega Charizard X yields
 * Mega Charizard Y.
 */
export function megaFormFor(item: HeldItem, species: SpeciesItem): SpeciesItem | null {
	const megaName = megaStoneKeys(species)
		.map((key) => item.megaStone?.[key])
		.find(Boolean);
	if (!megaName || megaName === species.name) return null;
	return allSpecies.find((s) => s.name === megaName) ?? null;
}
