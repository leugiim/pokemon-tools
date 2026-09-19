/**
 * Abilities that change their holder's type in battle (to that of the move
 * it's about to use). `@smogon/calc` credits them with STAB on every move;
 * a slot's `currentType` pins the type they actually hold instead.
 */
export const TYPE_SHIFT_ABILITIES: ReadonlySet<string> = new Set(['Protean', 'Libero']);

export function hasTypeShift(ability: string | null): boolean {
	return ability !== null && TYPE_SHIFT_ABILITIES.has(ability);
}
