import { Generations, toID } from '@smogon/calc';
import { NONSTANDARD_SPECIES } from './nonstandardSpecies';

/**
 * We only target the current generation (VGC is always played on the
 * latest one) — no generation switcher for now.
 */
export const GEN_NUM = 9;

export const gen = Generations.get(GEN_NUM);

/**
 * `@smogon/calc`'s own dedicated Pokémon Champions data set — a genuinely
 * separate generation slot (`0`, not a variant of gen 9) that a handful of
 * moves' base power has diverged from mainline Scarlet/Violet on
 * (`calc/moves.ts`'s `effectiveBasePower`, ADR-0005). Deliberately **not**
 * used as `gen`/`GEN_NUM` itself: Champions' own roster is a much smaller,
 * still-growing subset of SV's — 359 species and 526 moves against SV's
 * 1406 and 942 at the time this was checked — so building the species/move/
 * item/ability pickers off it would silently drop most of what this app
 * currently supports, not just fix move power.
 */
export const championsGen = Generations.get(0);

/**
 * All species available in this generation, sorted alphabetically —
 * excluding CAP (fan-made) mons and other non-standard entries that
 * aren't real, in-game-obtainable Pokémon. See {@link NONSTANDARD_SPECIES}.
 */
export const allSpecies = [...gen.species]
	.filter((s) => !NONSTANDARD_SPECIES.has(s.name))
	.sort((a, b) => a.name.localeCompare(b.name));

export type SpeciesItem = (typeof allSpecies)[number];

function find(name: string): SpeciesItem {
	const s = allSpecies.find((s) => s.name === name);
	if (!s) throw new Error(`generation.ts: expected species not found: ${name}`);
	return s;
}

/**
 * True for a Mega Evolution — a battle-time transformation you'd normally
 * trigger by holding its Mega Stone, not a distinct Pokémon you'd catch and
 * pick from a dex list the way a regional form (Alolan, Galarian,
 * Hisuian...) is. This is the generic, no-hand-rolling-needed case;
 * anything caught by {@link FORM_FAMILIES} instead is handled there and
 * never reaches this.
 *
 * Gigantamax forms used to belong here too, but `@smogon/calc`'s gen 9 data
 * no longer has any — Gigantamax was never actually available in
 * Scarlet/Violet (it's a Sword/Shield-only mechanic), and upstream removed
 * the SV entries that had incorrectly carried it over (`vendor/smogon-calc`,
 * ADR-0005).
 */
function isBattleOnlyForme(species: SpeciesItem): boolean {
	if (!species.baseSpecies) return false;
	const suffix = species.name.slice(species.baseSpecies.length + 1);
	return suffix === 'Mega' || suffix.startsWith('Mega-');
}

/** "Mega-X" -> "Mega X", "Mega" -> "Mega". */
function formeLabel(species: SpeciesItem): string {
	return species.name.slice(species.baseSpecies!.length + 1).replace('-', ' ');
}

const FORM_ORDER: Record<string, number> = {
	Mega: 0,
	'Mega X': 1,
	'Mega Y': 2,
	'Mega Z': 3
};

const battleFormsByBase = new Map<string, { label: string; species: SpeciesItem }[]>();
for (const s of allSpecies) {
	if (!isBattleOnlyForme(s)) continue;
	const list = battleFormsByBase.get(s.baseSpecies!) ?? [];
	list.push({ label: formeLabel(s), species: s });
	battleFormsByBase.set(s.baseSpecies!, list);
}
for (const list of battleFormsByBase.values()) {
	list.sort((a, b) => (FORM_ORDER[a.label] ?? 99) - (FORM_ORDER[b.label] ?? 99));
}

/** The 18 types, in the order Arceus/Silvally's plates/memories are conventionally listed. */
const PLATE_TYPES = [
	'Normal',
	'Fire',
	'Water',
	'Electric',
	'Grass',
	'Ice',
	'Fighting',
	'Poison',
	'Ground',
	'Flying',
	'Psychic',
	'Bug',
	'Rock',
	'Ghost',
	'Dragon',
	'Dark',
	'Steel',
	'Fairy'
];

function typePlateFamily(base: string): { label: string; name: string }[] {
	return PLATE_TYPES.map((type) => ({
		label: type,
		name: type === 'Normal' ? base : `${base}-${type}`
	}));
}

/**
 * Species whose alt formes need hand-rolling instead of the generic
 * `baseSpecies`-suffix rule above — because the data doesn't cleanly
 * support deriving them (Aegislash has no plain "Aegislash" to be a
 * `baseSpecies` for either of its formes), or because it's not a
 * battle-only Mega Evolution but the same "pick species, then
 * pick which forme" UI still fits: a stance/state change (Aegislash,
 * Darmanitan, Cherrim, Castform, Morpeko, Eiscue, Minior, Mimikyu,
 * Wishiwashi, Meloetta, Cramorant, Palafin, Terapagos), an
 * item/fusion-triggered transformation exactly analogous to a Mega
 * Evolution (Giratina, Dialga, Palkia, Groudon, Kyogre, Zacian,
 * Zamazenta, Hoopa, Kyurem, Necrozma, Calyrex), a held-plate/memory
 * typing change (Arceus, Silvally, Genesect), or a permanent
 * per-individual choice we're still choosing to expose as a forme
 * picker rather than flat entries (Urshifu, Ogerpon, Toxtricity,
 * Basculin, Rotom, the Therian trio + Enamorus, Pumpkaboo/Gourgeist).
 *
 * Each family's first member is its "Normal" — what shows up in the
 * main Pokémon picker; the rest are only reachable via {@link formsOf}.
 * Darmanitan needs *two* families (Kantonian and Galarian) since the
 * data flattens both onto the same `baseSpecies` — Galarian Darmanitan
 * still needs to stay its own entry in the main picker, the way any
 * other regional forme does.
 */
const FORM_FAMILIES: { label: string; name: string }[][] = [
	[
		{ label: 'Shield', name: 'Aegislash-Shield' },
		{ label: 'Blade', name: 'Aegislash-Blade' }
	],
	typePlateFamily('Arceus'),
	typePlateFamily('Silvally'),
	[
		{ label: 'Normal', name: 'Genesect' },
		{ label: 'Douse', name: 'Genesect-Douse' },
		{ label: 'Shock', name: 'Genesect-Shock' },
		{ label: 'Burn', name: 'Genesect-Burn' },
		{ label: 'Chill', name: 'Genesect-Chill' }
	],
	[
		{ label: 'Altered', name: 'Giratina' },
		{ label: 'Origin', name: 'Giratina-Origin' }
	],
	[
		{ label: 'Normal', name: 'Dialga' },
		{ label: 'Origin', name: 'Dialga-Origin' }
	],
	[
		{ label: 'Normal', name: 'Palkia' },
		{ label: 'Origin', name: 'Palkia-Origin' }
	],
	[
		{ label: 'Normal', name: 'Groudon' },
		{ label: 'Primal', name: 'Groudon-Primal' }
	],
	[
		{ label: 'Normal', name: 'Kyogre' },
		{ label: 'Primal', name: 'Kyogre-Primal' }
	],
	[
		{ label: 'Hero', name: 'Zacian' },
		{ label: 'Crowned', name: 'Zacian-Crowned' }
	],
	[
		{ label: 'Hero', name: 'Zamazenta' },
		{ label: 'Crowned', name: 'Zamazenta-Crowned' }
	],
	[
		{ label: 'Confined', name: 'Hoopa' },
		{ label: 'Unbound', name: 'Hoopa-Unbound' }
	],
	[
		{ label: 'Normal', name: 'Kyurem' },
		{ label: 'Black', name: 'Kyurem-Black' },
		{ label: 'White', name: 'Kyurem-White' }
	],
	[
		{ label: 'Normal', name: 'Necrozma' },
		{ label: 'Dusk Mane', name: 'Necrozma-Dusk-Mane' },
		{ label: 'Dawn Wings', name: 'Necrozma-Dawn-Wings' },
		{ label: 'Ultra', name: 'Necrozma-Ultra' }
	],
	[
		{ label: 'Normal', name: 'Calyrex' },
		{ label: 'Ice Rider', name: 'Calyrex-Ice' },
		{ label: 'Shadow Rider', name: 'Calyrex-Shadow' }
	],
	[
		{ label: 'Standard', name: 'Darmanitan' },
		{ label: 'Zen', name: 'Darmanitan-Zen' }
	],
	[
		{ label: 'Standard', name: 'Darmanitan-Galar' },
		{ label: 'Zen', name: 'Darmanitan-Galar-Zen' }
	],
	[
		{ label: 'Overcast', name: 'Cherrim' },
		{ label: 'Sunshine', name: 'Cherrim-Sunshine' }
	],
	[
		{ label: 'Normal', name: 'Castform' },
		{ label: 'Sunny', name: 'Castform-Sunny' },
		{ label: 'Rainy', name: 'Castform-Rainy' },
		{ label: 'Snowy', name: 'Castform-Snowy' }
	],
	[
		{ label: 'Full Belly', name: 'Morpeko' },
		{ label: 'Hangry', name: 'Morpeko-Hangry' }
	],
	[
		{ label: 'Ice Face', name: 'Eiscue' },
		{ label: 'Noice', name: 'Eiscue-Noice' }
	],
	[
		{ label: 'Core', name: 'Minior' },
		{ label: 'Meteor', name: 'Minior-Meteor' }
	],
	[
		{ label: 'Disguised', name: 'Mimikyu' },
		{ label: 'Busted', name: 'Mimikyu-Busted' }
	],
	[
		{ label: 'Solo', name: 'Wishiwashi' },
		{ label: 'School', name: 'Wishiwashi-School' }
	],
	[
		{ label: 'Aria', name: 'Meloetta' },
		{ label: 'Pirouette', name: 'Meloetta-Pirouette' }
	],
	[
		{ label: 'Normal', name: 'Cramorant' },
		{ label: 'Gulping', name: 'Cramorant-Gulping' },
		{ label: 'Gorging', name: 'Cramorant-Gorging' }
	],
	[
		{ label: 'Zero', name: 'Palafin' },
		{ label: 'Hero', name: 'Palafin-Hero' }
	],
	[
		{ label: 'Normal', name: 'Terapagos' },
		{ label: 'Terastal', name: 'Terapagos-Terastal' },
		{ label: 'Stellar', name: 'Terapagos-Stellar' }
	],
	[
		{ label: 'Single Strike', name: 'Urshifu' },
		{ label: 'Rapid Strike', name: 'Urshifu-Rapid-Strike' }
	],
	[
		{ label: 'Teal', name: 'Ogerpon' },
		{ label: 'Wellspring', name: 'Ogerpon-Wellspring' },
		{ label: 'Hearthflame', name: 'Ogerpon-Hearthflame' },
		{ label: 'Cornerstone', name: 'Ogerpon-Cornerstone' },
		{ label: 'Teal Tera', name: 'Ogerpon-Teal-Tera' },
		{ label: 'Wellspring Tera', name: 'Ogerpon-Wellspring-Tera' },
		{ label: 'Hearthflame Tera', name: 'Ogerpon-Hearthflame-Tera' },
		{ label: 'Cornerstone Tera', name: 'Ogerpon-Cornerstone-Tera' }
	],
	[
		{ label: 'Amped', name: 'Toxtricity' },
		{ label: 'Low Key', name: 'Toxtricity-Low-Key' }
	],
	[
		{ label: 'Red-Striped', name: 'Basculin' },
		{ label: 'Blue-Striped', name: 'Basculin-Blue-Striped' },
		{ label: 'White-Striped', name: 'Basculin-White-Striped' }
	],
	[
		{ label: 'Normal', name: 'Rotom' },
		{ label: 'Heat', name: 'Rotom-Heat' },
		{ label: 'Wash', name: 'Rotom-Wash' },
		{ label: 'Frost', name: 'Rotom-Frost' },
		{ label: 'Fan', name: 'Rotom-Fan' },
		{ label: 'Mow', name: 'Rotom-Mow' }
	],
	[
		{ label: 'Incarnate', name: 'Landorus' },
		{ label: 'Therian', name: 'Landorus-Therian' }
	],
	[
		{ label: 'Incarnate', name: 'Thundurus' },
		{ label: 'Therian', name: 'Thundurus-Therian' }
	],
	[
		{ label: 'Incarnate', name: 'Tornadus' },
		{ label: 'Therian', name: 'Tornadus-Therian' }
	],
	[
		{ label: 'Incarnate', name: 'Enamorus' },
		{ label: 'Therian', name: 'Enamorus-Therian' }
	],
	[
		{ label: 'Average', name: 'Pumpkaboo' },
		{ label: 'Small', name: 'Pumpkaboo-Small' },
		{ label: 'Large', name: 'Pumpkaboo-Large' },
		{ label: 'Super', name: 'Pumpkaboo-Super' }
	],
	[
		{ label: 'Average', name: 'Gourgeist' },
		{ label: 'Small', name: 'Gourgeist-Small' },
		{ label: 'Large', name: 'Gourgeist-Large' },
		{ label: 'Super', name: 'Gourgeist-Super' }
	],
	// Floette-Eternal is the Floette that has a Mega (Floettite), and the only
	// one in Champions — the data makes it a forme of Floette, so it gets a
	// family instead of a picker entry of its own.
	[
		{ label: 'Normal', name: 'Floette' },
		{ label: 'Eternal', name: 'Floette-Eternal' },
		{ label: 'Mega', name: 'Floette-Mega' }
	],
	// Meowstic's Mega is gendered — one family per gender, kept in sync
	// with the gender toggle via GENDER_PAIRS below.
	[
		{ label: 'Normal', name: 'Meowstic' },
		{ label: 'Mega', name: 'Meowstic-M-Mega' }
	],
	[
		{ label: 'Normal', name: 'Meowstic-F' },
		{ label: 'Mega', name: 'Meowstic-F-Mega' }
	]
];

const familyByMemberName = new Map<string, { label: string; name: string }[]>();
const nonDefaultFamilyMembers = new Set<string>();
for (const family of FORM_FAMILIES) {
	for (const [i, member] of family.entries()) {
		familyByMemberName.set(member.name, family);
		if (i > 0) nonDefaultFamilyMembers.add(member.name);
	}
}

/**
 * Male/female pairs for species with gender-based stat/appearance
 * differences — a toggle, not a forme picker (see `GenderToggle.svelte`).
 * Keyed by the male name; only the female name needs excluding from the
 * main picker, since the male is either the plain species or (for
 * Meowstic's Mega) a {@link FORM_FAMILIES} member already handled above.
 */
const GENDER_PAIRS: Record<string, string> = {
	Meowstic: 'Meowstic-F',
	'Meowstic-M-Mega': 'Meowstic-F-Mega',
	Indeedee: 'Indeedee-F',
	Oinkologne: 'Oinkologne-F',
	Basculegion: 'Basculegion-F'
};
const femaleByMaleName = new Map(Object.entries(GENDER_PAIRS));
const maleByFemaleName = new Map(
	Object.entries(GENDER_PAIRS).map(([male, female]) => [female, male])
);

/** The gender pair a species belongs to, or `null` if it has no gender-based forme. */
export function genderPairOf(
	species: SpeciesItem
): { male: SpeciesItem; female: SpeciesItem } | null {
	const maleName = femaleByMaleName.has(species.name)
		? species.name
		: maleByFemaleName.get(species.name);
	if (!maleName) return null;
	return { male: find(maleName), female: find(femaleByMaleName.get(maleName)!) };
}

/** True for a Totem forme (a trial-boss Pokémon, not one a player can actually own). */
function isTotemForme(species: SpeciesItem): boolean {
	return species.name.endsWith('-Totem');
}

/**
 * Species with several near-identical variants where only one is worth
 * offering at all: Zygarde's 10%/50% formes in favor of its strongest
 * (Complete), Pikachu's cosmetic event caps, and Vivillon/Squawkabilly's
 * purely-cosmetic (no stat/type difference) pattern and color variants.
 */
const EXCLUDED_FROM_PICKER = new Set([
	'Zygarde',
	'Zygarde-10%',
	'Vivillon-Fancy',
	'Vivillon-Pokeball',
	'Squawkabilly-Blue',
	'Squawkabilly-White',
	'Squawkabilly-Yellow',
	'Pikachu-Alola',
	'Pikachu-Hoenn',
	'Pikachu-Kalos',
	'Pikachu-Original',
	'Pikachu-Partner',
	'Pikachu-Sinnoh',
	'Pikachu-Unova',
	'Pikachu-World'
]);

/**
 * The regulation this app's Pokémon picker follows: Pokémon Champions'
 * Regulation M-C. `@smogon/calc`'s Champions data has no notion of
 * regulations, so its roster stands in for M-C's legal pool.
 */
export const CURRENT_REGULATION = 'M-C';

const championsNames = new Set<string>([...championsGen.species].map((s) => s.name));

/**
 * Whether Regulation M-C allows `species` — itself, or (for a hand-rolled
 * forme family like Floette's) any forme of its family.
 */
function inRegulation(species: SpeciesItem): boolean {
	if (championsNames.has(species.name)) return true;
	return familyByMemberName.get(species.name)?.some((m) => championsNames.has(m.name)) ?? false;
}

/** Species selectable directly in the main Pokémon picker: Regulation M-C's, one per family. */
export const pickableSpecies = allSpecies.filter(
	(s) =>
		inRegulation(s) &&
		!isBattleOnlyForme(s) &&
		!isTotemForme(s) &&
		!nonDefaultFamilyMembers.has(s.name) &&
		!maleByFemaleName.has(s.name) &&
		!EXCLUDED_FROM_PICKER.has(s.name)
);

/**
 * Display name for the main picker — almost always just the species'
 * own name. Zygarde-Complete (the only Zygarde forme offered at all,
 * see `EXCLUDED_FROM_PICKER`) and Aegislash-Shield (its default,
 * resting stance, standing in for "Aegislash" in the main picker) are
 * the two exceptions.
 */
const DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
	'Aegislash-Shield': 'Aegislash',
	'Zygarde-Complete': 'Zygarde'
};

export function speciesLabel(species: SpeciesItem): string {
	return DISPLAY_LABEL_OVERRIDES[species.name] ?? species.name;
}

/**
 * The selectable forms for a species: either its hand-rolled
 * {@link FORM_FAMILIES} entry, or (the vast majority of species) "Normal"
 * plus any Mega Evolutions sharing its identity. A
 * species with none of those just gets a single "Normal" entry back —
 * callers should disable the picker in that case.
 */
export function formsOf(species: SpeciesItem): { label: string; species: SpeciesItem }[] {
	const family = familyByMemberName.get(species.name);
	if (family) {
		return family.map(({ label, name }) => ({ label, species: find(name) }));
	}
	const isBattleForme = isBattleOnlyForme(species);
	const baseName = isBattleForme ? species.baseSpecies! : species.name;
	const normal = isBattleForme ? (gen.species.get(toID(baseName)) ?? species) : species;
	return [{ label: 'Normal', species: normal }, ...(battleFormsByBase.get(baseName) ?? [])];
}

const norm = (name: string) => name.trim().toLowerCase();

/**
 * The species called `name`: its own name (case-insensitive) or the label
 * the picker shows for it ("Aegislash" for Aegislash-Shield). `undefined`
 * for anything else, e.g. a nickname or a typo.
 */
export function findSpecies(name: string): SpeciesItem | undefined {
	const q = norm(name);
	if (!q) return undefined;
	return (
		allSpecies.find((s) => norm(s.name) === q) ??
		allSpecies.find((s) => norm(speciesLabel(s)) === q)
	);
}

export { toID };
