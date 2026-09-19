import type { PokemonSetData } from '$lib/modules/shared';

export interface Team {
	id: string;
	name: string;
	/** The pasted text the team was created from. */
	paste: string;
	pokemon: PokemonSetData[];
	createdAt: number;
}

export type MatchResult = 'win' | 'loss' | 'ongoing';

export type MatchFormat = 'bo1' | 'bo3';

/** One game of a match: what each side brought and how it went. */
export interface Game {
	result: MatchResult;
	/** 4 names brought to the game. */
	selection: string[];
	/** 2 names that start on the field. */
	lead: string[];
	rivalSelection: string[];
	rivalLead: string[];
	/** This game's notes. Only Bo3 games use it; a Bo1's live on the match. */
	notes?: string;
}

/**
 * One recorded match: a single game (Bo1) or a best-of-three series.
 * Pokémon are referenced by `nickname || species` name, as in the
 * standalone planner this came from.
 */
export interface Match {
	id: string;
	teamId: string;
	date: number;
	/** Absent in matches saved before Bo3 existed, which are Bo1. */
	format: MatchFormat;
	/** The match's outcome, derived from `games` (see `matchResult`). */
	result: MatchResult;
	/** One game for Bo1, up to three for Bo3, in play order. */
	games: Game[];
	/** The 6 names the team had when the match was played, frozen. */
	teamRoster: string[];
	/** Up to 6 rival names. Enough on its own for the stats. */
	rivalTeam: string[];
	/** Full rival sets, when known. Optional: the quick "names only" mode stays. */
	rivalSets?: PokemonSetData[];
	/** The pasted text `rivalSets` came from. */
	rivalPaste?: string;
	notes: string;
}

/** Games needed to win a match of this format. */
export const GAMES_TO_WIN: Record<MatchFormat, number> = { bo1: 1, bo3: 2 };
export const MAX_GAMES: Record<MatchFormat, number> = { bo1: 1, bo3: 3 };

/** The match's outcome: whoever reaches the needed wins first, else ongoing. */
export function matchResult(format: MatchFormat, games: Pick<Game, 'result'>[]): MatchResult {
	const needed = GAMES_TO_WIN[format];
	if (games.filter((g) => g.result === 'win').length >= needed) return 'win';
	if (games.filter((g) => g.result === 'loss').length >= needed) return 'loss';
	return 'ongoing';
}

/** "2-1" style score of a Bo3, from your side. */
export function seriesScore(games: Pick<Game, 'result'>[]): string {
	const wins = games.filter((g) => g.result === 'win').length;
	const losses = games.filter((g) => g.result === 'loss').length;
	return `${wins}-${losses}`;
}

/**
 * Upgrades a match read from storage or an import. Older ones carry a
 * single game's picks on the match itself; they become a Bo1.
 */
export function normalizeMatch(raw: unknown): Match {
	const { selection, lead, rivalSelection, rivalLead, ...m } = raw as Partial<Match> &
		Partial<Game>;
	const format: MatchFormat = m.format === 'bo3' ? 'bo3' : 'bo1';
	const games: Game[] = m.games?.length
		? m.games
		: [
				{
					result: m.result ?? 'ongoing',
					selection: selection ?? [],
					lead: lead ?? [],
					rivalSelection: rivalSelection ?? [],
					rivalLead: rivalLead ?? []
				}
			];
	return { ...m, format, games, result: matchResult(format, games) } as Match;
}

/** Name a Pokémon goes by in matches and stats. */
export function displayName(set: PokemonSetData): string {
	return set.nickname || set.species;
}
