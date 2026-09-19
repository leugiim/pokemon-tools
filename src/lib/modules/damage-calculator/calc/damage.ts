import { Pokemon, Move, Field, calculate, type Result, type StatID } from '@smogon/calc';
import { GEN_NUM } from '$lib/modules/shared/species/generation';
import { FIXED_IV, LEVEL, STAT_ORDER, type StatPoints } from './format';
import type { TeamAllySupport, TeamSideConditions, TeamSlot } from '../stores/team.svelte';
import type { BattleFormat, Terrain, Weather } from '../stores/field.svelte';
import { basePowerWithAlliesFainted, type MoveItem } from './moves';
import { attackerSideFlags, defenderSideFlags } from './allySupport';
import { sideConditionFlags } from './sideConditions';
import type { fieldAbilityFlags } from './fieldAbilities';

/**
 * Converts one stat's Pokemon Champions Stat Point investment into the
 * `@smogon/calc` EV that makes the library's own (EV-based) stat formula
 * land on the exact same final value Champions' rules would give.
 *
 * This works only because Champions battles are fixed at level 50: at that
 * level the formula's `* level / 100` step is an exact `* 0.5`, which
 * cancels out the usual `floor(EV / 4)` dilution — doubling a Stat Point's
 * EV contribution (`8*sp - 4` instead of `4*sp`) lands the halved value on
 * the same rounding step Champions' own flat "+1 stat per SP" would.
 * `calculate()` clones its `Pokemon` arguments internally, and `clone()`
 * rebuilds from `ivs`/`evs`/`nature`, not from a Pokemon's `rawStats` —
 * so converting to an equivalent EV up front (rather than overwriting
 * `rawStats` after construction) is what survives that clone.
 *
 * Verified in `damage.spec.ts` against `calcChampionsStat` (this app's
 * already-tested source of truth) for every SP 0..32, and — at SP=0,
 * the one point with no `floor(EV/4)` step to diverge on — directly
 * against `@smogon/calc`'s own exported `calcStat`.
 */
function spToEv(sp: number): number {
	return sp === 0 ? 0 : 8 * sp - 4;
}

/** Inverse of `spToEv` — only ever fed EVs this file itself produced. */
function evToSp(ev: number): number {
	return ev === 0 ? 0 : (ev + 4) / 8;
}

/**
 * Rewrites the leading EV count of one of `@smogon/calc`'s stat
 * descriptions ("252+ Atk", "0 Def") into this app's Stat Points ("32+ Atk").
 */
function evsTextToSps(text: string | undefined): string | undefined {
	return text?.replace(/^\d+/, (ev) => String(evToSp(Number(ev))));
}

function toEvs(statPoints: StatPoints): Record<StatID, number> {
	return Object.fromEntries(STAT_ORDER.map((stat) => [stat, spToEv(statPoints[stat])])) as Record<
		StatID,
		number
	>;
}

function allIvs(): Record<StatID, number> {
	return Object.fromEntries(STAT_ORDER.map((stat) => [stat, FIXED_IV])) as Record<StatID, number>;
}

/**
 * Builds a `@smogon/calc` `Pokemon` from a `TeamSlot`'s build — `boosts`
 * included as-is, straight from the slot (e.g. Intimidate is a real,
 * permanent stage change `StatPointBars` applies directly to
 * `TeamSlot.boosts.atk`, not a per-calculation overlay layered on here).
 */
export function toSmogonPokemon(slot: TeamSlot): Pokemon {
	if (!slot.species) throw new Error('toSmogonPokemon: slot has no species selected');

	// A pinned Protean/Libero type is the Pokémon's only type; its ability
	// is left out so the calc doesn't also give STAB on every move (Protean
	// has no other effect on damage). `overrides` is deep-merged by position,
	// so `[type]` alone would keep a dual type's second type (and its STAB):
	// the typeless '???' fills that slot.
	const shifted = slot.shiftedType as Pokemon['types'][number] | null;

	return new Pokemon(GEN_NUM, slot.species.name, {
		level: LEVEL,
		ability: shifted ? undefined : (slot.ability ?? undefined),
		...(shifted ? { overrides: { types: [shifted, '???'] } } : {}),
		item: slot.item?.name,
		nature: slot.nature.name,
		ivs: allIvs(),
		evs: toEvs(slot.statPoints),
		boosts: slot.boosts,
		alliesFainted: slot.alliesFainted
	});
}

/**
 * Per-calculation overrides layered on top of a move's own data — both
 * default to `@smogon/calc`'s own behavior when omitted: no crit assumed
 * (`isCrit`, #14), and (for a multi-hit move) 3 hits, or the attacker's
 * ability's fixed count when it has one, e.g. Skill Link (`hits`, #15).
 * See `multiHitRange` for which moves accept a `hits` override at all.
 */
export interface DamageOptions {
	isCrit?: boolean;
	hits?: number;
	/**
	 * The attacker's own ally, used to auto-derive `attackerSide`'s Battery,
	 * Power Spot and Steely Spirit flags from its `ability` (ADR-0003, #13)
	 * — Helping Hand/Tailwind and a manual static override come from
	 * `attackerAllySupport` alone and apply even when this is omitted (e.g.
	 * a lone on-demand calculation with no real ally object to pass).
	 */
	attackerAlly?: TeamSlot;
	/**
	 * `attackerAlly`'s own team's shared manual ally-support overrides
	 * (ADR-0003, #13) — omit to fall back to pure ability-based
	 * auto-derivation with no override capability at all.
	 */
	attackerAllySupport?: TeamAllySupport;
	/**
	 * The target's own ally, used (together with `defenderAllySupport`) to
	 * derive `defenderSide`'s Friend Guard flag (ADR-0003, #13). See
	 * `attackerAlly`.
	 */
	defenderAlly?: TeamSlot;
	/** `defenderAlly`'s own team's shared manual ally-support overrides. See `attackerAllySupport`. */
	defenderAllySupport?: TeamAllySupport;
	/**
	 * The target's own team's shared side conditions (screens, Stealth
	 * Rock, Spikes) — merged onto `defenderSide` alongside Friend Guard.
	 * Unlike ally support, these have no Auto mode, so there's nothing to
	 * "omit to fall back to" — omitting this just means none are active.
	 */
	defenderSideConditions?: TeamSideConditions;
	/**
	 * `@smogon/calc`'s own `Field.gameType` — defaults to 'Doubles' when
	 * omitted, matching this app's own behavior before this option existed.
	 * See `FieldConditions.battleFormat`.
	 */
	battleFormat?: BattleFormat;
	/** Field-wide weather (#24) — shared by both sides, unlike ally support. */
	weather?: Weather;
	/** Field-wide terrain (#24). See `weather`. */
	terrain?: Terrain;
	/** The move Gravity's field effect (grounds Flying-types, Levitate/Air Balloon) — field-wide, see `weather`. */
	gravity?: boolean;
	/**
	 * The Ruin abilities' and Fairy Aura's `@smogon/calc` `Field` flags
	 * (`isVesselOfRuin`, `isFairyAura`, ...), pre-derived by
	 * `calc/fieldAbilities.ts` — field-wide like `weather`/`terrain`, since
	 * each affects every Pokemon (or every use of a given move type) on the
	 * field, not just one side.
	 */
	fieldAbilities?: ReturnType<typeof fieldAbilityFlags>;
}

function toSmogonMove(move: MoveItem, attacker: TeamSlot, options: DamageOptions = {}): Move {
	return new Move(GEN_NUM, move.name, {
		ability: attacker.ability ?? undefined,
		item: attacker.item?.name,
		isCrit: options.isCrit,
		hits: options.hits,
		// Always routed through basePowerWithAlliesFainted (a no-op for every
		// move with no Champions-specific patch or fainted-ally scaling)
		// rather than only passing `overrides` when one applies — see
		// `effectiveBasePower`'s own doc comment.
		overrides: { basePower: basePowerWithAlliesFainted(move, attacker.alliesFainted) }
	});
}

export interface DamageDisplay {
	/** e.g. "24.3 - 28.9" — a %HP min-max range, per CONTEXT.md's Damage Matrix cell convention. */
	percentRange: string;
	/** e.g. "guaranteed 3HKO", "48.4% chance to 2HKO" — `@smogon/calc`'s own annotation text. */
	koChance: string;
	result: Result;
}

function toPercent(damage: number, maxHP: number): string {
	return (Math.floor((damage * 1000) / maxHP) / 10).toFixed(1);
}

/**
 * Computes damage for one (attacker, move, target) triple. Defaults to a
 * `gameType: 'Doubles'` field unless `options.battleFormat` overrides it —
 * this app's roster is always a fixed 2vs2 regardless of that setting (see
 * `CONTEXT.md`), it only changes which of `@smogon/calc`'s own gameType-gated
 * mechanics apply, chiefly the Doubles spread-damage modifier on
 * `allAdjacent`/`allAdjacentFoes` moves; some other doubles-specific
 * mechanics (Follow Me redirection, ...) still aren't wired up regardless of
 * format. `options` layers the calculation-time overrides callers opt into
 * per move (assume-crit, a manual multi-hit count, ally support, battle
 * format, weather, terrain) on top of the move/attacker's own data — see
 * `DamageOptions`.
 */
export function computeDamage(
	attacker: TeamSlot,
	move: MoveItem,
	target: TeamSlot,
	options: DamageOptions = {}
): DamageDisplay {
	const attackerMon = toSmogonPokemon(attacker);
	const targetMon = toSmogonPokemon(target);
	const smogonMove = toSmogonMove(move, attacker, options);
	// attackerSideFlags/defenderSideFlags/sideConditionFlags are called
	// unconditionally — none of them require their TeamSlot/TeamAllySupport
	// arguments to be present (see attackerSideFlags' own doc comment): a
	// caller that passes attackerAllySupport with no attackerAlly still gets
	// Helping Hand/Tailwind/a forced static override applied, rather than
	// silently losing the whole side to all-false defaults. The two
	// defenderSide producers currently return disjoint flag names
	// (isFriendGuard vs. isProtected/isReflect/.../spikes) — if that ever
	// stops being true, the second spread below would silently win.
	const field = new Field({
		gameType: options.battleFormat ?? 'Doubles',
		weather: options.weather,
		terrain: options.terrain,
		isGravity: options.gravity,
		...options.fieldAbilities,
		attackerSide: attackerSideFlags(options.attackerAlly, options.attackerAllySupport),
		defenderSide: {
			...defenderSideFlags(options.defenderAlly, options.defenderAllySupport),
			...(options.defenderSideConditions ? sideConditionFlags(options.defenderSideConditions) : {})
		}
	});

	const result = calculate(GEN_NUM, attackerMon, targetMon, smogonMove, field);
	const [min, max] = result.range();
	const maxHP = targetMon.maxHP();

	// `result.fullDesc()` is what the Damage Matrix shows: `@smogon/calc`
	// writes stats as EVs and only names a base power for moves it computes
	// itself, so convert to Stat Points and always name the real BP.
	const desc = result.rawDesc;
	desc.attackEVs = evsTextToSps(desc.attackEVs);
	desc.HPEVs = evsTextToSps(desc.HPEVs);
	desc.defenseEVs = evsTextToSps(desc.defenseEVs);
	const basePower = basePowerWithAlliesFainted(move, attacker.alliesFainted);
	if (!desc.moveBP && basePower > 0) desc.moveBP = basePower;

	return {
		percentRange: `${toPercent(min, maxHP)} - ${toPercent(max, maxHP)}`,
		// err: false — a Status move, or a move the target is immune to, has
		// a top damage roll of 0, which @smogon/calc's own default (err:
		// true) treats as an error and throws on rather than reporting.
		koChance: result.kochance(false).text,
		result
	};
}
