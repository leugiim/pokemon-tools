import { Dex } from '@pkmn/dex';
import { GEN_NUM, toID, type SpeciesItem } from '$lib/modules/shared/species/generation';
import { allMoves, type MoveItem } from './moves';

const dex = Dex.forGen(GEN_NUM);

/** `dex.learnsets.get`'s resolved type — not itself exported by `@pkmn/dex`. */
type Learnset = Awaited<ReturnType<typeof dex.learnsets.get>>;

/**
 * A handful of hand-rolled forme families (`generation.ts`'s
 * `FORM_FAMILIES`) have no plain, unprefixed species for `@pkmn/dex`'s
 * learnset data to key off — Aegislash has no bare "Aegislash" species in
 * `@smogon/calc`'s own data for `learnsetOf`'s `baseSpecies` fallback below
 * to chase (same data quirk `abilities.ts`'s `SLUG_OVERRIDES` works around
 * for PokeAPI), but `@pkmn/dex` does have one, and it's the same moveset
 * both stances share. Verified by hand against the real data: every other
 * species this app can pick resolves cleanly through its own name or
 * `baseSpecies`, so this is the only override needed.
 */
const LEARNSET_NAME_OVERRIDES: Record<string, string> = {
	'Aegislash-Shield': 'Aegislash',
	'Aegislash-Blade': 'Aegislash'
};

/** The generation-9 source prefix a move's `MoveSource` entries are tagged with. */
const GEN_PREFIX = String(GEN_NUM);

const cache = new Map<string, Promise<MoveItem[]>>();

/**
 * The moves `species` can currently learn — `MoveCombobox`'s pool for a
 * species-aware move picker, sourced from `@pkmn/dex`'s own bundled
 * learnset data (`Dex#learnsets`, lazily loaded from its ~475KB data chunk
 * on first call, not a network fetch). Results are cached per species name,
 * same convention as `abilities.ts`'s `abilitiesOf`.
 *
 * Champions has no learnset data of its own to draw from (too recent a
 * game for `@pkmn/dex` to carry it yet) — this uses Scarlet/Violet's, the
 * same proxy `championsGen` itself falls back to elsewhere for move data
 * it doesn't have a Champions-specific patch for (`moves.ts`'s
 * `effectiveBasePower`).
 */
export function movesOf(species: SpeciesItem): Promise<MoveItem[]> {
	const cached = cache.get(species.name);
	if (cached) return cached;

	const promise = learnsetOf(species).then((ids) => allMoves.filter((m) => ids.has(toID(m.name))));
	cache.set(species.name, promise);
	return promise;
}

/**
 * The move IDs `species` can currently learn: its own learnset, or — for a
 * battle-only/stance forme with no separate entry of its own (Mega
 * Evolutions, Aegislash's stances, Terapagos-Stellar, ...) — its
 * `baseSpecies`'s, which is the same moveset in every such case
 * (`@pkmn/dex`'s learnset data simply doesn't duplicate an entry per forme
 * when the movepool doesn't actually change with it).
 */
async function learnsetOf(species: SpeciesItem): Promise<Set<string>> {
	const override = LEARNSET_NAME_OVERRIDES[species.name];
	const own = await dex.learnsets.get(override ?? species.name);
	if (own.exists || !species.baseSpecies) return idsLearnableNow(own);
	return idsLearnableNow(await dex.learnsets.get(species.baseSpecies));
}

/**
 * A learnset's move IDs whose `MoveSource` includes one tagged for the
 * current generation — any method (level-up, TM, tutor, egg, event, HOME
 * transfer) counts, the same convention Pokémon Showdown's own team
 * builder uses to decide "learnable this gen", since a `MoveSource` array
 * accumulates every generation a move has ever been obtainable in, not
 * just the current one.
 *
 * Falls back to the species' *entire* historical movepool when it has a
 * real learnset but not one single gen-9-tagged move anywhere in it —
 * `@pkmn/dex`'s bundled data hasn't been updated with current-gen tags for
 * every species Scarlet/Violet's DLC later added back via HOME transfer
 * (Absol, Aerodactyl, Aggron, ... — verified by hand: ~40% of Pokémon
 * Champions' actual roster hits this, not a handful of edge cases), and an
 * empty picker for that many species is worse than occasionally offering a
 * move that generation can no longer actually re-teach.
 */
function idsLearnableNow(learnset: Learnset): Set<string> {
	const entries = Object.entries(learnset.learnset ?? {});
	const gen9 = new Set<string>();
	for (const [moveId, sources] of entries) {
		if (sources.some((s) => s.startsWith(GEN_PREFIX))) gen9.add(moveId);
	}
	if (gen9.size > 0 || entries.length === 0) return gen9;
	return new Set(entries.map(([moveId]) => moveId));
}
