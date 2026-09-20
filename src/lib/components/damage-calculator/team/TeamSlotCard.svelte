<script lang="ts">
	import type { TeamRoster } from '$lib/modules/damage-calculator/stores/roster.svelte';
	import type { TeamSlot } from '$lib/modules/damage-calculator/stores/team.svelte';
	import { formsOf, type SpeciesItem } from '$lib/modules/shared/species/generation';
	import { abilitiesOf } from '$lib/modules/damage-calculator/calc/abilities';
	import {
		applyCommonSet,
		hasCommonSets,
		type CommonSet
	} from '$lib/modules/damage-calculator/calc/commonSets';
	import { applyEntryEffect } from '$lib/modules/damage-calculator/calc/entryEffects';
	import {
		megaFormFor,
		megaStoneFor,
		type HeldItem
	} from '$lib/modules/damage-calculator/calc/items';
	import { field } from '$lib/modules/damage-calculator/stores/field.svelte';
	import { exportPokePaste, importPokePaste } from '$lib/modules/damage-calculator/calc/pokepaste';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Save from '@lucide/svelte/icons/save';
	import IconButton from '$lib/components/shared/ui/IconButton.svelte';
	import AbilityCombobox from '../combobox/AbilityCombobox.svelte';
	import PokemonCombobox from '$lib/components/shared/species/PokemonCombobox.svelte';
	import CommonSetsModal from './CommonSetsModal.svelte';
	import SpeedCheckModal from './SpeedCheckModal.svelte';
	import TypeMatchupsModal from './TypeMatchupsModal.svelte';
	import FormeCombobox from '../combobox/FormeCombobox.svelte';
	import GenderToggle from './GenderToggle.svelte';
	import ItemCombobox from '../combobox/ItemCombobox.svelte';
	import MoveSlot from './MoveSlot.svelte';
	import NatureCombobox from '../combobox/NatureCombobox.svelte';
	import SpeciesSprite from '$lib/components/shared/species/SpeciesSprite.svelte';
	import StatPointBars from './StatPointBars.svelte';
	import TypeBadge from '../display/TypeBadge.svelte';
	import { Swords } from '@lucide/svelte';

	// slot is $bindable: this component two-way-binds into its properties
	// (slot.species, slot.nature, slot.statPoints, ...) via child bind:
	// directives, and Svelte's ownership tracking requires that chain to be
	// declared explicitly all the way up, or it warns ownership_invalid_binding.
	let {
		slot = $bindable(),
		roster,
		slotIndex,
		tailwind = false,
		intimidated = false
	}: {
		slot: TeamSlot;
		/** The team this slot belongs to, for "Save". */
		roster: TeamRoster;
		/** Which of the side's two slots this is. */
		slotIndex: 0 | 1;
		/** Whether this slot's own team currently has Tailwind up — see `StatPointBars`' own `tailwind`. */
		tailwind?: boolean;
		/** Whether the *opposing* team currently has Intimidate up — see `StatPointBars`' own `intimidated`. */
		intimidated?: boolean;
	} = $props();

	const disabled = $derived(!slot.species);

	/**
	 * Runs whenever the user picks a species through this card's own UI —
	 * `PokemonCombobox`, `FormeCombobox` (switching forme, including into
	 * or out of a Mega Evolution) or `GenderToggle` — auto-filling the
	 * newly picked species' first ability (`abilitiesOf`, PokeAPI-backed
	 * and async) and, for a Mega Evolution, its own Mega Stone as the held
	 * item (`megaStoneFor`).
	 *
	 * Deliberately NOT hooked into `TeamSlot.species`'s own setter
	 * (`team.svelte.ts`): `importPokePaste` sets `slot.species` directly
	 * too, and always overwrites `ability`/`item` right after with
	 * whatever the pasted set itself says — including clearing either
	 * back to `null` for a paste that specifies neither. Auto-filling in
	 * the setter would at best be redundant work an import immediately
	 * discards, and at worst could race that explicit assignment (this
	 * function's own `abilitiesOf` await resolving *after* import has
	 * already, correctly, cleared `slot.ability`) and silently overwrite
	 * an intentionally ability-less import.
	 */
	async function selectSpecies(species: SpeciesItem | null) {
		changeSpecies(() => (slot.species = species));
		if (!species) return;

		const megaStone = megaStoneFor(species);
		if (megaStone) slot.item = megaStone;

		const options = await abilitiesOf(species);
		// The user may have picked a different species again while this
		// was in flight — same guard `AbilityCombobox` itself uses — so
		// only the still-current species' own first ability lands.
		if (slot.species === species) {
			slot.ability = options[0]?.name ?? null;
			applyEntryEffect(slot.ability, field);
		}
	}

	/** The species' "family": the same for its formes (Charizard and Charizard-Mega-Y). */
	const familyOf = (species: SpeciesItem | null) => species?.baseSpecies ?? species?.name ?? null;

	/**
	 * Runs `change`, and if it turned this slot's Pokémon into a genuinely
	 * different one (not just another forme), the slot is no longer its team
	 * member's: the member keeps the build it had, and this becomes a new
	 * Pokémon that can be saved in the team on its own.
	 */
	function changeSpecies(change: () => void) {
		roster.sync();
		const before = familyOf(slot.species);
		change();
		if (familyOf(slot.species) !== before) roster.detach(slotIndex);
	}

	const addBlockedReason = $derived(roster.addBlockedReason(slotIndex));

	/**
	 * Runs whenever the user picks an item through `ItemCombobox` — the
	 * reverse of `selectSpecies`' Mega Stone auto-fill: a stone that fits
	 * this slot's species switches the slot into the Mega form (through
	 * `selectSpecies`, so the ability and its entry effect follow).
	 */
	function selectItem(item: HeldItem | null) {
		slot.item = item;
		const mega = item && slot.species && megaFormFor(item, slot.species);
		if (mega) selectSpecies(mega);
	}

	function selectAbility(ability: string | null) {
		slot.ability = ability;
		applyEntryEffect(ability, field);
	}

	let copied = $state(false);
	/** Set only when the Clipboard API itself fails (denied permission, unsupported) — shows the text inline so it can still be copied by hand. */
	let pasteFallback = $state<string | null>(null);

	async function copyPokePaste() {
		if (!slot.species) return;
		const text = exportPokePaste(slot);
		try {
			await navigator.clipboard.writeText(text);
			pasteFallback = null;
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			pasteFallback = text;
		}
	}

	let importOpen = $state(false);
	let importText = $state('');
	let importError = $state<string | null>(null);

	function submitImport() {
		try {
			changeSpecies(() => importPokePaste(slot, importText));
			importOpen = false;
			importText = '';
			importError = null;
		} catch (err) {
			importError = err instanceof Error ? err.message : String(err);
		}
	}

	function cancelImport() {
		importOpen = false;
		importText = '';
		importError = null;
	}

	let commonSetsOpen = $state(false);
	let speedCheckOpen = $state(false);
	let matchupsOpen = $state(false);

	/**
	 * Applies a common set, then puts the slot in the forme its item calls
	 * for: a Mega Stone turns it into that Mega (Charizardite X on a Mega Y
	 * slot gives Mega X), and any other item turns a Mega back into its
	 * normal forme. `selectSpecies` resets the ability, so the set's own
	 * comes back after.
	 */
	async function selectCommonSet(set: CommonSet) {
		applyCommonSet(slot, set);
		const species = slot.species;
		if (!species) return;

		const mega = set.item ? megaFormFor(set.item, species) : null;
		const normal =
			!mega && megaStoneFor(species) && megaStoneFor(species) !== set.item
				? formsOf(species)[0].species
				: null;
		const target = mega ?? normal;
		if (!target || target === species) return;

		await selectSpecies(target);
		if (set.ability !== undefined) {
			slot.ability = set.ability;
			applyEntryEffect(slot.ability, field);
		}
	}
</script>

<div
	class="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 shadow-sm @3xl:flex-row @3xl:items-start @3xl:gap-2"
>
	<!-- Build form: avatar+types on top (centered), then species/forme, item, nature. The
	     gender toggle is pinned to the right at the types' height, out of that flow. Full
	     width while stacked, a fixed column alongside the other two once there's room for a
	     row (see the root's own flex-col/flex-row switch).

	     `@3xl` (a *container* query, off this card's own rendered width via the `@container`
	     its parent `<section>` declares in +page.svelte — not `lg`, a *viewport* breakpoint):
	     the page's own Team A/Team B grid already goes 2-up at `lg` (1024px), which more than
	     halves each card's available width right as a viewport-only breakpoint would otherwise
	     try to switch it to a row — cards would keep demanding their full 3-column layout width
	     in barely half that much space, cramped and overflowing until the viewport got wide
	     enough for even a halved column to fit it. A container query instead reads how much
	     room *this card itself* actually has, so it only goes row-oriented once that's still
	     true, regardless of which grid column it's in or how wide the viewport is. -->
	<div class="relative flex w-full flex-col gap-2 @3xl:w-48 @3xl:shrink-0">
		<div class="flex items-center gap-4">
			<div class="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gray-800">
				{#if slot.species}
					<SpeciesSprite species={slot.species} size={50} />
				{:else}
					<span class="text-3xl text-gray-500">?</span>
				{/if}
			</div>
			<div class="flex h-4 flex-col items-center justify-center gap-1">
				{#if slot.species}
					{#each slot.types as type (type)}
						<TypeBadge {type} />
					{/each}
				{/if}
			</div>
		</div>

		<div class="absolute top-[20px] right-0 flex h-4 items-center">
			<GenderToggle bind:selected={() => slot.species, selectSpecies} {disabled} />
		</div>

		<div class="flex items-center gap-2">
			<div class="min-w-0 flex-1">
				<PokemonCombobox bind:selected={() => slot.species, selectSpecies} />
			</div>
			<FormeCombobox bind:selected={() => slot.species, selectSpecies} {disabled} />
		</div>

		<ItemCombobox bind:selected={() => slot.item, selectItem} {disabled} />
		<AbilityCombobox
			species={slot.species}
			bind:selected={() => slot.ability, selectAbility}
			{disabled}
		/>
		<NatureCombobox bind:selected={slot.nature} {disabled} />
	</div>

	<!-- Stats. A horizontal divider while stacked, the usual vertical one
	     between columns once `@3xl` switches this card to a row (see the
	     root's own comment for why that's a container query, not `lg`). -->
	<div
		class="border-y border-gray-800 py-2 @3xl:min-w-[320px] @3xl:flex-1 @3xl:border-x @3xl:border-y-0 @3xl:px-2 @3xl:py-0"
	>
		<StatPointBars
			species={slot.species}
			nature={slot.nature}
			bind:statPoints={slot.statPoints}
			bind:boosts={slot.boosts}
			{tailwind}
			{intimidated}
		/>
	</div>

	<!-- Moves. -->
	<div class="flex min-w-0 flex-1 flex-col gap-1 @3xl:self-stretch">
		<div class="flex items-center gap-2 px-2 text-[10px] font-medium text-gray-300">
			<span class="flex-1">Move</span>
			<span class="w-16 shrink-0 text-center">Type</span>
			<span class="w-8 shrink-0 text-center">Cat</span>
			<span class="w-8 shrink-0 text-right">Power</span>
		</div>
		{#each [0, 1, 2, 3] as i (i)}
			<MoveSlot bind:selected={slot.moves[i]} {disabled} attacker={slot} moveIndex={i} />
		{/each}
		{#if pasteFallback}
			<textarea
				readonly
				value={pasteFallback}
				rows="6"
				aria-label="PokePaste export (copy manually)"
				onclick={(e) => e.currentTarget.select()}
				class="w-full rounded border border-gray-700 bg-gray-800 p-1 font-mono text-[10px] text-gray-100"
			></textarea>
		{/if}
		{#if importOpen}
			<textarea
				bind:value={importText}
				rows="6"
				placeholder="Paste a PokePaste/Showdown export here…"
				aria-label="PokePaste text to import"
				class="w-full rounded border border-gray-700 bg-gray-800 p-1 font-mono text-[10px] text-gray-100 placeholder:text-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
			></textarea>
			{#if importError}
				<p class="text-[10px] text-red-400">{importError}</p>
			{/if}
			<div class="flex gap-1">
				<button
					type="button"
					onclick={submitImport}
					class="rounded border border-gray-700 bg-indigo-600 px-2 py-1 text-[10px] text-white hover:bg-indigo-500"
				>
					Import
				</button>
				<button
					type="button"
					onclick={cancelImport}
					class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-700"
				>
					Cancel
				</button>
			</div>
		{/if}
		<div class="mt-auto flex justify-end gap-1 pt-1">
			<IconButton
				icon={ClipboardCopy}
				label={copied ? 'Copied!' : 'Export'}
				description="Copy this Pokémon as a PokePaste"
				{disabled}
				onclick={copyPokePaste}
			/>
			<IconButton
				icon={ClipboardPaste}
				label="Import"
				description="Import a PokePaste into this slot"
				onclick={() => (importOpen = !importOpen)}
			/>
			<IconButton
				icon={BookOpen}
				label="Common Sets"
				description="Load a curated common set for this Pokémon"
				disabled={!hasCommonSets(slot.species)}
				onclick={() => (commonSetsOpen = true)}
			/>
			<IconButton
				icon={Gauge}
				label="Check speed"
				description="See where this Pokémon stands in Speed"
				{disabled}
				onclick={() => (speedCheckOpen = true)}
			/>
			<IconButton
				icon={Swords}
				label="Matchups"
				description="See this Pokémon's weaknesses and resistances"
				{disabled}
				onclick={() => (matchupsOpen = true)}
			/>
			<IconButton
				icon={Save}
				label="Save"
				description={addBlockedReason ?? 'Save this Pokémon in the team above'}
				variant="primary"
				disabled={addBlockedReason !== null}
				onclick={() => roster.add(slotIndex)}
			/>
		</div>
	</div>
</div>

{#if matchupsOpen}
	<TypeMatchupsModal {slot} onclose={() => (matchupsOpen = false)} />
{/if}
{#if speedCheckOpen}
	<SpeedCheckModal {slot} {tailwind} onclose={() => (speedCheckOpen = false)} />
{/if}
<CommonSetsModal bind:open={commonSetsOpen} species={slot.species} onselect={selectCommonSet} />
