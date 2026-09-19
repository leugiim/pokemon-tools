import type { PokemonSetData } from '$lib/modules/shared';
import { displayName, type Match, type Team } from './types';

export type ResultFilter = 'win' | 'loss' | 'ongoing' | '';

export interface WinLoss {
	wins: number;
	total: number;
}

export interface PokeStat {
	name: string;
	pokemon: PokemonSetData | null;
	times: number;
	wins: number;
	wr: number | null;
}

export interface NamedStat extends WinLoss {
	name: string;
	wr: number;
}

export interface LeadStat extends WinLoss {
	lead: string;
	wr: number;
}

export interface TeamStats {
	decided: Match[];
	total: number;
	wins: number;
	wr: number | null;
	allPokeNames: string[];
	pokeStats: PokeStat[];
	leadStats: LeadStat[];
	enemyStats: NamedStat[];
	enemyLeadStats: LeadStat[];
}

export function winrate(matches: Match[]): number | null {
	const decided = matches.filter((m) => m.result !== 'ongoing');
	if (decided.length === 0) return null;
	return Math.round((decided.filter((m) => m.result === 'win').length / decided.length) * 100);
}

// Normaliza Mega: "Charizard-Mega-X" → "Charizard", "Froslass-Mega" → "Froslass"
export function megaBase(name: string): string {
	return name.replace(/-Mega(-[A-Za-z])?$/i, '');
}

function leadKey(lead: string[]): string {
	return [...lead].sort().join(' + ');
}

// Estadísticas de un equipo a partir de sus partidas. Solo cuentan las partidas decididas.
export function computeTeamStats(team: Team, matches: Match[]): TeamStats {
	const decided = matches.filter((m) => m.result !== 'ongoing');
	const total = decided.length;
	const wins = decided.filter((m) => m.result === 'win').length;
	// Pokémon and lead stats count games, so a Bo3 weighs as much as it was played.
	const decidedGames = matches.flatMap((m) => m.games.filter((g) => g.result !== 'ongoing'));

	// Todos los pokemon que alguna vez estuvieron en el equipo (actuales + históricos de partidas)
	const currentPokeMap = new Map(team.pokemon.map((p) => [displayName(p), p]));
	const allNamesRaw = [
		...new Set([
			...team.pokemon.map(displayName),
			...matches.flatMap((m) => m.games.flatMap((g) => g.selection))
		])
	];

	// Deduplicar agrupando base + mega como uno solo.
	// El nombre de display preferido es el del equipo actual; si no, el primero que aparezca.
	const baseDisplayMap = new Map<string, string>(); // base → display name
	allNamesRaw.forEach((name) => {
		const base = megaBase(name);
		if (!baseDisplayMap.has(base) || currentPokeMap.has(name)) {
			baseDisplayMap.set(base, name);
		}
	});
	const allPokeNames = [...baseDisplayMap.values()];

	// Stats por pokemon en selección, agrupando Mega con base
	const pokeStats: PokeStat[] = [...baseDisplayMap.entries()]
		.map(([base, displayName]) => {
			const pokemon = currentPokeMap.get(displayName) ?? null;
			const inSelection = decidedGames.filter((g) => g.selection.some((n) => megaBase(n) === base));
			const pokeWins = inSelection.filter((g) => g.result === 'win').length;
			return {
				name: displayName,
				pokemon,
				times: inSelection.length,
				wins: pokeWins,
				wr: inSelection.length > 0 ? Math.round((pokeWins / inSelection.length) * 100) : null
			};
		})
		.sort((a, b) => (b.wr ?? -1) - (a.wr ?? -1));

	// Stats por lead propio
	const leadMap = new Map<string, WinLoss>();
	decidedGames.forEach((g) => {
		if (g.lead.length !== 2) return;
		const key = leadKey(g.lead);
		const cur = leadMap.get(key) ?? { wins: 0, total: 0 };
		leadMap.set(key, {
			wins: cur.wins + (g.result === 'win' ? 1 : 0),
			total: cur.total + 1
		});
	});
	const leadStats: LeadStat[] = [...leadMap.entries()]
		.map(([lead, s]) => ({ lead, ...s, wr: Math.round((s.wins / s.total) * 100) }))
		.sort((a, b) => b.wr - a.wr);

	// Pokemon rivales: winrate del rival contra ti
	const rivalPokeMap = new Map<string, WinLoss>();
	decided.forEach((m) => {
		const rivalWon = m.result === 'loss';
		const seen = new Set<string>();
		m.rivalTeam.forEach((name) => {
			if (seen.has(name)) return;
			seen.add(name);
			const cur = rivalPokeMap.get(name) ?? { wins: 0, total: 0 };
			rivalPokeMap.set(name, { wins: cur.wins + (rivalWon ? 1 : 0), total: cur.total + 1 });
		});
	});
	const enemyStats: NamedStat[] = [...rivalPokeMap.entries()]
		.map(([name, s]) => ({ name, ...s, wr: Math.round((s.wins / s.total) * 100) }))
		.sort((a, b) => b.wr - a.wr || b.total - a.total);

	// Leads enemigas: winrate del rival contra ti
	const enemyLeadMap = new Map<string, WinLoss>();
	decidedGames.forEach((g) => {
		if (g.rivalLead.length !== 2) return;
		const rivalWon = g.result === 'loss';
		const key = leadKey(g.rivalLead);
		const cur = enemyLeadMap.get(key) ?? { wins: 0, total: 0 };
		enemyLeadMap.set(key, { wins: cur.wins + (rivalWon ? 1 : 0), total: cur.total + 1 });
	});
	const enemyLeadStats: LeadStat[] = [...enemyLeadMap.entries()]
		.map(([lead, s]) => ({ lead, ...s, wr: Math.round((s.wins / s.total) * 100) }))
		.sort((a, b) => b.wr - a.wr || b.total - a.total);

	return {
		decided,
		total,
		wins,
		wr: winrate(matches),
		allPokeNames,
		pokeStats,
		leadStats,
		enemyStats,
		enemyLeadStats
	};
}

// Filtros de las tablas de rivales
export function filterEnemyStats(
	stats: NamedStat[],
	nameFilter: string,
	minMatches: number
): NamedStat[] {
	return stats
		.filter((s) => s.total >= minMatches)
		.filter((s) => !nameFilter || s.name.toLowerCase().includes(nameFilter.toLowerCase()));
}

export function filterEnemyLeadStats(
	stats: LeadStat[],
	nameFilter: string,
	minMatches: number
): LeadStat[] {
	const q = nameFilter.toLowerCase();
	return stats
		.filter((s) => s.total >= minMatches)
		.filter(
			(s) =>
				!q ||
				s.lead
					.toLowerCase()
					.split(' + ')
					.some((n) => n.includes(q))
		);
}

// Filtros del historial de partidas
export function filterMatches(
	matches: Match[],
	{ result, own, rival }: { result: ResultFilter; own: string; rival: string }
): Match[] {
	const rq = rival.trim().toLowerCase();
	const oq = own.trim().toLowerCase();
	return matches
		.filter((m) => !result || m.result === result)
		.filter(
			(m) =>
				!oq ||
				m.games.some((g) =>
					g.selection.some((n) => megaBase(n.toLowerCase()).includes(megaBase(oq)))
				)
		)
		.filter((m) => !rq || m.rivalTeam.some((n) => n.toLowerCase().includes(rq)));
}
