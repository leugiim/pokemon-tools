import { gen } from '$lib/modules/shared/species/generation';

/** The 18 attacking types, in the games' usual order. */
export const ATTACK_TYPES = [
	'Normal',
	'Fire',
	'Water',
	'Electric',
	'Grass',
	'Ice',
	'Fighting',
	'Poison',
	'Ground',
	'Flying',
	'Psychic',
	'Bug',
	'Rock',
	'Ghost',
	'Dragon',
	'Dark',
	'Steel',
	'Fairy'
];

/**
 * How an ability or item changes the damage a Pokémon takes from a type,
 * on top of the type chart: `0` is an immunity (or an absorb), other values
 * multiply. Only what a type-based Matchups view can show; anything that
 * depends on the move (Fluffy's contact, Filter's super-effective cut) isn't
 * modelled.
 */
export const DEFENSIVE_ABILITY_EFFECTS: Record<string, Record<string, number>> = {
	Levitate: { Ground: 0 },
	'Earth Eater': { Ground: 0 },
	'Flash Fire': { Fire: 0 },
	'Well-Baked Body': { Fire: 0 },
	'Water Absorb': { Water: 0 },
	'Storm Drain': { Water: 0 },
	'Dry Skin': { Water: 0, Fire: 1.25 },
	'Volt Absorb': { Electric: 0 },
	'Lightning Rod': { Electric: 0 },
	'Motor Drive': { Electric: 0 },
	'Sap Sipper': { Grass: 0 },
	'Thick Fat': { Fire: 0.5, Ice: 0.5 },
	Heatproof: { Fire: 0.5 },
	'Water Bubble': { Fire: 0.5 },
	'Purifying Salt': { Ghost: 0.5 }
};

export const DEFENSIVE_ITEM_EFFECTS: Record<string, Record<string, number>> = {
	'Air Balloon': { Ground: 0 }
};

export interface Matchup {
	type: string;
	/** Damage multiplier of `type` against the defender, after any ability/item. */
	multiplier: number;
	/** What the types alone give, before any ability/item. */
	base: number;
	/** The ability or item that changed it, when one did. */
	source?: string;
}

/** The type chart's multiplier for an attack of `attackType` into `defenderTypes`. */
export function typeMultiplier(attackType: string, defenderTypes: string[]): number {
	const chart = gen.types.get(attackType.toLowerCase() as never)?.effectiveness as
		Record<string, number> | undefined;
	if (!chart) return 1;
	return defenderTypes.reduce((acc, t) => acc * (chart[t] ?? 1), 1);
}

/**
 * All 18 attacking types against a Pokémon with `defenderTypes`, with its
 * ability and item folded in when given.
 */
export function matchups(
	defenderTypes: string[],
	mods: { ability?: string | null; item?: string | null } = {}
): Matchup[] {
	const ability = mods.ability ? DEFENSIVE_ABILITY_EFFECTS[mods.ability] : undefined;
	const item = mods.item ? DEFENSIVE_ITEM_EFFECTS[mods.item] : undefined;
	const wonderGuard = mods.ability === 'Wonder Guard';

	return ATTACK_TYPES.map((type) => {
		const base = typeMultiplier(type, defenderTypes);
		let multiplier = base;
		let source: string | undefined;
		for (const [name, effects] of [
			[mods.ability, ability],
			[mods.item, item]
		] as const) {
			const effect = effects?.[type];
			if (effect === undefined) continue;
			multiplier *= effect;
			source = name ?? undefined;
		}
		if (wonderGuard && base <= 1) {
			multiplier = 0;
			source = 'Wonder Guard';
		}
		return { type, multiplier, base, ...(source && multiplier !== base ? { source } : {}) };
	});
}

/** True when the ability or item changes at least one matchup for these types. */
export function hasDefensiveModifier(
	defenderTypes: string[],
	mods: { ability?: string | null; item?: string | null }
): boolean {
	return matchups(defenderTypes, mods).some((m) => m.multiplier !== m.base);
}

/** The matchups grouped by multiplier, highest (weakest) first. */
export function groupByMultiplier(list: Matchup[]): { multiplier: number; matchups: Matchup[] }[] {
	const groups = new Map<number, Matchup[]>();
	for (const m of list) groups.set(m.multiplier, [...(groups.get(m.multiplier) ?? []), m]);
	return [...groups]
		.sort(([a], [b]) => b - a)
		.map(([multiplier, matchups]) => ({ multiplier, matchups }));
}

export function formatMultiplier(multiplier: number): string {
	if (multiplier === 0) return 'Immune';
	if (multiplier === 0.5) return '×½';
	if (multiplier === 0.25) return '×¼';
	if (multiplier === 0.125) return '×⅛';
	return `×${multiplier}`;
}
