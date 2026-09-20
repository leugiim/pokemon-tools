import { Dex } from '@pkmn/dex';
import { GEN_NUM } from '$lib/modules/shared/species/generation';
import type { MoveItem } from './moves';

const dex = Dex.forGen(GEN_NUM);

export interface MoveDescription {
	shortDesc: string;
	desc: string;
}

/**
 * A move's flavor text for `MoveCombobox`'s hover tooltip — `@smogon/calc`
 * carries no description data at all, but `@pkmn/dex`'s does, resolved
 * synchronously (unlike its learnset data, `learnsets.ts`, which is lazily
 * loaded from a separate chunk). `desc` is the longer, full-mechanics
 * text; `shortDesc` is the one-line summary Pokémon Showdown itself shows
 * first. `null` for a move `@pkmn/dex` doesn't recognize (shouldn't happen
 * for anything in `allMoves`, since both draw from the same generation of
 * Pokémon Showdown data, but this app never assumes another data source
 * agrees with `@smogon/calc`'s own move list, see `learnsets.ts`).
 */
export function descriptionOf(move: MoveItem): MoveDescription | null {
	const data = dex.moves.get(move.name);
	return data.exists ? { shortDesc: data.shortDesc, desc: data.desc } : null;
}
