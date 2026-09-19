import { MAX_GAMES, matchResult, type Game, type MatchFormat, type MatchResult } from './types';

export const SELECTION_SIZE = 4;
export const LEAD_SIZE = 2;
export const RIVAL_TEAM_SIZE = 6;

export interface PickState {
	selection: string[];
	lead: string[];
}

/**
 * Adds or removes `name` from the selection (at most 4). Removing a
 * Pokémon also removes it from the lead. Used for both sides.
 */
export function toggleSelection(state: PickState, name: string): PickState {
	if (state.selection.includes(name)) {
		return {
			selection: state.selection.filter((n) => n !== name),
			lead: state.lead.filter((n) => n !== name)
		};
	}
	if (state.selection.length >= SELECTION_SIZE) return state;
	return { ...state, selection: [...state.selection, name] };
}

/** Adds or removes `name` from the lead (at most 2). */
export function toggleLead(lead: string[], name: string): string[] {
	if (lead.includes(name)) return lead.filter((n) => n !== name);
	if (lead.length >= LEAD_SIZE) return lead;
	return [...lead, name];
}

/** The rival's 6 name inputs: the saved names, padded with empty slots. */
export function padRivalSlots(names: string[]): string[] {
	return [...names, ...Array<string>(RIVAL_TEAM_SIZE).fill('')].slice(0, RIVAL_TEAM_SIZE);
}

/** Drops from the rival's selection and lead whatever is no longer in their team. */
export function syncRivalPicks(rivalTeam: string[], picks: PickState): PickState {
	const present = new Set(rivalTeam.map((n) => n.trim()).filter(Boolean));
	return {
		selection: picks.selection.filter((n) => present.has(n)),
		lead: picks.lead.filter((n) => present.has(n))
	};
}

/** A game as the form holds it: the result is unset until picked. */
export type GameDraft = Omit<Game, 'result'> & { result: MatchResult | '' };

/** An empty game to start filling in. */
export function emptyGame(): GameDraft {
	return { result: '', selection: [], lead: [], rivalSelection: [], rivalLead: [], notes: '' };
}

/** Games after switching format: Bo1 keeps only the first, Bo3 keeps what's there. */
export function gamesForFormat(format: MatchFormat, games: GameDraft[]): GameDraft[] {
	const kept = games.slice(0, MAX_GAMES[format]);
	return kept.length > 0 ? kept : [emptyGame()];
}

/** Whether another game can be added: the match isn't decided nor at its game limit. */
export function canAddGame(format: MatchFormat, games: GameDraft[]): boolean {
	const played = games.filter((g): g is Game => g.result !== '');
	return games.length < MAX_GAMES[format] && matchResult(format, played) === 'ongoing';
}

/** The first thing wrong with a match about to be saved, or `null`. */
export function validateMatch(input: { format: MatchFormat; games: GameDraft[] }): string | null {
	const { format, games } = input;
	const tag = (i: number) => (format === 'bo1' ? '' : `Game ${i + 1}: `);

	for (const [i, game] of games.entries()) {
		if (!game.result) return `${tag(i)}Pick the result, or mark the game as ongoing.`;
		if (game.selection.length !== SELECTION_SIZE)
			return `${tag(i)}Select exactly 4 of your Pokémon.`;
		if (game.lead.length !== LEAD_SIZE) return `${tag(i)}Pick your lead (2 Pokémon).`;
		// Only the last game may be ongoing; earlier ones must have finished.
		if (game.result === 'ongoing' && i < games.length - 1)
			return `${tag(i)}Only the last game can be ongoing.`;
		if (i > 0 && matchResult(format, games.slice(0, i) as Game[]) !== 'ongoing')
			return `${tag(i)}The match was already decided before this game.`;
	}
	return null;
}
