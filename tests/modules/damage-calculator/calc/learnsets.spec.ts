import { describe, expect, it } from 'vitest';
import { movesOf } from '$lib/modules/damage-calculator/calc/learnsets';
import { allSpecies } from '$lib/modules/shared/species/generation';

function species(name: string) {
	const s = allSpecies.find((s) => s.name === name);
	if (!s) throw new Error(`unknown species in test data: ${name}`);
	return s;
}

function names(moves: Awaited<ReturnType<typeof movesOf>>): string[] {
	return moves.map((m) => m.name);
}

describe('movesOf', () => {
	it("prefers @pkmn/mods' real Champions learnset over Scarlet/Violet's", async () => {
		// Champions' own data (Pikachu's own entry there, verified by hand)
		// teaches Volt Tackle (an SV egg-only move, never a TM/tutor there)
		// but not Tera Blast (a universal SV TM) — a real divergence, not
		// just a subset, so this can't be passing by falling back to SV.
		const pikachu = names(await movesOf(species('Pikachu')));
		expect(pikachu).toContain('Volt Tackle');
		expect(pikachu).not.toContain('Tera Blast');
	});

	it("shares its base species' moves for a battle-only forme (Mega Evolution) with no Champions entry of its own", async () => {
		const charizard = await movesOf(species('Charizard'));
		const megaX = await movesOf(species('Charizard-Mega-X'));
		expect(names(megaX)).toEqual(names(charizard));
		expect(names(megaX)).toContain('Flamethrower');
	});

	it('resolves Aegislash-Shield and Aegislash-Blade to the same, plain-"Aegislash" Champions moveset', async () => {
		// Neither has its own entry in @pkmn/mods' data (see
		// LEARNSET_NAME_OVERRIDES) — verified by hand.
		const shield = await movesOf(species('Aegislash-Shield'));
		const blade = await movesOf(species('Aegislash-Blade'));
		expect(names(blade)).toEqual(names(shield));
		expect(names(shield)).toContain("King's Shield");
	});

	it("falls back to @pkmn/dex's Scarlet/Violet learnset for a species @pkmn/mods' Champions data doesn't cover yet", async () => {
		// Salamence has no entry at all in @pkmn/mods' champions Learnsets
		// (verified by hand — it's part of the ~10% of Regulation M-C's
		// roster that data hasn't caught up with), so this exercises
		// svLearnsetOf end to end rather than the Champions-mod path.
		const salamence = names(await movesOf(species('Salamence')));
		expect(salamence).toContain('Dragon Claw');
	});

	it('falls back further, to the full historical movepool, for a species @pkmn/dex has no current-gen tags for either', async () => {
		// Absol has no @pkmn/mods entry, and its @pkmn/dex learnset (as of
		// this data snapshot) has no single move tagged for the current
		// generation — a species Scarlet/Violet's DLC added back via HOME
		// transfer that neither source has fully caught up with. Its
		// signature moves must still show up rather than an empty list.
		const absol = names(await movesOf(species('Absol')));
		expect(absol).toContain('Sucker Punch');
		expect(absol).toContain('Night Slash');
	});

	it('caches the result for repeated calls on the same species', async () => {
		const first = await movesOf(species('Bulbasaur'));
		const second = await movesOf(species('Bulbasaur'));
		expect(second).toBe(first);
	});
});
