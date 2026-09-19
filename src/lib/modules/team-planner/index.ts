// Public API of the team-planner module.
export {
	legacyMatchToMatch,
	legacySetToData,
	legacyTeamToTeam,
	type LegacyMatch,
	type LegacyPokemonSet,
	type LegacyTeam
} from './legacy';
export {
	deleteMatch,
	deleteTeam,
	getMatch,
	getMatchesByTeam,
	getTeams,
	saveMatch,
	saveTeam
} from './storage';
export { buildNewTeamHandoff, buildTeamHandoff } from './calcHandoff';
export { formatDate, RESULT_LABELS, winrateClass } from './format';
export { historyToJson, jsonToHistory, jsonToMatch, matchToJson } from './matchIO';
export {
	canAddGame,
	emptyGame,
	gamesForFormat,
	LEAD_SIZE,
	padRivalSlots,
	RIVAL_TEAM_SIZE,
	SELECTION_SIZE,
	syncRivalPicks,
	toggleLead,
	toggleSelection,
	validateMatch,
	type GameDraft,
	type PickState
} from './matchForm';
export { getPokemonNames } from './pokemonNames';
export { itemIconUrl, megaIconUrl, pokemonIconUrl, pokemonSpriteUrl } from './sprites';
export {
	computeTeamStats,
	filterEnemyLeadStats,
	filterEnemyStats,
	filterMatches,
	megaBase,
	winrate,
	type LeadStat,
	type NamedStat,
	type PokeStat,
	type ResultFilter,
	type TeamStats
} from './stats';
export { planner } from './teams.svelte';
export {
	displayName,
	MAX_GAMES,
	matchResult,
	normalizeMatch,
	seriesScore,
	type Game,
	type Match,
	type MatchFormat,
	type MatchResult,
	type Team
} from './types';
