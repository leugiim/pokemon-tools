import { describe, expect, it } from 'vitest';
import {
	groupByMultiplier,
	matchups,
	typeMultiplier
} from '$lib/modules/damage-calculator/calc/typeMatchups';

const of = (types: string[], mods = {}) =>
	Object.fromEntries(matchups(types, mods).map((m) => [m.type, m.multiplier]));

describe('typeMultiplier', () => {
	it('multiplies both of a dual type', () => {
		expect(typeMultiplier('Ice', ['Dragon', 'Flying'])).toBe(4);
		expect(typeMultiplier('Ground', ['Fire', 'Flying'])).toBe(0);
		expect(typeMultiplier('Rock', ['Fire', 'Flying'])).toBe(4);
		expect(typeMultiplier('Grass', ['Fire', 'Water'])).toBe(1);
	});
});

describe('matchups', () => {
	it('covers the 18 types', () => {
		expect(matchups(['Normal'])).toHaveLength(18);
	});

	it('folds an ability in and reports it as the source', () => {
		expect(of(['Steel', 'Fairy']).Ground).toBe(2);
		const withFlashFire = matchups(['Fire', 'Flying'], { ability: 'Flash Fire' });
		expect(withFlashFire.find((m) => m.type === 'Fire')).toMatchObject({
			multiplier: 0,
			base: 0.5,
			source: 'Flash Fire'
		});
	});

	it('Air Balloon makes a Pokémon immune to Ground', () => {
		expect(of(['Steel'], { item: 'Air Balloon' }).Ground).toBe(0);
	});

	it('Thick Fat halves Fire and Ice on top of the chart', () => {
		const r = of(['Grass', 'Ice'], { ability: 'Thick Fat' });
		expect(r.Fire).toBe(2); // 4 × ½
		expect(r.Ice).toBe(0.5); // 1 (Grass ×2, Ice ×½) × ½
	});

	it('Wonder Guard leaves only the super effective types', () => {
		const r = of(['Ghost', 'Dark'], { ability: 'Wonder Guard' });
		expect(r.Fairy).toBe(2);
		expect(r.Normal).toBe(0);
	});
});

describe('groupByMultiplier', () => {
	it('sorts weakest first', () => {
		const groups = groupByMultiplier(matchups(['Fire', 'Flying']));
		expect(groups[0].multiplier).toBe(4);
		expect(groups.at(-1)!.multiplier).toBe(0);
	});
});
