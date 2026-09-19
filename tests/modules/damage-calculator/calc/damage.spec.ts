import { describe, expect, it } from 'vitest';
import { calcStat } from '@smogon/calc';
import { GEN_NUM, allSpecies } from '$lib/modules/shared/species/generation';
import {
	allNatures,
	calcChampionsStat,
	STAT_ORDER,
	type NatureName
} from '$lib/modules/damage-calculator/calc/format';
import { allItems } from '$lib/modules/damage-calculator/calc/items';
import { allMoves } from '$lib/modules/damage-calculator/calc/moves';
import {
	defaultTeamAllySupport,
	defaultTeamSideConditions,
	TeamSlot
} from '$lib/modules/damage-calculator/stores/team.svelte';
import { computeDamage, toSmogonPokemon } from '$lib/modules/damage-calculator/calc/damage';

function nature(name: NatureName) {
	return allNatures.find((n) => n.name === name)!;
}

function species(name: string) {
	return allSpecies.find((s) => s.name === name)!;
}

function move(name: string) {
	return allMoves.find((m) => m.name === name)!;
}

function item(name: string) {
	return allItems.find((i) => i.name === name)!;
}

/** A fully-built team slot, ready to feed into `@smogon/calc`. */
function buildSlot({
	speciesName,
	ability,
	itemName,
	natureName,
	statPoints,
	moveNames
}: {
	speciesName: string;
	ability: string;
	itemName?: string;
	natureName: NatureName;
	statPoints: Partial<Record<(typeof STAT_ORDER)[number], number>>;
	moveNames: string[];
}): TeamSlot {
	const slot = new TeamSlot();
	slot.species = species(speciesName);
	slot.ability = ability;
	if (itemName) slot.item = item(itemName);
	slot.nature = nature(natureName);
	slot.statPoints = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...statPoints };
	slot.moves = [moveNames[0] ? move(moveNames[0]) : null, null, null, null];
	return slot;
}

describe('toSmogonPokemon', () => {
	it('throws when the slot has no species selected', () => {
		expect(() => toSmogonPokemon(new TeamSlot())).toThrow();
	});

	it('carries over species, ability, item, nature and level onto the built Pokemon', () => {
		const slot = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			itemName: 'Life Orb',
			natureName: 'Jolly',
			statPoints: { atk: 32, spe: 32 },
			moveNames: ['Earthquake']
		});

		const mon = toSmogonPokemon(slot);

		expect(mon.name).toBe('Garchomp');
		expect(mon.ability).toBe('Rough Skin');
		expect(mon.item).toBe('Life Orb');
		expect(mon.nature).toBe('Jolly');
		expect(mon.level).toBe(50);
	});

	it("maps every Stat Point value 0..32 onto exactly the stat Champions' own formula gives, for every stat and every nature relationship to it", () => {
		// Boosted (Modest -> SpA), hindered (Modest -> Atk), and untouched
		// (Modest -> Def) all need to round-trip identically.
		for (const natureName of ['Modest'] as NatureName[]) {
			for (const stat of STAT_ORDER) {
				for (let sp = 0; sp <= 32; sp++) {
					const slot = buildSlot({
						speciesName: 'Garchomp',
						ability: 'Rough Skin',
						natureName,
						statPoints: { [stat]: sp },
						moveNames: ['Earthquake']
					});

					const mon = toSmogonPokemon(slot);

					expect(mon.rawStats[stat]).toBe(
						calcChampionsStat(slot.species!.baseStats[stat], stat, sp, slot.nature)
					);
				}
			}
		}
	});

	it("agrees with @smogon/calc's own stat calculator at 0 SP — the one point where both formulas must coincide", () => {
		// At SP=0 there's no floor(EV/4) step to diverge on, so Champions'
		// formula and @smogon/calc's own EV-based one must land on the same
		// number. This is the closest thing to an external oracle we have
		// for the mapping without a published worked example to check against.
		const slot = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Jolly',
			statPoints: {},
			moveNames: ['Earthquake']
		});

		const mon = toSmogonPokemon(slot);

		for (const stat of STAT_ORDER) {
			const expected = calcStat(GEN_NUM, stat, slot.species!.baseStats[stat], 31, 0, 50, 'Jolly');
			expect(mon.rawStats[stat]).toBe(expected);
		}
	});

	it("survives the internal clone() that @smogon/calc's calculate() performs on its inputs", () => {
		// A naive implementation that overwrites `rawStats` after
		// construction loses that override here: `clone()` rebuilds the
		// Pokemon from `ivs`/`evs`/`nature`, not from `rawStats`.
		const slot = buildSlot({
			speciesName: 'Slaking',
			ability: 'Truant',
			natureName: 'Adamant',
			statPoints: { atk: 20 },
			moveNames: ['Zen Headbutt']
		});

		const mon = toSmogonPokemon(slot);
		const cloned = mon.clone();

		expect(cloned.rawStats.atk).toBe(mon.rawStats.atk);
		expect(cloned.rawStats.atk).toBe(
			calcChampionsStat(slot.species!.baseStats.atk, 'atk', 20, slot.nature)
		);
	});

	it("carries the slot's own stat stages onto the built Pokemon", () => {
		const slot = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Jolly',
			statPoints: {},
			moveNames: ['Earthquake']
		});
		slot.boosts.atk = 2;
		slot.boosts.spe = -1;

		const mon = toSmogonPokemon(slot);

		expect(mon.boosts.atk).toBe(2);
		expect(mon.boosts.spe).toBe(-1);
		expect(mon.boosts.def).toBe(0);
	});
});

describe('computeDamage', () => {
	it("uses Slash's Champions base power (80), not @smogon/calc's own SV value (70)", () => {
		const attacker = buildSlot({
			speciesName: 'Absol',
			ability: 'Pressure',
			natureName: 'Hardy',
			statPoints: { atk: 20 },
			moveNames: ['Slash']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

		expect(result.move.bp).toBe(80);
	});

	it('calculates on a Doubles field by default', () => {
		const attacker = buildSlot({
			speciesName: 'Slaking',
			ability: 'Truant',
			natureName: 'Hardy',
			statPoints: { atk: 20 },
			moveNames: ['Zen Headbutt']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

		expect(result.field.gameType).toBe('Doubles');
	});

	it('honors `battleFormat` to calculate on a Singles field instead', () => {
		const attacker = buildSlot({
			speciesName: 'Slaking',
			ability: 'Truant',
			natureName: 'Hardy',
			statPoints: { atk: 20 },
			moveNames: ['Zen Headbutt']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender, {
			battleFormat: 'Singles'
		});

		expect(result.field.gameType).toBe('Singles');
	});

	it("drops Doubles' spread-damage reduction on an allAdjacent move (Earthquake) when `battleFormat` is 'Singles'", () => {
		const attacker = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Jolly',
			statPoints: { atk: 20 },
			moveNames: ['Earthquake']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const doubles = computeDamage(attacker, attacker.moves[0]!, defender);
		const singles = computeDamage(attacker, attacker.moves[0]!, defender, {
			battleFormat: 'Singles'
		});

		const [doublesMin, doublesMax] = doubles.result.range();
		const [singlesMin, singlesMax] = singles.result.range();
		expect(singlesMin).toBeGreaterThan(doublesMin);
		expect(singlesMax).toBeGreaterThan(doublesMax);
	});

	it('matches a hand-computed %HP range and KO chance for a known, modifier-free build', () => {
		// Slaking (Normal) using the Psychic-type Zen Headbutt against
		// Snorlax (Normal): no STAB, neutral type effectiveness, no items,
		// no boosting abilities, neutral natures on the stats involved —
		// isolates the Stat Points -> damage path from every other modifier.
		//
		// Atk: base 160, 20 SP, neutral nature -> raw = floor((320+31)*50/100) = 175;
		//      stat = floor(175+5+20) = 200
		// Def: base 65, 15 SP, neutral nature -> raw = floor((130+31)*50/100) = 80;
		//      stat = floor(80+5+15) = 100
		// HP:  base 160, 0 SP -> raw = floor((320+31)*50/100) = 175; stat = 175+60 = 235
		//
		// Damage (gen 9, no crit, BP 80, level 50):
		//   floor(floor(2*50/5+2) * 80 * 200 / 100 / 50) + 2
		//     = floor(floor(22*80*200/100)/50) + 2 = floor(3520/50) + 2 = 70 + 2 = 72
		//   min = floor(72*0.85) = 61, max = floor(72*1.00) = 72
		//   %HP: floor(61*1000/235)/10 = 25.9, floor(72*1000/235)/10 = 30.6
		const attacker = buildSlot({
			speciesName: 'Slaking',
			ability: 'Truant',
			natureName: 'Hardy',
			statPoints: { atk: 20 },
			moveNames: ['Zen Headbutt']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const { result, percentRange, koChance } = computeDamage(
			attacker,
			attacker.moves[0]!,
			defender
		);

		expect(result.range()).toEqual([61, 72]);
		expect(percentRange).toBe('25.9 - 30.6');
		expect(koChance.length).toBeGreaterThan(0);
	});

	it('does not throw for a Status move — @smogon/calc treats a 0 top damage roll as an error by default', () => {
		const attacker = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Jolly',
			statPoints: {},
			moveNames: ['Swords Dance']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: {},
			moveNames: ['Tackle']
		});

		expect(() => computeDamage(attacker, attacker.moves[0]!, defender)).not.toThrow();
		const { koChance } = computeDamage(attacker, attacker.moves[0]!, defender);
		expect(koChance).toBe('');
	});

	it('does not assume a crit by default — "assume crit" is an opt-in recalculation (#14)', () => {
		const attacker = buildSlot({
			speciesName: 'Slaking',
			ability: 'Truant',
			natureName: 'Hardy',
			statPoints: { atk: 20 },
			moveNames: ['Zen Headbutt']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

		expect(result.move.isCrit).toBe(false);
	});

	it('recalculates assuming a critical hit when isCrit is passed (#14)', () => {
		const attacker = buildSlot({
			speciesName: 'Slaking',
			ability: 'Truant',
			natureName: 'Hardy',
			statPoints: { atk: 20 },
			moveNames: ['Zen Headbutt']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: { def: 15 },
			moveNames: ['Tackle']
		});

		const normal = computeDamage(attacker, attacker.moves[0]!, defender);
		const crit = computeDamage(attacker, attacker.moves[0]!, defender, { isCrit: true });

		expect(crit.result.move.isCrit).toBe(true);
		// A crit's top roll must exceed the non-crit range's top roll — Snorlax
		// has no crit-affecting ability/item here, so this can't tie.
		expect(crit.result.range()[1]).toBeGreaterThan(normal.result.range()[1]);
	});

	it("defaults a multi-hit move to 3 hits, matching @smogon/calc's own default (#15)", () => {
		const attacker = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Jolly',
			statPoints: {},
			moveNames: ['Bullet Seed']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: {},
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

		expect(result.move.hits).toBe(3);
	});

	it("respects an ability that fixes a multi-hit move's hit count (Skill Link) automatically (#15)", () => {
		const attacker = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Skill Link',
			natureName: 'Jolly',
			statPoints: {},
			moveNames: ['Bullet Seed']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: {},
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

		expect(result.move.hits).toBe(5);
	});

	it('lets a manual hits override take priority for a multi-hit move (#15)', () => {
		const attacker = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Jolly',
			statPoints: {},
			moveNames: ['Bullet Seed']
		});
		const defender = buildSlot({
			speciesName: 'Snorlax',
			ability: 'Immunity',
			natureName: 'Hardy',
			statPoints: {},
			moveNames: ['Tackle']
		});

		const { result } = computeDamage(attacker, attacker.moves[0]!, defender, { hits: 5 });

		expect(result.move.hits).toBe(5);
	});

	describe('ally support (ADR-0003, #13)', () => {
		it('applies no ally support flags when attackerAlly/defenderAlly are omitted', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

			expect(result.field.attackerSide.isPowerSpot).toBe(false);
			expect(result.field.defenderSide.isFriendGuard).toBe(false);
		});

		it('still applies Helping Hand/Tailwind and a manual static override from *AllySupport alone, even with no *Ally TeamSlot passed at all', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender, {
				attackerAllySupport: { ...defaultTeamAllySupport(), helpingHand: true, powerSpot: true },
				defenderAllySupport: { ...defaultTeamAllySupport(), friendGuard: true }
			});

			expect(result.field.attackerSide.isHelpingHand).toBe(true);
			expect(result.field.attackerSide.isPowerSpot).toBe(true);
			expect(result.field.defenderSide.isFriendGuard).toBe(true);
		});

		it("boosts the attacker's damage when attackerAlly has Power Spot", () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const ally = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Power Spot',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const withoutSupport = computeDamage(attacker, attacker.moves[0]!, defender);
			const withSupport = computeDamage(attacker, attacker.moves[0]!, defender, {
				attackerAlly: ally
			});

			expect(withSupport.result.field.attackerSide.isPowerSpot).toBe(true);
			expect(withSupport.result.range()[1]).toBeGreaterThan(withoutSupport.result.range()[1]);
		});

		it('reduces damage taken when defenderAlly has Friend Guard', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});
			const defenderAlly = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Friend Guard',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});

			const withoutSupport = computeDamage(attacker, attacker.moves[0]!, defender);
			const withSupport = computeDamage(attacker, attacker.moves[0]!, defender, {
				defenderAlly
			});

			expect(withSupport.result.field.defenderSide.isFriendGuard).toBe(true);
			expect(withSupport.result.range()[1]).toBeLessThan(withoutSupport.result.range()[1]);
		});

		it('does not derive Power Spot support from defenderAlly, nor Friend Guard from attackerAlly', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});
			const misplacedAlly = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Power Spot',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender, {
				defenderAlly: misplacedAlly
			});

			expect(result.field.attackerSide.isPowerSpot).toBe(false);
			expect(result.field.defenderSide.isFriendGuard).toBe(false);
		});

		it('lets a team-wide override force Battery on for a Special move despite no ally actually having it', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Pulse']
			});
			const ally = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Levitate',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender, {
				attackerAlly: ally,
				attackerAllySupport: { ...defaultTeamAllySupport(), battery: true }
			});

			expect(result.field.attackerSide.isBattery).toBe(true);
		});

		it('applies the team-wide Helping Hand toggle via attackerAllySupport', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const ally = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Multiscale',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const withoutSupport = computeDamage(attacker, attacker.moves[0]!, defender);
			const withSupport = computeDamage(attacker, attacker.moves[0]!, defender, {
				attackerAlly: ally,
				attackerAllySupport: { ...defaultTeamAllySupport(), helpingHand: true }
			});

			expect(withSupport.result.field.attackerSide.isHelpingHand).toBe(true);
			expect(withSupport.result.range()[1]).toBeGreaterThan(withoutSupport.result.range()[1]);
		});

		it("auto mode credits only the ally that really has the ability, never a teammate who doesn't (team-wide toggle scoping)", () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const holderAlly = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Power Spot',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});
			const nonHolderAlly = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Multiscale',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});
			const support = defaultTeamAllySupport();

			const viaHolder = computeDamage(attacker, attacker.moves[0]!, defender, {
				attackerAlly: holderAlly,
				attackerAllySupport: support
			});
			const viaNonHolder = computeDamage(attacker, attacker.moves[0]!, defender, {
				attackerAlly: nonHolderAlly,
				attackerAllySupport: support
			});

			expect(viaHolder.result.field.attackerSide.isPowerSpot).toBe(true);
			expect(viaNonHolder.result.field.attackerSide.isPowerSpot).toBe(false);
		});
	});

	describe('field conditions: weather and terrain (#24)', () => {
		it('applies no weather/terrain when omitted', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

			expect(result.field.weather).toBeUndefined();
			expect(result.field.terrain).toBeUndefined();
		});

		it('boosts a Water-type move under Rain', () => {
			const attacker = buildSlot({
				speciesName: 'Barraskewda',
				ability: 'Swift Swim',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Liquidation']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const noWeather = computeDamage(attacker, attacker.moves[0]!, defender);
			const rain = computeDamage(attacker, attacker.moves[0]!, defender, { weather: 'Rain' });

			expect(rain.result.field.weather).toBe('Rain');
			expect(rain.result.range()[1]).toBeGreaterThan(noWeather.result.range()[1]);
		});

		it('boosts a Grass-type move on Grassy Terrain', () => {
			const attacker = buildSlot({
				speciesName: 'Rillaboom',
				ability: 'Grassy Surge',
				natureName: 'Adamant',
				statPoints: {},
				moveNames: ['Wood Hammer']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const noTerrain = computeDamage(attacker, attacker.moves[0]!, defender);
			const grassyTerrain = computeDamage(attacker, attacker.moves[0]!, defender, {
				terrain: 'Grassy'
			});

			expect(grassyTerrain.result.field.terrain).toBe('Grassy');
			expect(grassyTerrain.result.range()[1]).toBeGreaterThan(noTerrain.result.range()[1]);
		});
	});

	describe('side conditions: screens, Protect, hazards', () => {
		it('applies no side conditions when defenderSideConditions is omitted', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender);

			expect(result.field.defenderSide.isProtected).toBe(false);
			expect(result.field.defenderSide.spikes).toBe(0);
		});

		it('zeroes damage when the defender team has Protect up', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender, {
				defenderSideConditions: { ...defaultTeamSideConditions(), protect: true }
			});

			expect(result.range()).toEqual([0, 0]);
		});

		it('merges side conditions with Friend Guard onto the same defenderSide, rather than one overwriting the other', () => {
			const attacker = buildSlot({
				speciesName: 'Garchomp',
				ability: 'Rough Skin',
				natureName: 'Jolly',
				statPoints: {},
				moveNames: ['Dragon Claw']
			});
			const defender = buildSlot({
				speciesName: 'Snorlax',
				ability: 'Immunity',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: ['Tackle']
			});
			const defenderAlly = buildSlot({
				speciesName: 'Dragonite',
				ability: 'Friend Guard',
				natureName: 'Hardy',
				statPoints: {},
				moveNames: []
			});

			const { result } = computeDamage(attacker, attacker.moves[0]!, defender, {
				defenderAlly,
				defenderSideConditions: { ...defaultTeamSideConditions(), reflect: true }
			});

			expect(result.field.defenderSide.isFriendGuard).toBe(true);
			expect(result.field.defenderSide.isReflect).toBe(true);
		});
	});
});

describe('fainted allies', () => {
	function kingambit(moveName: string) {
		return buildSlot({
			speciesName: 'Kingambit',
			ability: 'Supreme Overlord',
			natureName: 'Adamant',
			statPoints: { atk: 32 },
			moveNames: [moveName]
		});
	}
	const target = () =>
		buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Adamant',
			statPoints: {},
			moveNames: []
		});

	it('feeds alliesFainted into the smogon Pokemon', () => {
		const slot = kingambit('Kowtow Cleave');
		slot.alliesFainted = 3;
		expect(toSmogonPokemon(slot).alliesFainted).toBe(3);
	});

	it('Supreme Overlord raises damage with more fainted allies', () => {
		const slot = kingambit('Sucker Punch');
		const m = slot.moves[0]!;
		const damage = (n: number) => {
			slot.alliesFainted = n;
			return computeDamage(slot, m, target()).result.range()[1];
		};
		expect(damage(3)).toBeGreaterThan(damage(0));
		expect(damage(5)).toBeGreaterThan(damage(3));
	});

	it('Last Respects scales its base power by 50 per fainted ally', () => {
		const slot = kingambit('Last Respects');
		slot.ability = 'Defiant';
		const m = slot.moves[0]!;
		const damage = (n: number) => {
			slot.alliesFainted = n;
			return computeDamage(slot, m, target()).result.range()[1];
		};
		expect(damage(2)).toBeGreaterThan(damage(0) * 2.5);
	});

	it('resets on a different species but not within the family', () => {
		const slot = kingambit('Sucker Punch');
		slot.alliesFainted = 4;
		slot.species = species('Garchomp');
		expect(slot.alliesFainted).toBe(0);
	});
});

describe('damage description', () => {
	it('names Stat Points instead of EVs, and the move base power', () => {
		const attacker = buildSlot({
			speciesName: 'Basculegion',
			ability: 'Adaptability',
			natureName: 'Adamant',
			statPoints: { atk: 32 },
			moveNames: ['Last Respects']
		});
		attacker.alliesFainted = 1;
		const target = buildSlot({
			speciesName: 'Kingambit',
			ability: 'Defiant',
			natureName: 'Adamant',
			statPoints: { hp: 32 },
			moveNames: []
		});
		const text = computeDamage(attacker, attacker.moves[0]!, target).result.fullDesc('%', false);
		expect(text).toContain('32+ Atk Adaptability Basculegion Last Respects (100 BP)');
		expect(text).toContain('vs. 32 HP / 0 Def Kingambit');
	});
});

describe('Protean / Libero current type', () => {
	const build = () => {
		const attacker = buildSlot({
			speciesName: 'Greninja',
			ability: 'Protean',
			natureName: 'Modest',
			statPoints: { spa: 32 },
			moveNames: ['Flamethrower']
		});
		const defender = buildSlot({
			speciesName: 'Garchomp',
			ability: 'Rough Skin',
			natureName: 'Hardy',
			statPoints: {},
			moveNames: ['Earthquake']
		});
		return { attacker, defender };
	};
	const damage = (attacker: TeamSlot, defender: TeamSlot) =>
		computeDamage(attacker, attacker.moves[0]!, defender).result.range()[1];

	it('Auto gives STAB on every move, as the calc does', () => {
		const { attacker, defender } = build();
		const auto = damage(attacker, defender);
		attacker.currentType = 'Fire';
		expect(damage(attacker, defender)).toBe(auto);
	});

	it('a pinned type that does not match the move drops the STAB', () => {
		const { attacker, defender } = build();
		const auto = damage(attacker, defender);
		attacker.currentType = 'Water';
		const noStab = damage(attacker, defender);
		expect(noStab).toBeLessThan(auto);
		expect(Math.abs(noStab - auto / 1.5)).toBeLessThan(auto * 0.03);
	});

	it('loses the native types too: a pinned Fire Greninja has no Water or Dark STAB', () => {
		const { attacker, defender } = build();
		const dmg = (name: string) => computeDamage(attacker, move(name), defender).result.range()[1];
		const surfAuto = dmg('Surf');
		const darkAuto = dmg('Dark Pulse');
		attacker.currentType = 'Fire';
		expect(dmg('Surf')).toBeLessThan(surfAuto);
		expect(dmg('Dark Pulse')).toBeLessThan(darkAuto);
		expect(dmg('Flamethrower')).toBe(
			computeDamage(build().attacker, move('Flamethrower'), defender).result.range()[1]
		);
	});

	it('takes damage as the pinned type only', () => {
		const { attacker, defender } = build();
		const quake = (target: TeamSlot) =>
			computeDamage(defender, move('Earthquake'), target).result.range()[1];
		// Ground: neutral into Water/Dark, super effective into pure Fire.
		const asWaterDark = quake(attacker);
		attacker.currentType = 'Fire';
		expect(toSmogonPokemon(attacker).types).toEqual(['Fire', '???']);
		expect(quake(attacker)).toBeGreaterThan(asWaterDark * 1.9);
	});

	it('is ignored when the ability is not Protean/Libero, and reset on a species change', () => {
		const { attacker } = build();
		attacker.currentType = 'Water';
		expect(attacker.types).toEqual(['Water']);
		attacker.ability = 'Torrent';
		expect(attacker.types).toEqual(['Water', 'Dark']);
		attacker.ability = 'Protean';
		attacker.species = species('Cinderace');
		expect(attacker.currentType).toBeNull();
	});
});
