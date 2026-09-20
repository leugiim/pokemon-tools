<script lang="ts">
	import { effectiveBasePower, type MoveItem } from '$lib/modules/damage-calculator/calc/moves';
	import type { TeamSlot } from '$lib/modules/damage-calculator/stores/team.svelte';
	import MoveCategoryIcon from '../display/MoveCategoryIcon.svelte';
	import MoveCombobox from '../combobox/MoveCombobox.svelte';
	import TypeBadge from '../display/TypeBadge.svelte';

	let {
		selected = $bindable(null),
		disabled = false,
		attacker,
		moveIndex
	}: {
		selected?: MoveItem | null;
		disabled?: boolean;
		attacker: TeamSlot;
		/** This slot's index within `attacker.moves` (0-3) — see the reset effect below. */
		moveIndex: number;
	} = $props();

	// Whenever the move picked for this slot changes, reset its Damage
	// Matrix overrides (assume-crit, hit-count) back to their defaults —
	// otherwise a crit assumption or manual hit count set for the previous
	// move would silently carry over onto an unrelated new one (#14, #15).
	// Re-picking the *same* move is not a real change and leaves an
	// existing override untouched.
	let previousSelected = selected;
	$effect(() => {
		if (selected !== previousSelected) {
			previousSelected = selected;
			attacker.resetMoveOptions(moveIndex);
		}
	});
</script>

<div class="flex w-full flex-col gap-1">
	<div class="flex w-full items-center gap-2">
		<div class="min-w-0 flex-1">
			<MoveCombobox species={attacker.species} bind:selected {disabled} />
		</div>
		<div class="flex w-20 shrink-0 justify-center">
			{#if selected}
				<TypeBadge type={selected.type} />
			{:else}
				<span
					class="flex h-5 w-16 items-center justify-center rounded bg-gray-800 text-[10px] text-gray-500"
					>–</span
				>
			{/if}
		</div>
		<div class="flex w-8 shrink-0 justify-center">
			{#if selected?.category}
				<MoveCategoryIcon category={selected.category} />
			{:else}
				<span class="text-[11px] text-gray-500">–</span>
			{/if}
		</div>
		<span class="w-8 shrink-0 text-right text-[11px] font-semibold text-gray-500">
			{(selected && effectiveBasePower(selected)) || '–'}
		</span>
	</div>
</div>
