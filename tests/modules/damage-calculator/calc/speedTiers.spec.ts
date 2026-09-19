import { describe, expect, it } from 'vitest';
import {
	SPEED_LISTS,
	applySpeedModifiers,
	speedGroups,
	withYou,
	championsSpecies
} from '$lib/modules/damage-calculator/calc/speedTiers';

const list = (id: string) => SPEED_LISTS.find((l) => l.id === id)!;

describe('Unburden', () => {
	it('adds a separate Unburden entry for an Unburden holder', () => {
		const entries = speedGroups(list('32'), { tailwind: false, includeAbilities: true })
			.flatMap((g) => g.entries)
			.filter((e) => e.ability === 'Unburden');
		expect(entries.length).toBeGreaterThan(0);
		expect(entries.every((e) => e.condition === 'item-consumed')).toBe(true);
	});
});

describe('Megas and Scarf', () => {
	const names = (id: string) =>
		speedGroups(list(id), { tailwind: false, includeAbilities: false })
			.flatMap((g) => g.entries)
			.map((e) => e.species.name);
	it('keeps Megas out of Scarf lists only', () => {
		expect(names('32').some((n) => n.includes('-Mega'))).toBe(true);
		expect(names('32-scarf').some((n) => n.includes('-Mega'))).toBe(false);
		expect(names('32+-scarf').some((n) => n.includes('-Mega'))).toBe(false);
	});
});

describe('applySpeedModifiers', () => {
	it('chains scarf (floored), ability and tailwind', () => {
		expect(applySpeedModifiers(101, { scarf: true })).toBe(151);
		expect(applySpeedModifiers(101, { scarf: true, abilityDouble: true, tailwind: true })).toBe(
			604
		);
	});
});

describe('speedGroups', () => {
	it('sorts fastest first and groups ties', () => {
		const groups = speedGroups(list('32'), { tailwind: false, includeAbilities: false });
		const speeds = groups.map((g) => g.speed);
		expect(speeds).toEqual([...speeds].sort((a, b) => b - a));
		expect(new Set(speeds).size).toBe(speeds.length);
	});

	it('adds a separate Chlorophyll entry for Venusaur only when abilities are on', () => {
		const find = (includeAbilities: boolean) =>
			speedGroups(list('32'), { tailwind: false, includeAbilities })
				.flatMap((g) => g.entries)
				.filter((e) => e.species.name === 'Venusaur');
		expect(find(false)).toHaveLength(1);
		const withAbility = find(true);
		expect(withAbility.some((e) => e.ability === 'Chlorophyll' && e.condition === 'sun')).toBe(
			true
		);
		expect(withAbility.some((e) => !e.ability)).toBe(true);
	});

	it('tailwind doubles every rival', () => {
		const one = speedGroups(
			list('0'),
			{ tailwind: false, includeAbilities: false },
			championsSpecies.slice(0, 1)
		);
		const two = speedGroups(
			list('0'),
			{ tailwind: true, includeAbilities: false },
			championsSpecies.slice(0, 1)
		);
		expect(two[0].speed).toBe(one[0].speed * 2);
	});
});

describe('withYou', () => {
	const groups = [10, 8, 5].map((speed) => ({ speed, entries: [] }));
	it('slots between groups', () => {
		expect(withYou(groups, 6).map((r) => r.kind)).toEqual(['group', 'group', 'you', 'group']);
	});
	it('marks a tie instead of adding a row', () => {
		expect(withYou(groups, 8).map((r) => r.kind)).toEqual(['group', 'tie', 'group']);
	});
	it('goes last when slower than everyone', () => {
		expect(withYou(groups, 1).at(-1)?.kind).toBe('you');
	});
});
