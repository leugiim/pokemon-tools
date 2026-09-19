import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTeamPaste } from '$lib/modules/shared';
import {
	computeTeamStats,
	filterEnemyLeadStats,
	filterEnemyStats,
	filterMatches,
	jsonToHistory,
	megaBase,
	winrate,
	type Game,
	type Match,
	type Team
} from '$lib/modules/team-planner';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const team: Team = {
	id: 'team-1',
	name: 'Test',
	paste: read('team.paste.txt'),
	pokemon: parseTeamPaste(read('team.paste.txt')),
	createdAt: 0
};
const matches: Match[] = jsonToHistory(read('history.full.json'), team.id)!;

function match(over: Partial<Match> & Partial<Game>): Match {
	const { selection, lead, rivalSelection, rivalLead, ...rest } = over;
	const result = over.result ?? 'win';
	return {
		id: 'x',
		teamId: team.id,
		date: 0,
		format: 'bo1',
		teamRoster: [],
		rivalTeam: [],
		notes: '',
		...rest,
		result,
		games: over.games ?? [
			{
				result,
				selection: selection ?? [],
				lead: lead ?? [],
				rivalSelection: rivalSelection ?? [],
				rivalLead: rivalLead ?? []
			}
		]
	};
}

describe('megaBase', () => {
	it('strips Mega suffixes only at the end', () => {
		expect(megaBase('Charizard-Mega-X')).toBe('Charizard');
		expect(megaBase('Froslass-Mega')).toBe('Froslass');
		expect(megaBase('Charizard')).toBe('Charizard');
		expect(megaBase('charizard-mega-y')).toBe('charizard');
	});
});

describe('winrate', () => {
	it('is null without decided matches', () => {
		expect(winrate([])).toBeNull();
		expect(winrate([match({ result: 'ongoing' })])).toBeNull();
	});

	it('ignores ongoing matches and rounds', () => {
		const ms = [
			match({ result: 'win' }),
			match({ result: 'win' }),
			match({ result: 'loss' }),
			match({ result: 'ongoing' })
		];
		expect(winrate(ms)).toBe(67);
	});
});

describe('computeTeamStats', () => {
	const stats = computeTeamStats(team, matches);

	it('counts totals over decided matches', () => {
		expect(stats).toMatchObject({ total: 2, wins: 1, wr: 50 });
	});

	it('groups Mega with base and prefers the current team display name', () => {
		// "Charizard" (current) and "Charizard-Mega-Y" (historic) collapse into one entry
		expect(stats.allPokeNames).toEqual(['Charizard', 'Sparky', 'Froslass-Mega']);
		const charizard = stats.pokeStats.find((s) => s.name === 'Charizard')!;
		expect(charizard).toMatchObject({ times: 2, wins: 1, wr: 50 });
		expect(charizard.pokemon?.item).toBe('Charizardite Y');
	});

	it('reports null winrate for pokemon that never played and sorts them last', () => {
		const froslass = stats.pokeStats.find((s) => s.name === 'Froslass-Mega')!;
		expect(froslass).toMatchObject({ times: 1, wins: 1, wr: 100 });
		const unused = computeTeamStats(team, []);
		expect(unused.pokeStats.every((s) => s.wr === null)).toBe(true);
	});

	it('computes own leads sorted by winrate, order independent', () => {
		const s = computeTeamStats(team, [
			match({ result: 'win', lead: ['B', 'A'] }),
			match({ result: 'loss', lead: ['A', 'B'] }),
			match({ result: 'win', lead: ['C', 'D'] })
		]);
		expect(s.leadStats).toEqual([
			{ lead: 'C + D', wins: 1, total: 1, wr: 100 },
			{ lead: 'A + B', wins: 1, total: 2, wr: 50 }
		]);
	});

	it('computes rival stats from the rival point of view', () => {
		const inc = stats.enemyStats.find((s) => s.name === 'Incineroar')!;
		expect(inc).toEqual({ name: 'Incineroar', wins: 1, total: 2, wr: 50 });
		const rilla = stats.enemyStats.find((s) => s.name === 'Rillaboom')!;
		expect(rilla).toEqual({ name: 'Rillaboom', wins: 0, total: 1, wr: 0 });
	});

	it('counts a duplicated rival pokemon once per match', () => {
		const s = computeTeamStats(team, [
			match({ result: 'loss', rivalTeam: ['Incineroar', 'Incineroar'] })
		]);
		expect(s.enemyStats).toEqual([{ name: 'Incineroar', wins: 1, total: 1, wr: 100 }]);
	});

	it('groups enemy leads regardless of order and skips incomplete leads', () => {
		expect(stats.enemyLeadStats).toEqual([
			{ lead: 'Incineroar + Rillaboom', wins: 1, total: 2, wr: 50 }
		]);
		const s = computeTeamStats(team, [match({ rivalLead: ['Solo'] })]);
		expect(s.enemyLeadStats).toEqual([]);
	});

	it('excludes ongoing matches from every stat', () => {
		const s = computeTeamStats(team, [
			match({
				result: 'ongoing',
				selection: ['Charizard'],
				lead: ['A', 'B'],
				rivalTeam: ['X'],
				rivalLead: ['X', 'Y']
			})
		]);
		expect(s).toMatchObject({
			total: 0,
			wins: 0,
			wr: null,
			leadStats: [],
			enemyStats: [],
			enemyLeadStats: []
		});
	});

	// Known limitation (characterization): pokemon are identified by "nickname || name"
	it('merges pokemon with the same nickname (known limitation)', () => {
		const dup: Team = {
			...team,
			pokemon: [
				{
					species: 'Rotom-Wash',
					nickname: 'Dup',
					statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					moves: []
				},
				{
					species: 'Rotom-Heat',
					nickname: 'Dup',
					statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					moves: []
				}
			]
		};
		expect(computeTeamStats(dup, []).allPokeNames).toEqual(['Dup']);
	});

	it('includes historical pokemon that are not in the current team', () => {
		const s = computeTeamStats(team, [match({ selection: ['Gengar'] })]);
		expect(s.allPokeNames).toContain('Gengar');
		expect(s.pokeStats.find((p) => p.name === 'Gengar')?.pokemon).toBeNull();
	});
});

describe('filters', () => {
	const ms: Match[] = [
		match({
			id: '1',
			result: 'win',
			selection: ['Charizard', 'Sparky'],
			rivalTeam: ['Incineroar', 'Rillaboom']
		}),
		match({
			id: '2',
			result: 'loss',
			selection: ['Charizard-Mega-Y'],
			rivalTeam: ['Flutter Mane']
		}),
		match({ id: '3', result: 'ongoing', selection: ['Froslass-Mega'], rivalTeam: ['Incineroar'] })
	];
	const ids = (l: Match[]) => l.map((m) => m.id);

	it('filters by result', () => {
		expect(ids(filterMatches(ms, { result: 'loss', own: '', rival: '' }))).toEqual(['2']);
		expect(ids(filterMatches(ms, { result: '', own: '', rival: '' }))).toEqual(['1', '2', '3']);
	});

	it('filters by own pokemon, matching Mega with base', () => {
		expect(ids(filterMatches(ms, { result: '', own: 'charizard', rival: '' }))).toEqual(['1', '2']);
		expect(ids(filterMatches(ms, { result: '', own: 'Charizard-Mega-Y', rival: '' }))).toEqual([
			'1',
			'2'
		]);
	});

	it('filters by rival name, case insensitive and trimmed', () => {
		expect(ids(filterMatches(ms, { result: '', own: '', rival: '  INCIN ' }))).toEqual(['1', '3']);
	});

	it('combines filters', () => {
		expect(ids(filterMatches(ms, { result: 'win', own: 'sparky', rival: 'rilla' }))).toEqual(['1']);
	});

	const enemy = [
		{ name: 'Incineroar', wins: 1, total: 3, wr: 33 },
		{ name: 'Rillaboom', wins: 0, total: 1, wr: 0 }
	];
	it('filters enemy stats by name and minimum matches', () => {
		expect(filterEnemyStats(enemy, '', 2).map((s) => s.name)).toEqual(['Incineroar']);
		expect(filterEnemyStats(enemy, 'RILLA', 1).map((s) => s.name)).toEqual(['Rillaboom']);
	});

	it('filters enemy leads by any member name', () => {
		const leads = [
			{ lead: 'Incineroar + Rillaboom', wins: 1, total: 2, wr: 50 },
			{ lead: 'Flutter Mane + Urshifu', wins: 0, total: 1, wr: 0 }
		];
		expect(filterEnemyLeadStats(leads, 'urshi', 1).map((s) => s.lead)).toEqual([
			'Flutter Mane + Urshifu'
		]);
		expect(filterEnemyLeadStats(leads, '', 2).map((s) => s.lead)).toEqual([
			'Incineroar + Rillaboom'
		]);
	});
});

describe('Bo3 stats', () => {
	const g = (result: 'win' | 'loss', lead: string[], rivalLead: string[]): Game => ({
		result,
		selection: ['A', 'B', 'C', 'D'],
		lead,
		rivalSelection: ['X', 'Y'],
		rivalLead
	});
	const series = match({
		format: 'bo3',
		result: 'win',
		rivalTeam: ['X', 'Y'],
		games: [
			g('win', ['A', 'B'], ['X', 'Y']),
			g('loss', ['C', 'D'], ['X', 'Y']),
			g('win', ['A', 'B'], ['X', 'Y'])
		]
	});

	it('counts the series once in the totals', () => {
		const s = computeTeamStats(team, [series]);
		expect([s.total, s.wins, s.wr]).toEqual([1, 1, 100]);
		expect(winrate([series])).toBe(100);
	});

	it('counts leads and picks per game', () => {
		const s = computeTeamStats(team, [series]);
		expect(s.leadStats).toEqual([
			{ lead: 'A + B', wins: 2, total: 2, wr: 100 },
			{ lead: 'C + D', wins: 0, total: 1, wr: 0 }
		]);
		expect(s.enemyLeadStats).toEqual([{ lead: 'X + Y', wins: 1, total: 3, wr: 33 }]);
		expect(s.pokeStats.find((p) => p.name === 'A')).toMatchObject({ times: 3, wins: 2 });
	});

	it("filters by any game's selection", () => {
		const other = match({ id: 'o', selection: ['Z'] });
		expect(filterMatches([series, other], { result: '', own: 'a', rival: '' })).toEqual([series]);
	});
});
