import { readJson, removeKey, writeJson } from '$lib/modules/shared';
import { legacyMatchToMatch, legacyTeamToTeam, type LegacyMatch, type LegacyTeam } from './legacy';
import { normalizeMatch, type Match, type Team } from './types';

const TEAMS_KEY = 'pt:v1:teams';
const matchesKey = (teamId: string) => `pt:v1:matches:${teamId}`;

// The standalone planner's keys. Read to migrate, never modified or deleted.
const LEGACY_TEAMS_KEY = 'pts_teams';
const LEGACY_MATCHES_KEY = 'pts_matches';
const legacyMatchesKey = (teamId: string) => `pts_matches_${teamId}`;

// Teams

export function getTeams(): Team[] {
	const stored = readJson<Team[]>(TEAMS_KEY);
	if (stored) return stored;

	const legacy = readJson<LegacyTeam[]>(LEGACY_TEAMS_KEY);
	if (!legacy?.length) return [];
	const migrated = legacy.map(legacyTeamToTeam);
	writeJson(TEAMS_KEY, migrated);
	return migrated;
}

export function saveTeam(team: Team): void {
	const teams = getTeams();
	const index = teams.findIndex((t) => t.id === team.id);
	if (index >= 0) teams[index] = team;
	else teams.push(team);
	writeJson(TEAMS_KEY, teams);
}

export function deleteTeam(id: string): void {
	writeJson(
		TEAMS_KEY,
		getTeams().filter((t) => t.id !== id)
	);
	removeKey(matchesKey(id));
}

// Matches, one list per team

function getMatchList(teamId: string): Match[] {
	const stored = readJson<unknown[]>(matchesKey(teamId));
	if (stored) return stored.map(normalizeMatch);

	// First access: bring over the standalone planner's matches, per-team key
	// first and then the older global list.
	const team = getTeams().find((t) => t.id === teamId);
	const legacy =
		readJson<LegacyMatch[]>(legacyMatchesKey(teamId)) ??
		readJson<LegacyMatch[]>(LEGACY_MATCHES_KEY)?.filter((m) => m.teamId === teamId) ??
		[];
	const migrated = legacy.map((m) => legacyMatchToMatch(m, team));
	if (migrated.length > 0) writeJson(matchesKey(teamId), migrated);
	return migrated;
}

export function getMatchesByTeam(teamId: string): Match[] {
	return getMatchList(teamId);
}

export function getMatch(id: string, teamId: string): Match | undefined {
	return getMatchList(teamId).find((m) => m.id === id);
}

export function saveMatch(match: Match): void {
	const matches = getMatchList(match.teamId);
	const index = matches.findIndex((m) => m.id === match.id);
	if (index >= 0) matches[index] = match;
	else matches.push(match);
	writeJson(matchesKey(match.teamId), matches);
}

export function deleteMatch(id: string, teamId: string): void {
	writeJson(
		matchesKey(teamId),
		getMatchList(teamId).filter((m) => m.id !== id)
	);
}
