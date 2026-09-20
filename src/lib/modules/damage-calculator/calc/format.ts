import { NATURES, type StatID } from '@smogon/calc';

export type NatureName = Extract<keyof typeof NATURES, string>;

/**
 * Pokemon Champions' format rules:
 * https://champsdex.com/posts/pokemon-champions-ev-iv-stats-guide-2026/
 *
 * - Every Pokémon battles at level 50.
 * - IVs are fixed at 31 in every stat (no IV customization at all).
 * - The traditional 0-252-per-stat/508-total EV pool is replaced by
 *   Stat Points (SP): 0-32 per stat, 66 total across all six stats.
 *   Unlike EVs, an SP is a flat +1 to the final stat — there's no
 *   `floor(EV / 4)` step, so this does *not* plug into the standard
 *   games' stat formula and needs its own (see {@link calcStat}).
 *
 * Level, IVs and the 32-per-stat cap are always in effect, no toggle —
 * only the 66 total is optionally liftable (`FieldConditions.statPointsUnlimited`,
 * a "what if" for exploring builds beyond what the real format allows),
 * so `MAX_SP_TOTAL` itself still names the real, legal number regardless.
 */
export const LEVEL = 50;
export const FIXED_IV = 31;
export const MAX_SP_PER_STAT = 32;
export const MAX_SP_TOTAL = 66;

/** A Pokémon's Stat Point allocation across its six stats. */
export type StatPoints = Record<StatID, number>;

export const STAT_ORDER: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS: Record<StatID, string> = {
	hp: 'HP',
	atk: 'Atk',
	def: 'Def',
	spa: 'SpA',
	spd: 'SpD',
	spe: 'Spe'
};

export function emptyStatPoints(): StatPoints {
	return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function totalStatPoints(sp: StatPoints): number {
	return sp.hp + sp.atk + sp.def + sp.spa + sp.spd + sp.spe;
}

/**
 * A compact "32 Atk / 32 Spe" spread summary, in the same order
 * `STAT_ORDER` lists stats in — omits every stat with 0 SP invested, and
 * is `'—'` for an all-zero spread. Used for a short-form summary display
 * (`CommonSetsModal`), not `StatPointBars`' own interactive bars, which
 * shows every stat regardless.
 */
export function formatStatPoints(sp: StatPoints): string {
	const parts = STAT_ORDER.filter((stat) => sp[stat] > 0).map(
		(stat) => `${sp[stat]} ${STAT_LABELS[stat]}`
	);
	return parts.length > 0 ? parts.join(' / ') : '—';
}

export interface NatureInfo {
	name: NatureName;
	/** Stat this nature raises by 10% — same as `minus` for a neutral nature. */
	plus: StatID;
	/** Stat this nature lowers by 10% — same as `plus` for a neutral nature. */
	minus: StatID;
}

/** All 25 natures, sorted alphabetically. A neutral nature has `plus === minus`. */
export const allNatures: NatureInfo[] = Object.entries(NATURES)
	.map(([name, [plus, minus]]) => ({ name: name as NatureName, plus, minus }))
	.sort((a, b) => a.name.localeCompare(b.name));

/** Default nature for a freshly picked (or reset) team slot — no +/- on any stat. */
export const NEUTRAL_NATURE: NatureInfo = allNatures.find((n) => n.name === 'Hardy')!;

function natureModifier(nature: NatureInfo, stat: StatID): number {
	if (stat === 'hp') return 1; // nature never affects HP
	if (nature.plus === nature.minus) return 1;
	if (stat === nature.plus) return 1.1;
	if (stat === nature.minus) return 0.9;
	return 1;
}

/**
 * Final stat value at level 50 under Champions' rules, given a base
 * stat, the SP invested in it, and the Pokémon's nature. Not to be
 * confused with `@smogon/calc`'s own `calcStat`, which implements the
 * mainline games' `floor(EV / 4)`-based formula — Champions' Stat
 * Points don't plug into that.
 */
export function calcChampionsStat(
	base: number,
	stat: StatID,
	sp: number,
	nature: NatureInfo
): number {
	const raw = Math.floor(((2 * base + FIXED_IV) * LEVEL) / 100);
	if (stat === 'hp') {
		return raw + LEVEL + 10 + sp;
	}
	return Math.floor((raw + 5 + sp) * natureModifier(nature, stat));
}

/**
 * The nature's ±10% is a multiply-then-floor, so an SP point doesn't
 * always add a flat +1 to the final stat: on the boosted stat it
 * occasionally adds +2 instead (the 10% overflow finally tips the
 * floor over an extra integer), and on the hindered stat it
 * occasionally adds +0 (rounds back down to where it started) — both
 * roughly every 10 points. Returns the SP values (1..`MAX_SP_PER_STAT`)
 * right after one of those breakpoints — empty for a neutral nature or
 * a stat it doesn't touch (including HP, which nature never affects).
 */
export function statPointBreakpoints(base: number, stat: StatID, nature: NatureInfo): number[] {
	if (nature.plus === nature.minus || (stat !== nature.plus && stat !== nature.minus)) return [];
	const points: number[] = [];
	for (let sp = 1; sp <= MAX_SP_PER_STAT; sp++) {
		const delta =
			calcChampionsStat(base, stat, sp, nature) - calcChampionsStat(base, stat, sp - 1, nature);
		if (delta !== 1) points.push(sp);
	}
	return points;
}

/** A stat stage boost (Swords Dance, Intimidate, ...) never applies to HP — the 5 stats it can. */
export type BoostableStat = Exclude<StatID, 'hp'>;

export const BOOST_STAT_ORDER: BoostableStat[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** In-battle stat stages range -6..+6 (Minimize/Amnesia at one end, Belly Drum/three Swords Dances at the other) — `@smogon/calc`'s own `Pokemon.boosts` (and the modern boost table below) share this same range. */
export const MAX_BOOST_STAGE = 6;

/** A Pokémon's current stat stage per boostable stat, 0 by default (no boost/drop). */
export type StatBoosts = Record<BoostableStat, number>;

export function emptyStatBoosts(): StatBoosts {
	return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function clampBoostStage(stage: number): number {
	return Math.max(-MAX_BOOST_STAGE, Math.min(MAX_BOOST_STAGE, stage));
}

/**
 * The modern (gen 3+) stat-stage multiplier table, indexed by `stage + 6`
 * — mirrors `@smogon/calc`'s own internal (unexported) `getModifiedStat`
 * exactly, so the number `StatPointBars` displays never drifts from what
 * `calculate()` itself derives from the same `rawStat`/`boosts` pair.
 */
const BOOST_TABLE: [numerator: number, denominator: number][] = [
	[2, 8],
	[2, 7],
	[2, 6],
	[2, 5],
	[2, 4],
	[2, 3],
	[2, 2],
	[3, 2],
	[4, 2],
	[5, 2],
	[6, 2],
	[7, 2],
	[8, 2]
];

/** `rawStat` (unboosted) adjusted by a stat `stage` (-6..+6, clamped) — see `BOOST_TABLE`. */
export function boostedStat(rawStat: number, stage: number): number {
	const [numerator, denominator] = BOOST_TABLE[clampBoostStage(stage) + MAX_BOOST_STAGE];
	return Math.floor((rawStat * numerator) / denominator);
}
