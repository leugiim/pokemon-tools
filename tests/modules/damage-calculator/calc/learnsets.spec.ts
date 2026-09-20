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
	it('only includes moves the species can actually learn', async () => {
		const pikachu = names(await movesOf(species('Pikachu')));
		expect(pikachu).toContain('Thunderbolt');
		expect(pikachu).not.toContain('Leaf Storm');
	});

	it("shares its base species' moves for a battle-only forme (Mega Evolution)", async () => {
		const charizard = await movesOf(species('Charizard'));
		const megaX = await movesOf(species('Charizard-Mega-X'));
		expect(names(megaX)).toEqual(names(charizard));
		expect(names(megaX)).toContain('Flamethrower');
	});

	it('resolves Aegislash-Shield and Aegislash-Blade to the same, plain-"Aegislash" moveset', async () => {
		// Neither has its own entry in @pkmn/dex's data (see
		// LEARNSET_NAME_OVERRIDES) — verified by hand.
		const shield = await movesOf(species('Aegislash-Shield'));
		const blade = await movesOf(species('Aegislash-Blade'));
		expect(names(blade)).toEqual(names(shield));
		expect(names(shield)).toContain("King's Shield");
	});

	it('falls back to the full historical movepool for a species @pkmn/dex has no current-gen tags for', async () => {
		// Absol's own learnset entry exists, but (as of this data snapshot)
		// has no single move tagged for the current generation — a Pokémon
		// Champions DLC-only species @pkmn/dex hasn't caught up with yet.
		// Its signature moves must still show up rather than an empty list.
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
