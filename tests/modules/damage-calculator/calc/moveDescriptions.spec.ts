import { describe, expect, it } from 'vitest';
import { descriptionOf } from '$lib/modules/damage-calculator/calc/moveDescriptions';
import { allMoves } from '$lib/modules/damage-calculator/calc/moves';

function move(name: string) {
	const m = allMoves.find((m) => m.name === name);
	if (!m) throw new Error(`moveDescriptions.spec.ts: expected move not found: ${name}`);
	return m;
}

describe('descriptionOf', () => {
	it("returns @pkmn/dex's shortDesc and desc for a move it recognizes", () => {
		const result = descriptionOf(move('Thunderbolt'));
		expect(result).not.toBeNull();
		expect(result?.shortDesc).toContain('paralyze');
		expect(result?.desc).toContain('paralyze');
	});

	it('resolves a move with punctuation in its name the same way', () => {
		expect(descriptionOf(move("King's Shield"))?.shortDesc).toContain('Protect');
	});
});
