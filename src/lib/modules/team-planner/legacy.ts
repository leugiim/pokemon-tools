import { clampStatPoints, emptyStatPointsData, type PokemonSetData } from '$lib/modules/shared';
import { displayName, normalizeMatch, type Game, type Match, type Team } from './types';

/**
 * Shapes the standalone `pokemon-team-stats` app stored in localStorage
 * (`pts_teams`, `pts_matches_<teamId>` and the older global `pts_matches`).
 * Only ever read, to bring that data over.
 */
export interface LegacyPokemonSet {
	name: string;
	nickname: string;
	item: string;
	ability: string;
	nature: string;
	evs: Record<string, number>;
	moves: string[];
}

export interface LegacyTeam {
	id: string;
	name: string;
	paste: string;
	pokemon: LegacyPokemonSet[];
	createdAt: number;
}

export type LegacyMatch = Omit<Match, 'teamRoster' | 'format' | 'games'> &
	Game & { teamRoster?: string[] };

const EV_KEYS: Record<string, keyof ReturnType<typeof emptyStatPointsData>> = {
	hp: 'hp',
	atk: 'atk',
	def: 'def',
	spa: 'spa',
	spd: 'spd',
	spe: 'spe'
};

/**
 * The old `evs` were the paste's `EVs:` line keyed by its text ("HP",
 * "SpA"); in Champions those are Stat Points, so they carry over as-is
 * (clamped to 0-32).
 */
export function legacySetToData(legacy: LegacyPokemonSet): PokemonSetData {
	const statPoints = emptyStatPointsData();
	for (const [label, value] of Object.entries(legacy.evs ?? {})) {
		const key = EV_KEYS[label.toLowerCase()];
		if (key) statPoints[key] = clampStatPoints(value);
	}

	const set: PokemonSetData = {
		species: legacy.name,
		statPoints,
		moves: (legacy.moves ?? []).slice(0, 4)
	};
	if (legacy.nickname) set.nickname = legacy.nickname;
	if (legacy.item) set.item = legacy.item;
	if (legacy.ability) set.ability = legacy.ability;
	if (legacy.nature) set.nature = legacy.nature;
	return set;
}

export function legacyTeamToTeam(legacy: LegacyTeam): Team {
	return {
		id: legacy.id,
		name: legacy.name,
		paste: legacy.paste,
		pokemon: (legacy.pokemon ?? []).map(legacySetToData),
		createdAt: legacy.createdAt
	};
}

/**
 * A match without a frozen roster (the oldest ones) gets the team's
 * current one, which is what the old app did on first view.
 */
export function legacyMatchToMatch(legacy: LegacyMatch, team: Team | undefined): Match {
	return normalizeMatch({
		...legacy,
		teamRoster: legacy.teamRoster?.length
			? legacy.teamRoster
			: (team?.pokemon ?? []).map(displayName)
	});
}
