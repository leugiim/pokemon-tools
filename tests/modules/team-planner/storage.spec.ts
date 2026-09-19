import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	deleteMatch,
	deleteTeam,
	getMatch,
	getMatchesByTeam,
	getTeams,
	saveMatch,
	saveTeam,
	type Match,
	type Team
} from '$lib/modules/team-planner';
import { installMemoryStorage } from './memoryStorage';

let data: Map<string, string>;
beforeEach(() => {
	data = installMemoryStorage();
});
afterEach(() => vi.unstubAllGlobals());

const team = (over: Partial<Team> = {}): Team => ({
	id: 't1',
	name: 'Team',
	paste: '',
	pokemon: [
		{
			species: 'Charizard',
			statPoints: { hp: 0, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
			moves: []
		}
	],
	createdAt: 1,
	...over
});

const match = (over: Partial<Match> = {}): Match => ({
	id: 'm1',
	teamId: 't1',
	date: 100,
	format: 'bo1',
	result: 'win',
	games: [
		{
			result: 'win',
			selection: ['Charizard'],
			lead: ['Charizard'],
			rivalSelection: [],
			rivalLead: []
		}
	],
	teamRoster: ['Charizard'],
	rivalTeam: ['Incineroar'],
	notes: '',
	...over
});

describe('teams', () => {
	it('starts empty', () => {
		expect(getTeams()).toEqual([]);
	});

	it('inserts, updates and deletes', () => {
		saveTeam(team());
		saveTeam(team({ id: 't2', name: 'Other' }));
		saveTeam(team({ name: 'Renamed' }));
		expect(getTeams().map((t) => t.name)).toEqual(['Renamed', 'Other']);
		deleteTeam('t1');
		expect(getTeams().map((t) => t.id)).toEqual(['t2']);
	});

	it('deletes the matches of a deleted team', () => {
		saveTeam(team());
		saveMatch(match());
		deleteTeam('t1');
		expect(data.has('pt:v1:matches:t1')).toBe(false);
	});
});

describe('matches', () => {
	it('are kept per team', () => {
		saveMatch(match());
		saveMatch(match({ id: 'm2', teamId: 't2' }));
		expect(getMatchesByTeam('t1').map((m) => m.id)).toEqual(['m1']);
		expect(getMatchesByTeam('t2').map((m) => m.id)).toEqual(['m2']);
	});

	it('insert, update, find and delete', () => {
		saveMatch(match());
		saveMatch(
			match({
				result: 'loss',
				games: [{ result: 'loss', selection: [], lead: [], rivalSelection: [], rivalLead: [] }]
			})
		);
		expect(getMatch('m1', 't1')?.result).toBe('loss');
		expect(getMatchesByTeam('t1')).toHaveLength(1);
		deleteMatch('m1', 't1');
		expect(getMatch('m1', 't1')).toBeUndefined();
	});

	it('keep the optional rival sets and paste', () => {
		const rivalSets = [
			{
				species: 'Incineroar',
				statPoints: { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
				moves: ['Fake Out']
			}
		];
		saveMatch(match({ rivalSets, rivalPaste: 'Incineroar' }));
		expect(getMatch('m1', 't1')).toMatchObject({ rivalSets, rivalPaste: 'Incineroar' });
	});
});

describe('migration from the standalone planner', () => {
	const legacyTeam = {
		id: 'old',
		name: 'Old team',
		paste: 'x',
		createdAt: 5,
		pokemon: [
			{
				name: 'Rotom-Wash',
				nickname: 'Sparky',
				item: 'Sitrus Berry',
				ability: 'Levitate',
				nature: 'Calm',
				evs: { HP: 252, Def: 4, SpD: 252 },
				moves: ['Hydro Pump']
			},
			{
				name: 'Froslass-Mega',
				nickname: '',
				item: '',
				ability: '',
				nature: '',
				evs: {},
				moves: []
			}
		]
	};
	const legacyMatch = (id: string, over: Record<string, unknown> = {}) => ({
		id,
		teamId: 'old',
		date: 1,
		result: 'win',
		selection: ['Sparky'],
		lead: ['Sparky'],
		rivalTeam: [],
		rivalSelection: [],
		rivalLead: [],
		notes: '',
		...over
	});

	it('converts the legacy teams and clamps EVs to Stat Points', () => {
		data.set('pts_teams', JSON.stringify([legacyTeam]));
		const [migrated] = getTeams();
		expect(migrated).toMatchObject({ id: 'old', name: 'Old team', createdAt: 5 });
		expect(migrated.pokemon[0]).toEqual({
			species: 'Rotom-Wash',
			nickname: 'Sparky',
			item: 'Sitrus Berry',
			ability: 'Levitate',
			nature: 'Calm',
			statPoints: { hp: 32, atk: 0, def: 4, spa: 0, spd: 32, spe: 0 },
			moves: ['Hydro Pump']
		});
		expect(migrated.pokemon[1]).toEqual({
			species: 'Froslass-Mega',
			statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			moves: []
		});
	});

	it('leaves the legacy keys untouched', () => {
		const raw = JSON.stringify([legacyTeam]);
		data.set('pts_teams', raw);
		data.set('pts_matches_old', JSON.stringify([legacyMatch('a')]));
		getTeams();
		getMatchesByTeam('old');
		expect(data.get('pts_teams')).toBe(raw);
		expect(data.has('pts_matches_old')).toBe(true);
	});

	it('migrates once: later edits are not overwritten by the legacy data', () => {
		data.set('pts_teams', JSON.stringify([legacyTeam]));
		getTeams();
		deleteTeam('old');
		expect(getTeams()).toEqual([]);
	});

	it('migrates per-team matches, freezing the current roster on the ones without one', () => {
		data.set('pts_teams', JSON.stringify([legacyTeam]));
		data.set(
			'pts_matches_old',
			JSON.stringify([legacyMatch('a'), legacyMatch('b', { teamRoster: ['Sparky', 'Gengar'] })])
		);
		const matches = getMatchesByTeam('old');
		expect(matches.find((m) => m.id === 'a')?.teamRoster).toEqual(['Sparky', 'Froslass-Mega']);
		expect(matches.find((m) => m.id === 'b')?.teamRoster).toEqual(['Sparky', 'Gengar']);
	});

	it('reads matches saved before Bo3 as a Bo1 of one game', () => {
		data.set('pt:v1:matches:t1', JSON.stringify([legacyMatch('a', { teamId: 't1' })]));
		expect(getMatchesByTeam('t1')[0]).toMatchObject({
			format: 'bo1',
			result: 'win',
			games: [{ result: 'win', selection: ['Sparky'], lead: ['Sparky'] }]
		});
	});

	it('migrates matches from the older global list, each team getting its own', () => {
		data.set('pts_teams', JSON.stringify([legacyTeam]));
		data.set(
			'pts_matches',
			JSON.stringify([legacyMatch('a'), legacyMatch('z', { teamId: 'other' })])
		);
		expect(getMatchesByTeam('old').map((m) => m.id)).toEqual(['a']);
		expect(getMatchesByTeam('other').map((m) => m.id)).toEqual(['z']);
		expect(getMatchesByTeam('nobody')).toEqual([]);
	});

	it('brings the legacy teams over even when the first thing done is saving a new one', () => {
		data.set('pts_teams', JSON.stringify([legacyTeam]));
		saveTeam(team());
		expect(getTeams().map((t) => t.id)).toEqual(['old', 't1']);
	});
});
