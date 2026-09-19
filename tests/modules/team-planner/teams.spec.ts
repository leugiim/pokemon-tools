import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planner, type Match, type Team } from '$lib/modules/team-planner';
import { installMemoryStorage } from './memoryStorage';

beforeEach(() => {
	installMemoryStorage();
	planner.teams = [];
	planner.matches = {};
	planner.loaded = false;
});
afterEach(() => vi.unstubAllGlobals());

const team: Team = { id: 't1', name: 'Team', paste: '', pokemon: [], createdAt: 1 };
const match = (id: string, date: number): Match => ({
	id,
	teamId: 't1',
	date,
	format: 'bo1',
	result: 'win',
	games: [{ result: 'win', selection: [], lead: [], rivalSelection: [], rivalLead: [] }],
	teamRoster: [],
	rivalTeam: [],
	notes: ''
});

describe('planner store', () => {
	it('reads nothing until load() is called', () => {
		expect(planner.loaded).toBe(false);
		expect(planner.teams).toEqual([]);
	});

	it('saves and lists teams', () => {
		planner.saveTeam(team);
		expect(planner.teams.map((t) => t.id)).toEqual(['t1']);
		planner.teams = [];
		planner.load();
		expect(planner.loaded).toBe(true);
		expect(planner.teams.map((t) => t.id)).toEqual(['t1']);
	});

	it('keeps the matches of a team sorted newest first', () => {
		planner.saveMatch(match('old', 1));
		planner.saveMatch(match('new', 9));
		expect(planner.matches.t1.map((m) => m.id)).toEqual(['new', 'old']);
		planner.deleteMatch('new', 't1');
		expect(planner.matches.t1.map((m) => m.id)).toEqual(['old']);
	});

	it('forgets the matches of a deleted team', () => {
		planner.saveTeam(team);
		planner.saveMatch(match('a', 1));
		planner.deleteTeam('t1');
		expect(planner.teams).toEqual([]);
		expect(planner.matches.t1).toBeUndefined();
	});
});

describe('planner store: createTeam and updateTeamSets', () => {
	const sets = [
		{
			species: 'Garchomp',
			item: 'Choice Scarf',
			statPoints: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
			moves: ['Earthquake']
		},
		{
			species: 'Rotom-Wash',
			nickname: 'Sparky',
			statPoints: { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			moves: ['Hydro Pump']
		}
	];

	it('createTeam stores a new team with a paste written from its sets', () => {
		const created = planner.createTeam(sets, '  My team ');
		expect(created.name).toBe('My team');
		expect(created.pokemon).toEqual(sets);
		expect(created.paste).toContain('Garchomp @ Choice Scarf');
		expect(created.paste).toContain('Sparky (Rotom-Wash)');
		expect(planner.teams.map((t) => t.id)).toEqual([created.id]);
	});

	it('createTeam without a name uses the Pokémon names', () => {
		expect(planner.createTeam(sets).name).toBe('Garchomp / Sparky');
	});

	it('creates a different team each time', () => {
		expect(planner.createTeam(sets).id).not.toBe(planner.createTeam(sets).id);
		expect(planner.teams).toHaveLength(2);
	});

	it('updateTeamSets replaces the Pokémon and paste but keeps the name, id and date', () => {
		const created = planner.createTeam(sets, 'Original');
		const updated = planner.updateTeamSets(created.id, [sets[0]])!;
		expect(updated).toMatchObject({
			id: created.id,
			name: 'Original',
			createdAt: created.createdAt
		});
		expect(updated.pokemon).toEqual([sets[0]]);
		expect(updated.paste).not.toContain('Sparky');
		expect(planner.teams.find((t) => t.id === created.id)?.pokemon).toHaveLength(1);
		expect(planner.teams).toHaveLength(1);
	});

	it('updateTeamSets is null for a team that does not exist', () => {
		expect(planner.updateTeamSets('nope', sets)).toBeNull();
		expect(planner.teams).toEqual([]);
	});
});
