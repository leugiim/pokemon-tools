<script lang="ts">
	import type { TeamSlot } from '$lib/modules/damage-calculator/stores/team.svelte';
	import MoveCombobox from '../combobox/MoveCombobox.svelte';
	import type { MoveItem } from '$lib/modules/damage-calculator/calc/moves';

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

<MoveCombobox species={attacker.species} bind:selected {disabled} />
