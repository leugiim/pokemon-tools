import { championsGen, type SpeciesItem } from '$lib/modules/shared/species/generation';
import { pokeApiSlug } from './abilities';
import { SPEED_ABILITY_SLUGS } from './speedAbilitySlugs';
import { NONSTANDARD_SPECIES } from '$lib/modules/shared/species/nonstandardSpecies';
import {
	MAX_SP_PER_STAT,
	allNatures,
	calcChampionsStat,
	boostedStat,
	type NatureInfo
} from './format';

/** What a rival's Speed list assumes about its Speed investment and item. */
export interface SpeedList {
	id: string;
	label: string;
	sp: number;
	/** `minus`/`plus` = a nature that lowers/raises Speed; `neutral` touches nothing. */
	nature: 'minus' | 'neutral' | 'plus';
	scarf: boolean;
}

export const SPEED_LISTS: SpeedList[] = [
	{ id: '0-', label: '0 SP, −Spe', sp: 0, nature: 'minus', scarf: false },
	{ id: '0', label: '0 SP', sp: 0, nature: 'neutral', scarf: false },
	{ id: '32', label: '32 SP', sp: MAX_SP_PER_STAT, nature: 'neutral', scarf: false },
	{ id: '32+', label: '32 SP, +Spe', sp: MAX_SP_PER_STAT, nature: 'plus', scarf: false },
	{ id: '32-scarf', label: '32 SP, Scarf', sp: MAX_SP_PER_STAT, nature: 'neutral', scarf: true },
	{ id: '32+-scarf', label: '32 SP, +Spe, Scarf', sp: MAX_SP_PER_STAT, nature: 'plus', scarf: true }
];

/** What has to hold for an ability to double its holder's Speed. */
export type SpeedCondition =
	'sun' | 'rain' | 'sand' | 'snow' | 'electric-terrain' | 'item-consumed';

export const SPEED_CONDITION_LABELS: Record<SpeedCondition, string> = {
	sun: 'Sun',
	rain: 'Rain',
	sand: 'Sandstorm',
	snow: 'Snow',
	'electric-terrain': 'Electric Terrain',
	'item-consumed': 'Item consumed'
};

/**
 * Abilities that double Speed once their condition holds: a weather or
 * terrain, or Unburden's held item having been consumed. Quick Feet (a
 * status) isn't modelled.
 */
export const SPEED_ABILITIES: Record<string, SpeedCondition> = {
	Chlorophyll: 'sun',
	'Swift Swim': 'rain',
	'Sand Rush': 'sand',
	'Slush Rush': 'snow',
	'Surge Surfer': 'electric-terrain',
	Unburden: 'item-consumed'
};

export interface SpeedEntry {
	species: SpeciesItem;
	/** Set on an entry that only reaches this Speed with that ability's condition up. */
	ability?: string;
	condition?: SpeedCondition;
}

/** Every entry sharing one final Speed — grouped since many species tie. */
export interface SpeedGroup {
	speed: number;
	entries: SpeedEntry[];
}

/** A row of the list: a group of rivals, or where the user's own Pokémon sits. */
export type SpeedRow =
	| { kind: 'group'; group: SpeedGroup }
	| { kind: 'you'; speed: number }
	/** Same Speed as the user's — a speed tie. */
	| { kind: 'tie'; group: SpeedGroup };

function natureFor(kind: SpeedList['nature']): NatureInfo {
	// Jolly (+Spe, −SpA) and Brave (+Atk, −Spe) are the usual competitive picks.
	if (kind === 'plus') return allNatures.find((n) => n.name === 'Jolly')!;
	if (kind === 'minus') return allNatures.find((n) => n.name === 'Brave')!;
	return allNatures.find((n) => n.plus === n.minus)!;
}

/**
 * Chained the way the games do: Scarf (×1.5, floored), then an ability's
 * doubling, then Tailwind's doubling.
 */
export function applySpeedModifiers(
	stat: number,
	mods: { scarf?: boolean; abilityDouble?: boolean; tailwind?: boolean }
): number {
	let speed = stat;
	if (mods.scarf) speed = Math.floor(speed * 1.5);
	if (mods.abilityDouble) speed *= 2;
	if (mods.tailwind) speed *= 2;
	return speed;
}

/** The user's own Speed: stat, then stage, then Scarf and Tailwind. */
export function ownSpeed(args: {
	baseSpeed: number;
	sp: number;
	nature: NatureInfo;
	stage: number;
	scarf: boolean;
	tailwind: boolean;
}): number {
	const raw = calcChampionsStat(args.baseSpeed, 'spe', args.sp, args.nature);
	return applySpeedModifiers(boostedStat(raw, args.stage), {
		scarf: args.scarf,
		tailwind: args.tailwind
	});
}

/** A Mega Evolution holds its Mega Stone, so it can never also hold a Choice Scarf. */
export function isMega(species: SpeciesItem): boolean {
	return /-Mega(-|$)/.test(species.name);
}

/** Every species in Pokémon Champions' roster, Megas included. */
export const championsSpecies: SpeciesItem[] = [...championsGen.species].filter(
	(s) => !NONSTANDARD_SPECIES.has(s.name)
) as SpeciesItem[];

/**
 * Champions' own data only lists each species' first ability, so a
 * Chlorophyll Venusaur would never show up from it: its own ability plus
 * the snapshot in {@link SPEED_ABILITY_SLUGS}. That can over-include an
 * ability Champions doesn't actually offer; it's never missing one it does.
 */
function speedAbilitiesOf(species: SpeciesItem): string[] {
	const slug = pokeApiSlug(species);
	const found = new Set<string>(
		Object.values(species.abilities ?? {}).filter((a) => a in SPEED_ABILITIES)
	);
	for (const [ability, slugs] of Object.entries(SPEED_ABILITY_SLUGS)) {
		if (slugs.includes(slug)) found.add(ability);
	}
	return [...found];
}

/**
 * Every rival at one list's assumptions, grouped by final Speed and sorted
 * fastest first. A species with a Speed ability also gets a
 * separate entry with that ability's doubling, unless `includeAbilities`
 * is off. Megas are left out of Scarf lists: they hold their Mega Stone.
 */
export function speedGroups(
	list: SpeedList,
	opts: { tailwind: boolean; includeAbilities: boolean },
	species: SpeciesItem[] = championsSpecies
): SpeedGroup[] {
	const nature = natureFor(list.nature);
	const bySpeed = new Map<number, SpeedEntry[]>();
	const add = (speed: number, entry: SpeedEntry) => {
		const entries = bySpeed.get(speed);
		if (entries) entries.push(entry);
		else bySpeed.set(speed, [entry]);
	};

	for (const s of species) {
		if (list.scarf && isMega(s)) continue;
		const stat = calcChampionsStat(s.baseStats.spe, 'spe', list.sp, nature);
		add(applySpeedModifiers(stat, { scarf: list.scarf, tailwind: opts.tailwind }), { species: s });
		if (!opts.includeAbilities) continue;
		for (const ability of speedAbilitiesOf(s)) {
			const condition = SPEED_ABILITIES[ability];
			if (!condition) continue;
			add(
				applySpeedModifiers(stat, {
					scarf: list.scarf,
					abilityDouble: true,
					tailwind: opts.tailwind
				}),
				{ species: s, ability, condition }
			);
		}
	}

	return [...bySpeed]
		.sort(([a], [b]) => b - a)
		.map(([speed, entries]) => ({
			speed,
			entries: entries.sort((a, b) => a.species.name.localeCompare(b.species.name))
		}));
}

/** The groups with the user's own Speed slotted in — faster rivals above, slower below. */
export function withYou(groups: SpeedGroup[], you: number): SpeedRow[] {
	const rows: SpeedRow[] = [];
	let placed = false;
	for (const group of groups) {
		if (!placed && group.speed < you) {
			rows.push({ kind: 'you', speed: you });
			placed = true;
		}
		if (group.speed === you) {
			rows.push({ kind: 'tie', group });
			placed = true;
		} else {
			rows.push({ kind: 'group', group });
		}
	}
	if (!placed) rows.push({ kind: 'you', speed: you });
	return rows;
}
