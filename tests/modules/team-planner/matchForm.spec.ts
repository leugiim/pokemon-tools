import { describe, expect, it } from 'vitest';
import {
	canAddGame,
	emptyGame,
	gamesForFormat,
	matchResult,
	padRivalSlots,
	syncRivalPicks,
	toggleLead,
	toggleSelection,
	validateMatch,
	type GameDraft
} from '$lib/modules/team-planner';

describe('toggleSelection', () => {
	it('adds up to 4 and ignores the fifth', () => {
		let state = { selection: [] as string[], lead: [] as string[] };
		for (const n of ['A', 'B', 'C', 'D', 'E']) state = toggleSelection(state, n);
		expect(state.selection).toEqual(['A', 'B', 'C', 'D']);
	});

	it('removes a Pokémon from the lead when it leaves the selection', () => {
		const state = toggleSelection({ selection: ['A', 'B', 'C', 'D'], lead: ['A', 'B'] }, 'A');
		expect(state).toEqual({ selection: ['B', 'C', 'D'], lead: ['B'] });
	});
});

describe('toggleLead', () => {
	it('adds up to 2 and toggles off', () => {
		expect(toggleLead([], 'A')).toEqual(['A']);
		expect(toggleLead(['A', 'B'], 'C')).toEqual(['A', 'B']);
		expect(toggleLead(['A', 'B'], 'A')).toEqual(['B']);
	});
});

describe('padRivalSlots', () => {
	it('pads to 6 and truncates beyond that', () => {
		expect(padRivalSlots(['A'])).toEqual(['A', '', '', '', '', '']);
		expect(padRivalSlots(['1', '2', '3', '4', '5', '6', '7'])).toHaveLength(6);
	});
});

describe('syncRivalPicks', () => {
	it('drops picks that are no longer in the rival team, keeping the rest', () => {
		const picks = { selection: ['A', 'B', 'C'], lead: ['A', 'B'] };
		expect(syncRivalPicks(['A', ' B ', '', 'X'], picks)).toEqual({
			selection: ['A', 'B'],
			lead: ['A', 'B']
		});
		expect(syncRivalPicks(['B'], picks)).toEqual({ selection: ['B'], lead: ['B'] });
	});
});

describe('validateMatch', () => {
	const game = (over: Partial<GameDraft> = {}): GameDraft => ({
		...emptyGame(),
		result: 'win',
		selection: ['A', 'B', 'C', 'D'],
		lead: ['A', 'B'],
		...over
	});
	const bo1 = (over: Partial<GameDraft> = {}) => ({ format: 'bo1' as const, games: [game(over)] });

	it('accepts a complete match', () => {
		expect(validateMatch(bo1())).toBeNull();
		expect(validateMatch(bo1({ result: 'ongoing' }))).toBeNull();
	});

	it('reports the first problem', () => {
		expect(validateMatch(bo1({ result: '' }))).toMatch(/result/i);
		expect(validateMatch(bo1({ selection: ['A'] }))).toMatch(/4/);
		expect(validateMatch(bo1({ lead: ['A'] }))).toMatch(/lead/i);
	});

	it('names the game that is wrong in a Bo3', () => {
		const games = [game(), game({ result: 'loss', lead: [] })];
		expect(validateMatch({ format: 'bo3', games })).toMatch(/^Game 2: .*lead/i);
	});

	it('accepts a Bo3 in progress, a 2-0 and a 2-1', () => {
		const w = game();
		const l = game({ result: 'loss' });
		expect(validateMatch({ format: 'bo3', games: [w] })).toBeNull();
		expect(validateMatch({ format: 'bo3', games: [w, w] })).toBeNull();
		expect(validateMatch({ format: 'bo3', games: [w, l, w] })).toBeNull();
	});

	it('rejects a game played after the match was decided, or after an ongoing one', () => {
		const w = game();
		expect(validateMatch({ format: 'bo3', games: [w, w, w] })).toMatch(/Game 3: .*decided/);
		expect(validateMatch({ format: 'bo3', games: [game({ result: 'ongoing' }), w] })).toMatch(
			/Game 1: .*ongoing/
		);
	});
});

describe('matchResult', () => {
	const r = (...results: ('win' | 'loss' | 'ongoing')[]) => results.map((result) => ({ result }));

	it('is the game itself for a Bo1', () => {
		expect(matchResult('bo1', r('win'))).toBe('win');
		expect(matchResult('bo1', r('loss'))).toBe('loss');
		expect(matchResult('bo1', r('ongoing'))).toBe('ongoing');
	});

	it('goes to whoever wins two games of a Bo3', () => {
		expect(matchResult('bo3', r('win', 'win'))).toBe('win');
		expect(matchResult('bo3', r('loss', 'win', 'loss'))).toBe('loss');
		expect(matchResult('bo3', r('win'))).toBe('ongoing');
		expect(matchResult('bo3', r('win', 'loss'))).toBe('ongoing');
	});
});

describe('gamesForFormat and canAddGame', () => {
	it('Bo1 keeps only the first game, Bo3 never has none', () => {
		const games = [emptyGame(), emptyGame(), emptyGame()];
		expect(gamesForFormat('bo1', games)).toHaveLength(1);
		expect(gamesForFormat('bo3', games)).toHaveLength(3);
		expect(gamesForFormat('bo3', [])).toHaveLength(1);
	});

	it('allows another game only while a Bo3 is undecided and under 3 games', () => {
		const g = (result: 'win' | 'loss') => ({ ...emptyGame(), result });
		expect(canAddGame('bo1', [g('win')])).toBe(false);
		expect(canAddGame('bo3', [g('win')])).toBe(true);
		expect(canAddGame('bo3', [g('win'), g('win')])).toBe(false);
		expect(canAddGame('bo3', [g('win'), g('loss')])).toBe(true);
		expect(canAddGame('bo3', [g('win'), g('loss'), g('win')])).toBe(false);
	});
});
