import { describe, expect, it } from 'vitest';
import { allItems, megaFormFor, megaStoneFor } from '$lib/modules/damage-calculator/calc/items';
import { hasCommonSets } from '$lib/modules/damage-calculator/calc/commonSets';
import { allSpecies, formsOf, pickableSpecies } from '$lib/modules/shared/species/generation';
import { championsSpecies } from '$lib/modules/damage-calculator/calc/speedTiers';

const species = (name: string) => allSpecies.find((s) => s.name === name)!;

describe('Regulation M-C picker', () => {
	it('only offers Champions species, one entry per Floette family', () => {
		const champions = new Set(championsSpecies.map((s) => s.name));
		const names = pickableSpecies.map((s) => s.name);
		expect(names.filter((n) => n.startsWith('Floette'))).toEqual(['Floette']);
		expect(names).toContain('Incineroar');
		for (const s of pickableSpecies) {
			if (s.name !== 'Floette') expect(champions.has(s.name)).toBe(true);
		}
	});
});

describe('Floette', () => {
	it('has Eternal and Mega as formes', () => {
		expect(formsOf(species('Floette-Eternal')).map((f) => f.label)).toEqual([
			'Normal',
			'Eternal',
			'Mega'
		]);
	});
	it('finds the common sets vendored under Floette-Eternal from any of them', () => {
		for (const n of ['Floette', 'Floette-Eternal']) {
			expect(hasCommonSets(species(n))).toBe(true);
		}
	});
	it('links Floettite to the Mega and back', () => {
		const stone = allItems.find((i) => i.name === 'Floettite')!;
		expect(megaStoneFor(species('Floette-Mega'))?.name).toBe('Floettite');
		expect(megaFormFor(stone, species('Floette-Eternal'))?.name).toBe('Floette-Mega');
	});
});

describe('common sets by forme', () => {
	it('finds Aegislash and Mega sets', () => {
		expect(hasCommonSets(species('Aegislash-Shield'))).toBe(true);
		expect(hasCommonSets(species('Aegislash-Blade'))).toBe(true);
		expect(hasCommonSets(species('Charizard-Mega-X'))).toBe(true);
		expect(hasCommonSets(species('Floette-Mega'))).toBe(true);
	});
});
