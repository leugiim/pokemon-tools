import { generateId, type PokemonSetData } from '$lib/modules/shared';
import { normalizeMatch, type Game, type Match, type MatchFormat } from './types';

type MatchData = Omit<Match, 'id' | 'teamId'>;

// Short keys for one game of a Bo3
interface CompactGame {
	r: string; // result
	s: string[]; // selection
	l: string[]; // lead
	rs: string[]; // rivalSelection
	rl: string[]; // rivalLead
}

// Short keys for the compact export
interface CompactMatch {
	d: number; // date
	r: string; // result
	f?: MatchFormat; // format, only written for Bo3
	g?: CompactGame[]; // games, only written for Bo3
	tr?: string[]; // teamRoster
	s: string[]; // selection (first game)
	l: string[]; // lead (first game)
	rt: string[]; // rivalTeam
	rs: string[]; // rivalSelection (first game)
	rl: string[]; // rivalLead (first game)
	n: string; // notes
	rps?: PokemonSetData[]; // rivalSets
	rp?: string; // rivalPaste
}

const encodeGame = (g: Game): CompactGame => ({
	r: g.result,
	s: g.selection,
	l: g.lead,
	rs: g.rivalSelection,
	rl: g.rivalLead
});

const decodeGame = (c: CompactGame): Game => ({
	result: c.r as Game['result'],
	selection: c.s,
	lead: c.l,
	rivalSelection: c.rs,
	rivalLead: c.rl
});

// The first game also fills the flat keys, so a Bo1 keeps the format older
// exports had and older versions of the app can still read a Bo3's first game.
function encode(m: MatchData): CompactMatch {
	const first = m.games[0];
	const c: CompactMatch = {
		d: m.date,
		r: m.result,
		s: first.selection,
		l: first.lead,
		rt: m.rivalTeam,
		rs: first.rivalSelection,
		rl: first.rivalLead,
		n: m.notes
	};
	if (m.format === 'bo3') {
		c.f = m.format;
		c.g = m.games.map(encodeGame);
	}
	if (m.teamRoster?.length) c.tr = m.teamRoster;
	if (m.rivalSets?.length) c.rps = m.rivalSets;
	if (m.rivalPaste) c.rp = m.rivalPaste;
	return c;
}

function decode(c: CompactMatch): MatchData {
	const data = normalizeMatch({
		date: c.d,
		result: c.r,
		format: c.f,
		games: c.g?.map(decodeGame),
		teamRoster: c.tr ?? [],
		selection: c.s,
		lead: c.l,
		rivalTeam: c.rt,
		rivalSelection: c.rs,
		rivalLead: c.rl,
		notes: c.n
	}) as MatchData;
	if (c.rps?.length) data.rivalSets = c.rps;
	if (c.rp) data.rivalPaste = c.rp;
	return data;
}

function isCompact(obj: unknown): obj is CompactMatch {
	return typeof obj === 'object' && obj !== null && 'd' in obj && 's' in obj;
}

/** The match's data without the ids, which an import assigns anew. */
function withoutIds({ id, teamId, ...data }: Match): MatchData {
	void id;
	void teamId;
	return data;
}

export function matchToJson(match: Match): string {
	return JSON.stringify(encode(withoutIds(match)));
}

export function historyToJson(matches: Match[]): string {
	return JSON.stringify(matches.map((m) => encode(withoutIds(m))));
}

/** Reads one match (compact or full format), or `null` if it isn't one. */
export function jsonToMatch(json: string, teamId: string): Match | null {
	try {
		const parsed = JSON.parse(json);
		const raw = Array.isArray(parsed) ? parsed[0] : parsed;
		if (!raw) return null;
		const data = isCompact(raw) ? decode(raw) : normalizeMatch(raw);
		if (!(raw.result ?? raw.r)) return null;
		return { ...data, id: generateId(), teamId };
	} catch {
		return null;
	}
}

/** Reads a list of matches, or `null` if the JSON isn't one. */
export function jsonToHistory(json: string, teamId: string): Match[] | null {
	try {
		const parsed = JSON.parse(json);
		const arr = Array.isArray(parsed) ? parsed : [parsed];
		if (!arr.length) return null;
		const matches = arr.map((raw: unknown) => {
			const data = isCompact(raw) ? decode(raw as CompactMatch) : normalizeMatch(raw);
			return { ...data, id: generateId(), teamId };
		});
		const first = arr[0];
		if (!(first?.result ?? first?.r)) return null;
		return matches;
	} catch {
		return null;
	}
}
