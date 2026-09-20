import { Dex } from '@pkmn/dex';
import { Learnsets as championsLearnsets } from '@pkmn/mods/champions';
import { GEN_NUM, toID, type SpeciesItem } from '$lib/modules/shared/species/generation';
import { allMoves, type MoveItem } from './moves';

// See `pkmn-mods.d.ts` for why `@pkmn/mods/champions` needs a hand-rolled
// ambient declaration to resolve at all under this project's TS config.

const dex = Dex.forGen(GEN_NUM);

/** `dex.learnsets.get`'s resolved type — not itself exported by `@pkmn/dex`. */
type Learnset = Awaited<ReturnType<typeof dex.learnsets.get>>;

/**
 * A handful of hand-rolled forme families (`generation.ts`'s
 * `FORM_FAMILIES`) have no plain, unprefixed species for either learnset
 * source below to key off — Aegislash has no bare "Aegislash" species in
 * `@smogon/calc`'s own data for `learnsetOf`'s `baseSpecies` fallback to
 * chase (same data quirk `abilities.ts`'s `SLUG_OVERRIDES` works around for
 * PokeAPI), but both `@pkmn/mods` and `@pkmn/dex` have one, and it's the
 * same moveset both stances share. Verified by hand against the real data:
 * every other species this app can pick resolves cleanly through its own
 * name or `baseSpecies`, so this is the only override needed.
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
 * species-aware move picker. Results are cached per species name, same
 * convention as `abilities.ts`'s `abilitiesOf`. See `learnsetOf` for where
 * the data actually comes from.
 */
export function movesOf(species: SpeciesItem): Promise<MoveItem[]> {
	const cached = cache.get(species.name);
	if (cached) return cached;

	const promise = learnsetOf(species).then((ids) => allMoves.filter((m) => ids.has(toID(m.name))));
	cache.set(species.name, promise);
	return promise;
}

/**
 * The move IDs `species` can currently learn, preferring a real Pokémon
 * Champions learnset (`@pkmn/mods`'s `champions` mod, `championsLearnsets`)
 * over `@pkmn/dex`'s plain Scarlet/Violet one wherever it has an entry —
 * Champions genuinely isn't SV's movepool with a few numbers patched, the
 * way base power is (`moves.ts`'s `effectiveBasePower`): it's a flat,
 * TM-only teach system with no level-up/egg/tutor moves at all (every
 * source in `championsLearnsets` is tagged `"9M"`, confirmed by hand
 * against the whole file), so e.g. Pikachu can Champions-teach Volt Tackle
 * (an SV egg-only move) but not Tera Blast (SV has no equivalent
 * restriction, Champions apparently doesn't give it out).
 *
 * `championsLearnsets` doesn't yet cover Pokémon Champions' entire roster
 * (~90% of it, verified by hand — the remainder is presumably still being
 * added as the game itself grows), so a species without an entry there
 * falls back to `svLearnsetOf`'s Scarlet/Violet-based approximation
 * instead of going empty.
 */
async function learnsetOf(species: SpeciesItem): Promise<Set<string>> {
	const name = LEARNSET_NAME_OVERRIDES[species.name] ?? species.name;
	const champions = championsMoveIds(name) ?? championsMoveIds(species.baseSpecies);
	if (champions) return champions;
	return svLearnsetOf(name, species.baseSpecies);
}

/**
 * `championsLearnsets`' move IDs for `name`, or `undefined` when it has no
 * entry (an unknown species, or `name` itself being `undefined` — the
 * `baseSpecies`-less case, so `learnsetOf` can pass it through unchecked).
 */
function championsMoveIds(name: string | undefined): Set<string> | undefined {
	if (!name) return undefined;
	const entry = championsLearnsets[toID(name)];
	return entry?.learnset ? new Set(Object.keys(entry.learnset)) : undefined;
}

/**
 * The Scarlet/Violet-based approximation `learnsetOf` falls back to for a
 * species `championsLearnsets` doesn't cover yet: `@pkmn/dex`'s own
 * bundled learnset data (`Dex#learnsets`, lazily loaded from its ~475KB
 * data chunk on first call, not a network fetch), filtered to
 * `idsLearnableNow`. Own name first, then `baseSpecies` for a battle-only/
 * stance forme with no separate entry of its own (Mega Evolutions,
 * Terapagos-Stellar, ...) — `@pkmn/dex`'s data doesn't duplicate an entry
 * per forme when the movepool doesn't actually change with it.
 */
async function svLearnsetOf(name: string, baseSpecies?: string): Promise<Set<string>> {
	const own = await dex.learnsets.get(name);
	if (own.exists || !baseSpecies) return idsLearnableNow(own);
	return idsLearnableNow(await dex.learnsets.get(baseSpecies));
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
 * (Absol, Aerodactyl, Aggron, ... — verified by hand, and every one of
 * these is also a species `championsLearnsets` doesn't cover, or this
 * fallback would never run for it), and an empty picker is worse than
 * occasionally offering a move that generation can no longer actually
 * re-teach.
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
