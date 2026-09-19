import { describe, expect, it } from 'vitest';
import {
	allSpecies,
	formsOf,
	genderPairOf,
	pickableSpecies,
	speciesLabel
} from '$lib/modules/shared/species/generation';

function hasSpecies(name: string): boolean {
	return allSpecies.some((s) => s.name === name);
}

function species(name: string) {
	const s = allSpecies.find((s) => s.name === name);
	if (!s) throw new Error(`fixture species not found: ${name}`);
	return s;
}

describe('allSpecies', () => {
	it('excludes CAP/non-standard mons', () => {
		expect(hasSpecies('Syclant')).toBe(false);
		expect(hasSpecies('Aegislash-Both')).toBe(false);
	});

	it('keeps real alt formes that share a name prefix with a CAP mon check', () => {
		expect(hasSpecies('Aegislash-Blade')).toBe(true);
		expect(hasSpecies('Aegislash-Shield')).toBe(true);
	});

	it('has no duplicate species names', () => {
		const names = allSpecies.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('is sorted alphabetically', () => {
		const names = allSpecies.map((s) => s.name);
		const sorted = [...names].sort((a, b) => a.localeCompare(b));
		expect(names).toEqual(sorted);
	});
});

describe('pickableSpecies', () => {
	it('excludes Mega Evolutions and Gigantamax forms', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).not.toContain('Charizard-Mega-X');
		expect(names).not.toContain('Charizard-Mega-Y');
		expect(names).not.toContain('Charizard-Gmax');
		expect(names).toContain('Charizard');
	});

	it('keeps genuine regional forms as their own entries', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).toContain('Slowbro-Galar');
		expect(names).toContain('Ninetales-Alola');
		expect(names).toContain('Arcanine-Hisui');
	});

	it('offers Aegislash as a single entry (its default Shield stance), not two', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).toContain('Aegislash-Shield');
		expect(names).not.toContain('Aegislash-Blade');
	});

	it('folds stance/state formes into one entry (e.g. Rotom, not Rotom-Wash too)', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).toContain('Rotom');
		expect(names).not.toContain('Rotom-Wash');
		expect(names).toContain('Toxtricity');
		expect(names).not.toContain('Toxtricity-Low-Key');
	});

	it("only offers Regulation M-C's species", () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).not.toContain('Landorus');
		expect(names).not.toContain('Arceus');
		expect(names).not.toContain('Zygarde-Complete');
	});

	it('excludes Totem formes entirely — nobody can actually own one', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).not.toContain('Kommo-o-Totem');
		expect(names).not.toContain('Mimikyu-Totem');
		expect(names).not.toContain('Marowak-Alola-Totem');
	});

	it('keeps only plain Pikachu, dropping the cosmetic event caps', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).toContain('Pikachu');
		expect(names).not.toContain('Pikachu-Alola');
		expect(names).not.toContain('Pikachu-Original');
		expect(names).not.toContain('Pikachu-World');
	});

	it('keeps only one Vivillon and one Squawkabilly (purely cosmetic variants)', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).toContain('Vivillon');
		expect(names).not.toContain('Vivillon-Fancy');
		expect(names).not.toContain('Vivillon-Pokeball');
		expect(names).toContain('Squawkabilly');
		expect(names).not.toContain('Squawkabilly-Blue');
	});

	it('keeps only the male entry point for gender-based species', () => {
		const names = pickableSpecies.map((s) => s.name);
		expect(names).toContain('Meowstic');
		expect(names).not.toContain('Meowstic-F');
		expect(names).not.toContain('Meowstic-F-Mega');
		expect(names).not.toContain('Meowstic-M-Mega');
		expect(names).toContain('Indeedee');
		expect(names).not.toContain('Indeedee-F');
	});
});

describe('speciesLabel', () => {
	it('shows plain "Aegislash", not "Aegislash-Shield"', () => {
		expect(speciesLabel(species('Aegislash-Shield'))).toBe('Aegislash');
	});

	it('is just the name for every other species', () => {
		expect(speciesLabel(species('Charizard'))).toBe('Charizard');
		expect(speciesLabel(species('Aegislash-Blade'))).toBe('Aegislash-Blade');
	});
});

describe('formsOf', () => {
	it('lists Normal plus every Mega form for a species that has them', () => {
		const forms = formsOf(species('Charizard'));
		expect(forms.map((f) => f.label)).toEqual(['Normal', 'Mega X', 'Mega Y']);
		expect(forms[0].species.name).toBe('Charizard');
	});

	it('gives the same list regardless of which form in the family you start from', () => {
		const fromMegaX = formsOf(species('Charizard-Mega-X'));
		const fromBase = formsOf(species('Charizard'));
		expect(fromMegaX.map((f) => f.species.name)).toEqual(fromBase.map((f) => f.species.name));
	});

	it('is just a single (disabled-worthy) Normal entry for a species with no Mega/Gmax', () => {
		expect(formsOf(species('Bulbasaur'))).toEqual([
			{ label: 'Normal', species: species('Bulbasaur') }
		]);
	});

	it("doesn't fold a regional form into its root species' Mega list", () => {
		// Meowth-Galar shares Meowth's baseSpecies grouping but has no Mega
		// of its own to inherit — and neither does base Meowth itself.
		expect(formsOf(species('Meowth-Galar'))).toEqual([
			{ label: 'Normal', species: species('Meowth-Galar') }
		]);
		expect(formsOf(species('Meowth'))).toEqual([{ label: 'Normal', species: species('Meowth') }]);
	});

	it('hand-rolls Shield/Blade for Aegislash, whose data has no plain "Aegislash" to split against', () => {
		const expected = [
			{ label: 'Shield', species: species('Aegislash-Shield') },
			{ label: 'Blade', species: species('Aegislash-Blade') }
		];
		expect(formsOf(species('Aegislash-Shield'))).toEqual(expected);
		expect(formsOf(species('Aegislash-Blade'))).toEqual(expected);
	});

	it('lists all 18 types for Arceus, Normal first', () => {
		const forms = formsOf(species('Arceus'));
		expect(forms).toHaveLength(18);
		expect(forms[0]).toEqual({ label: 'Normal', species: species('Arceus') });
		expect(forms.map((f) => f.label)).toContain('Fire');
		expect(forms.find((f) => f.label === 'Fire')?.species.name).toBe('Arceus-Fire');
	});

	it("keeps Kantonian and Galarian Darmanitan's Zen formes in separate families", () => {
		expect(formsOf(species('Darmanitan')).map((f) => f.species.name)).toEqual([
			'Darmanitan',
			'Darmanitan-Zen'
		]);
		expect(formsOf(species('Darmanitan-Galar')).map((f) => f.species.name)).toEqual([
			'Darmanitan-Galar',
			'Darmanitan-Galar-Zen'
		]);
	});

	it("gives each Meowstic gender its own Mega, not the other's", () => {
		expect(formsOf(species('Meowstic')).map((f) => f.species.name)).toEqual([
			'Meowstic',
			'Meowstic-M-Mega'
		]);
		expect(formsOf(species('Meowstic-F')).map((f) => f.species.name)).toEqual([
			'Meowstic-F',
			'Meowstic-F-Mega'
		]);
	});
});

describe('genderPairOf', () => {
	it('finds the pair from either the male or the female side', () => {
		const fromMale = genderPairOf(species('Indeedee'));
		const fromFemale = genderPairOf(species('Indeedee-F'));
		expect(fromMale).toEqual({ male: species('Indeedee'), female: species('Indeedee-F') });
		expect(fromFemale).toEqual(fromMale);
	});

	it("keeps each Meowstic Mega's gender pair separate from its Normal-forme pair", () => {
		expect(genderPairOf(species('Meowstic-M-Mega'))).toEqual({
			male: species('Meowstic-M-Mega'),
			female: species('Meowstic-F-Mega')
		});
	});

	it('is null for a species with no gender-based forme', () => {
		expect(genderPairOf(species('Charizard'))).toBeNull();
	});
});
