import type { TeamSlot } from '../stores/team.svelte';
import type { FieldConditions } from '../stores/field.svelte';

/**
 * Abilities whose effect is field-wide rather than scoped to one side's
 * ally (`@smogon/calc` ability name each is auto-derived from), keyed by
 * the same name `FieldConditions` uses for its per-flag override — see its
 * own doc comment for why these can't be modeled like `TeamAllySupport`'s
 * Friend Guard/Battery/Power Spot/Steely Spirit.
 *
 * - The four Ruin abilities: Ting-Lu, Wo-Chien, Chien-Pao and Chi-Yu's
 *   respective signature abilities, each lowering one stat for every other
 *   Pokemon on the field.
 * - Fairy Aura: Xerneas' signature ability, boosting every Fairy-type
 *   move's power field-wide.
 */
const FIELD_ABILITIES = {
	vesselOfRuin: 'Vessel of Ruin',
	tabletsOfRuin: 'Tablets of Ruin',
	swordOfRuin: 'Sword of Ruin',
	beadsOfRuin: 'Beads of Ruin',
	fairyAura: 'Fairy Aura'
} as const;

export type FieldAbilityFlag = keyof typeof FIELD_ABILITIES;

/** The 5 field abilities, in display order — for iterating in the UI. */
export const FIELD_ABILITY_FLAGS = Object.keys(FIELD_ABILITIES) as FieldAbilityFlag[];

/** The ability name a field-ability flag is auto-derived from — also its display label. */
export function fieldAbilityName(flag: FieldAbilityFlag): string {
	return FIELD_ABILITIES[flag];
}

/** The stat each Ruin ability lowers, as short button text. Fairy Aura has none. */
const FIELD_ABILITY_EFFECTS: Partial<Record<FieldAbilityFlag, string>> = {
	vesselOfRuin: '-SpA',
	tabletsOfRuin: '-Atk',
	swordOfRuin: '-Def',
	beadsOfRuin: '-SpD'
};

export function fieldAbilityEffect(flag: FieldAbilityFlag): string | null {
	return FIELD_ABILITY_EFFECTS[flag] ?? null;
}

/**
 * Whether `flag`'s ability is currently active anywhere on the field:
 * `field`'s manual override when set, else auto-derived from whether any of
 * `allSlots` (all 4 Pokemon across both teams, not just one side) has the
 * ability equipped. Safe to OR into every calculation uniformly (including
 * ones where the attacker or target themselves hold it) — `@smogon/calc`'s
 * own mechanics (`gen789.ts`) check e.g. `attacker.hasAbility(...) ||
 * field.isXOfRuin` and `move.type === 'Fairy' && field.isFairyAura`, so a
 * redundantly-true field flag when the holder is already one of the two
 * Pokemon directly in that calculation changes nothing.
 */
export function providesFieldAbility(
	allSlots: TeamSlot[],
	flag: FieldAbilityFlag,
	field?: FieldConditions
): boolean {
	const override = field?.[flag];
	return override ?? allSlots.some((slot) => slot.ability === FIELD_ABILITIES[flag]);
}

/** The `@smogon/calc` `Field`-level flags for every field ability, for the current matchup — see `providesFieldAbility`. */
export function fieldAbilityFlags(allSlots: TeamSlot[], field?: FieldConditions) {
	return {
		isVesselOfRuin: providesFieldAbility(allSlots, 'vesselOfRuin', field),
		isTabletsOfRuin: providesFieldAbility(allSlots, 'tabletsOfRuin', field),
		isSwordOfRuin: providesFieldAbility(allSlots, 'swordOfRuin', field),
		isBeadsOfRuin: providesFieldAbility(allSlots, 'beadsOfRuin', field),
		isFairyAura: providesFieldAbility(allSlots, 'fairyAura', field)
	};
}
