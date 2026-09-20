<script lang="ts">
	import type { StatID } from '@smogon/calc';
	import {
		MAX_BOOST_STAGE,
		MAX_SP_PER_STAT,
		MAX_SP_TOTAL,
		STAT_LABELS,
		STAT_ORDER,
		boostedStat,
		calcChampionsStat,
		clampBoostStage,
		statPointBreakpoints,
		totalStatPoints,
		type BoostableStat,
		type NatureInfo,
		type StatBoosts,
		type StatPoints
	} from '$lib/modules/damage-calculator/calc/format';
	import type { SpeciesItem } from '$lib/modules/shared/species/generation';
	import { field } from '$lib/modules/damage-calculator/stores/field.svelte';
	import NumberStepper from '$lib/components/shared/ui/NumberStepper.svelte';

	let {
		species,
		nature,
		statPoints = $bindable(),
		boosts = $bindable(),
		tailwind = false,
		intimidated = false
	}: {
		species: SpeciesItem | null;
		nature: NatureInfo;
		statPoints: StatPoints;
		/** This Pokemon's own in-battle stat stages (-6..+6, 0 = no boost/drop) — see `team.svelte.ts`'s `TeamSlot.boosts`. */
		boosts: StatBoosts;
		/** Whether this Pokemon's team currently has Tailwind up — doubles the displayed Speed only, a battle-time buff rather than anything `calcChampionsStat` itself computes. */
		tailwind?: boolean;
		/** Whether the *opposing* team currently has Intimidate up (`TeamSideConditions.intimidate`) — see the effect below for what this does to `boosts.atk`. */
		intimidated?: boolean;
	} = $props();

	const spent = $derived(totalStatPoints(statPoints));
	const remaining = $derived(MAX_SP_TOTAL - spent);

	// Neutral natures (plus === minus) get no +/- marker at all.
	const isNeutral = $derived(nature.plus === nature.minus);

	function setStat(stat: StatID, value: number) {
		// Can't exceed the per-stat cap regardless — with `statPointsUnlimited`
		// off, also can't spend more than what's left of the total budget
		// once this stat's current points are given back.
		const budget = field.statPointsUnlimited ? MAX_SP_PER_STAT : remaining + statPoints[stat];
		statPoints[stat] = Math.max(0, Math.min(value, MAX_SP_PER_STAT, budget));
	}

	/** One bar per possible SP value (1..32), click a bar to jump straight to it. */
	const SP_VALUES = Array.from({ length: MAX_SP_PER_STAT }, (_, i) => i + 1);

	function isBoostable(stat: StatID): stat is BoostableStat {
		return stat !== 'hp';
	}

	function setBoost(stat: BoostableStat, value: number) {
		boosts[stat] = clampBoostStage(value);
	}

	/**
	 * Intimidate is a real, permanent Atk stage change here — not a
	 * per-calculation overlay computed on top of `boosts.atk` the way
	 * `matrix.ts` used to (see `TeamSideConditions.intimidate`'s own doc
	 * comment) — so the moment the opposing team's Intimidate flips on,
	 * this Pokemon's own Atk stage actually drops by 1, same as any other
	 * stage-changing event (Dragon Dance, ...): it shows up in the stage
	 * stepper itself, not just the final stat number, and a further
	 * manual stage change works from whatever it's become since. Flipping
	 * Intimidate back off restores exactly the 1 stage it took.
	 *
	 * `boosts` is reset to a brand-new object on a genuinely different
	 * species (`TeamSlot.species`'s own setter) — tracked via `lastBoosts`
	 * so a still-true `intimidated` gets (re)applied to that fresh build
	 * too, rather than only reacting the next time `intimidated` itself
	 * flips.
	 */
	let lastBoosts: StatBoosts | undefined;
	let intimidateApplied = false;
	$effect(() => {
		if (boosts !== lastBoosts) {
			lastBoosts = boosts;
			intimidateApplied = false;
		}
		if (intimidated !== intimidateApplied) {
			boosts.atk = clampBoostStage(boosts.atk + (intimidated ? -1 : 1));
			intimidateApplied = intimidated;
		}
	});

	/** `calcChampionsStat`'s value from Stat Points + nature alone — the baseline every color/tooltip below compares the final number against. */
	function rawStat(stat: StatID): number | null {
		if (!species) return null;
		return calcChampionsStat(species.baseStats[stat], stat, statPoints[stat], nature);
	}

	/**
	 * The stat number shown on the right: `rawStat`, adjusted by `boosts`
	 * for every stat but HP (which no stage ever touches — Intimidate is
	 * already folded into `boosts.atk` itself by the effect above, not a
	 * separate adjustment applied here), then Speed doubled on top while
	 * Tailwind is up (a separate multiplier from stat stages entirely, see
	 * `tailwind` above).
	 */
	function displayedStat(stat: StatID): number | null {
		const raw = rawStat(stat);
		if (raw === null) return null;
		if (!isBoostable(stat)) return raw;
		const boosted = boostedStat(raw, boosts[stat]);
		return stat === 'spe' && tailwind ? boosted * 2 : boosted;
	}

	/** Red once anything (stage, Tailwind) pushes the final number above `rawStat`, blue once it pushes it below, gray when Stat Points + nature is all that's going on. */
	function statColorClass(stat: StatID): string {
		const raw = rawStat(stat);
		const final = displayedStat(stat);
		if (raw === null || final === null || final === raw) return 'text-gray-500';
		return final > raw ? 'text-red-400' : 'text-blue-400';
	}

	/** Whether this row's final number differs from its plain unboosted value — drives the tooltip. */
	function isModified(stat: StatID): boolean {
		if (!isBoostable(stat)) return false;
		return boosts[stat] !== 0 || (stat === 'spe' && tailwind);
	}

	/**
	 * `boosts[stat]` no longer distinguishes a manual stage change from
	 * Intimidate's own — they're the same real stage once the effect above
	 * applies it — so this shows the merged stage plus, for Atk while
	 * `intimidated`, a note that Intimidate is (at least partly) why.
	 */
	function modifierTooltip(stat: StatID): string | undefined {
		if (!isModified(stat)) return undefined;
		const parts: string[] = [];
		if (isBoostable(stat) && boosts[stat] !== 0) {
			parts.push(`${boosts[stat] > 0 ? '+' : ''}${boosts[stat]} stage`);
		}
		if (stat === 'atk' && intimidated) parts.push('includes Intimidate');
		if (stat === 'spe' && tailwind) parts.push('Tailwind (×2)');
		return parts.join(', ');
	}
</script>

<div class="flex w-full flex-col gap-1">
	<div class="flex items-center justify-between text-[10px] font-medium text-gray-300">
		<span>Stat Points</span>
		{#if field.statPointsUnlimited}
			<span>{spent} SP (unlimited)</span>
		{:else}
			<span class={remaining < 0 ? 'text-red-400' : ''}>{spent}/{MAX_SP_TOTAL}</span>
		{/if}
	</div>

	{#each STAT_ORDER as stat (stat)}
		{@const rowBreakpoints = species
			? statPointBreakpoints(species.baseStats[stat], stat, nature)
			: []}
		<div class="flex items-center gap-2">
			<span class="w-6 shrink-0 text-[11px] text-gray-300">
				{STAT_LABELS[stat]}{#if !isNeutral && stat === nature.plus}<span
						class="font-semibold text-red-400">+</span
					>{:else if !isNeutral && stat === nature.minus}<span class="font-semibold text-blue-400"
						>−</span
					>{/if}
			</span>
			<span class="w-6 shrink-0 text-right text-[11px] text-gray-500">
				{species ? species.baseStats[stat] : '–'}
			</span>
			<div class="flex h-6 flex-1 items-stretch gap-0 border border-[1px] border-gray-700">
				{#each SP_VALUES as sp (sp)}
					{@const isBreakpoint = rowBreakpoints.includes(sp)}
					<div
						class="group relative h-full !w-[3px] min-w-0 flex-1 disabled:pointer-events-none disabled:opacity-40 {isBreakpoint
							? stat === nature.plus
								? 'border border-red-400'
								: 'border border-blue-400'
							: ''} {sp <= statPoints[stat] ? 'bg-indigo-500' : 'bg-transparent'}"
					>
						<button
							type="button"
							disabled={!species}
							onclick={() => setStat(stat, sp)}
							aria-label="Set {STAT_LABELS[stat]} SP to {sp}"
							aria-pressed={sp <= statPoints[stat]}
							class="h-full w-full"
						></button>
						<span
							class="pointer-events-none absolute -top-4 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-gray-950 px-1 text-[9px] whitespace-nowrap text-gray-100 group-hover:block"
						>
							{sp}
						</span>
					</div>
				{/each}
			</div>
			<NumberStepper
				value={statPoints[stat]}
				min={0}
				max={MAX_SP_PER_STAT}
				disabled={!species}
				ariaLabel="{STAT_LABELS[stat]} SP"
				onChange={(value) => setStat(stat, value)}
			/>
			<div class="w-10 shrink-0">
				{#if isBoostable(stat)}
					<NumberStepper
						value={boosts[stat]}
						min={-MAX_BOOST_STAGE}
						max={MAX_BOOST_STAGE}
						disabled={!species}
						ariaLabel="{STAT_LABELS[stat]} stat stage"
						onChange={(value) => setBoost(stat, value)}
					/>
				{/if}
			</div>
			<span
				class="w-8 shrink-0 text-right text-[11px] font-semibold {statColorClass(stat)}"
				title={modifierTooltip(stat)}
			>
				{displayedStat(stat) ?? '–'}
			</span>
		</div>
	{/each}
</div>
