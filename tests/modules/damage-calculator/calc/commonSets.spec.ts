import { describe, expect, it } from 'vitest';
import {
	applyCommonSet,
	commonSetsFor,
	hasCommonSets,
	type CommonSet
} from '$lib/modules/damage-calculator/calc/commonSets';
import { allSpecies } from '$lib/modules/shared/species/generation';
import { TeamSlot } from '$lib/modules/damage-calculator/stores/team.svelte';

function species(name: string) {
	const s = allSpecies.find((s) => s.name === name);
	if (!s) throw new Error(`unknown species in test data: ${name}`);
	return s;
}

function setNamed(sets: CommonSet[], name: string): CommonSet {
	const set = sets.find((s) => s.name === name);
	if (!set) throw new Error(`unknown common set in test data: ${name}`);
	return set;
}

describe('hasCommonSets', () => {
	it('is true for a species the vendored setdex has sets for', () => {
		expect(hasCommonSets(species('Absol'))).toBe(true);
	});

	it("is false for a species the vendored setdex doesn't cover", () => {
		expect(hasCommonSets(species('Bulbasaur'))).toBe(false);
	});

	it('is false for no species selected', () => {
		expect(hasCommonSets(null)).toBe(false);
	});
});

describe('commonSetsFor', () => {
	it('is [] for a species with no vendored sets', () => {
		expect(commonSetsFor(species('Bulbasaur'))).toEqual([]);
	});

	it("resolves a set's item/ability/nature/moves against this app's own data", () => {
		const set = setNamed(commonSetsFor(species('Absol')), 'Mega Z Offense');
		expect(set.item?.name).toBe('Absolite Z');
		expect(set.ability).toBe('Justified');
		expect(set.nature.name).toBe('Jolly');
		expect(set.moves.map((m) => m?.name)).toEqual([
			'Night Slash',
			'Shadow Claw',
			'Close Combat',
			'Psycho Cut'
		]);
	});

	it("maps the vendored sps abbreviations (at/df/sa/sd/sp) onto this app's own StatPoints keys", () => {
		const set = setNamed(commonSetsFor(species('Absol')), 'Mega Z Offense');
		expect(set.statPoints).toEqual({ hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
	});

	it('is undefined (not null) for a set that leaves ability out entirely', () => {
		const set = setNamed(commonSetsFor(species('Charizard')), 'Physically Bulky Mega Y');
		expect(set.ability).toBeUndefined();
	});

	it('is null for a set that leaves item out as a deliberate itemless build', () => {
		const set = setNamed(commonSetsFor(species('Talonflame')), 'Itemless Acrobatics');
		expect(set.item).toBeNull();
	});

	it("lists a Mega Evolution's sets from its base species, all of them", () => {
		// Charizard's Mega Y sets live under "Charizard" in the vendored
		// data, not a "Charizard-Mega-Y" key of their own (ADR-0006).
		const sets = commonSetsFor(species('Charizard'));
		expect(sets.some((s) => s.item?.name === 'Charizardite Y')).toBe(true);

		const mega = commonSetsFor(species('Charizard-Mega-Y'));
		expect(mega.map((s) => s.name)).toEqual(sets.map((s) => s.name));
	});
});

describe('applyCommonSet', () => {
	it("overwrites the slot's build fields but leaves species and boosts alone (boosts reset to 0)", () => {
		const slot = new TeamSlot();
		slot.species = species('Absol');
		slot.boosts.atk = 2;
		const set = setNamed(commonSetsFor(species('Absol')), 'Mega Z Offense');

		applyCommonSet(slot, set);

		expect(slot.species).toBe(species('Absol'));
		expect(slot.item?.name).toBe('Absolite Z');
		expect(slot.ability).toBe('Justified');
		expect(slot.nature.name).toBe('Jolly');
		expect(slot.statPoints).toEqual(set.statPoints);
		expect(slot.moves.map((m) => m?.name)).toEqual(set.moves.map((m) => m?.name));
		expect(slot.boosts.atk).toBe(0);
	});

	it("leaves the slot's current ability untouched when the set doesn't specify one", () => {
		const slot = new TeamSlot();
		slot.species = species('Charizard');
		slot.ability = 'Blaze';
		const set = setNamed(commonSetsFor(species('Charizard')), 'Physically Bulky Mega Y');

		applyCommonSet(slot, set);

		expect(slot.ability).toBe('Blaze');
		expect(slot.item?.name).toBe('Charizardite Y');
	});
});
