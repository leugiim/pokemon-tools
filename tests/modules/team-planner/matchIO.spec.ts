import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Match } from '$lib/modules/team-planner';
import { historyToJson, jsonToHistory, jsonToMatch, matchToJson } from '$lib/modules/team-planner';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const stripIds = ({ id, teamId, ...rest }: Match) => {
	void id;
	void teamId;
	return rest;
};

describe('matchIO', () => {
	it('imports the full format and assigns ids and teamId', () => {
		const history = jsonToHistory(read('history.full.json'), 'team-1')!;
		expect(history).toHaveLength(2);
		expect(history.every((m) => m.teamId === 'team-1' && m.id)).toBe(true);
		expect(new Set(history.map((m) => m.id)).size).toBe(2);
		expect(history[0].result).toBe('win');
		expect(history[0].notes).toBe('full format');
	});

	it('imports the compact format', () => {
		const history = jsonToHistory(read('history.compact.json'), 'team-1')!;
		expect(history[0]).toMatchObject({
			date: 1700000000000,
			result: 'win',
			teamRoster: ['Charizard', 'Sparky', 'Froslass-Mega'],
			games: [{ selection: ['Charizard', 'Sparky'] }],
			rivalTeam: ['Incineroar', 'Rillaboom'],
			notes: 'compact'
		});
		// Missing roster falls back to an empty list
		expect(history[1].teamRoster).toEqual([]);
		expect(history[1].result).toBe('ongoing');
	});

	it('exports compactly, without id and teamId, and round-trips', () => {
		const history = jsonToHistory(read('history.full.json'), 'team-1')!;
		const json = historyToJson(history);
		const raw = JSON.parse(json);
		expect(Object.keys(raw[0]).sort()).toEqual(
			['d', 'l', 'n', 'r', 's', 'rl', 'rs', 'rt', 'tr'].sort()
		);
		const back = jsonToHistory(json, 'team-2')!;
		expect(back.map(stripIds)).toEqual(history.map(stripIds));
	});

	it('round-trips a Bo3 with its games', () => {
		const game = (result: 'win' | 'loss', lead: string[]) => ({
			result,
			selection: ['A', 'B', 'C', 'D'],
			lead,
			rivalSelection: ['X', 'Y'],
			rivalLead: ['X', 'Y']
		});
		const bo3: Match = {
			id: 'm',
			teamId: 't',
			date: 1,
			format: 'bo3',
			result: 'win',
			games: [game('win', ['A', 'B']), game('loss', ['C', 'D']), game('win', ['A', 'C'])],
			teamRoster: [],
			rivalTeam: ['X', 'Y'],
			notes: ''
		};
		const back = jsonToMatch(matchToJson(bo3), 't')!;
		expect(stripIds(back)).toEqual(stripIds(bo3));
		// The first game also fills the flat keys older versions read.
		expect(JSON.parse(matchToJson(bo3))).toMatchObject({ s: ['A', 'B', 'C', 'D'], l: ['A', 'B'] });
	});

	it('omits the roster key when the roster is empty', () => {
		const [m] = jsonToHistory(read('history.compact.json'), 't')!.slice(1);
		expect(JSON.parse(matchToJson(m))).not.toHaveProperty('tr');
	});

	it('imports a single match from an object or from an array', () => {
		const [first] = JSON.parse(read('history.compact.json'));
		expect(jsonToMatch(JSON.stringify(first), 't')?.notes).toBe('compact');
		expect(jsonToMatch(JSON.stringify([first]), 't')?.notes).toBe('compact');
	});

	it('rejects invalid input', () => {
		expect(jsonToMatch('not json', 't')).toBeNull();
		expect(jsonToMatch('{}', 't')).toBeNull();
		expect(jsonToMatch('[]', 't')).toBeNull();
		expect(jsonToHistory('nope', 't')).toBeNull();
		expect(jsonToHistory('[]', 't')).toBeNull();
	});
});

describe('matchIO rival sets', () => {
	const rivalSets = [
		{
			species: 'Incineroar',
			statPoints: { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			moves: ['Fake Out']
		}
	];

	it('round-trips optional rival sets and paste through the compact format', () => {
		const [m] = jsonToHistory(read('history.full.json'), 't')!;
		const withSets = { ...m, rivalSets, rivalPaste: 'Incineroar\n- Fake Out' };
		const back = jsonToMatch(matchToJson(withSets), 't')!;
		expect(back.rivalSets).toEqual(rivalSets);
		expect(back.rivalPaste).toBe('Incineroar\n- Fake Out');
	});

	it('leaves the keys out when there are none', () => {
		const [m] = jsonToHistory(read('history.full.json'), 't')!;
		const raw = JSON.parse(matchToJson(m));
		expect(raw).not.toHaveProperty('rps');
		expect(raw).not.toHaveProperty('rp');
	});
});
