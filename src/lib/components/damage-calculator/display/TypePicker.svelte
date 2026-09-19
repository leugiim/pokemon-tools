<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import TypeBadge from './TypeBadge.svelte';

	/**
	 * A type chosen from a popover grid of type badges, with an "Auto" entry
	 * for `null`. Closes on a pick, on Escape and on a click outside it.
	 */
	let {
		value = $bindable(null),
		types,
		autoLabel = 'Auto',
		ariaLabel
	}: {
		value?: string | null;
		types: string[];
		autoLabel?: string;
		ariaLabel: string;
	} = $props();

	let open = $state(false);
	let root: HTMLDivElement | undefined;

	function pick(type: string | null) {
		value = type;
		open = false;
	}

	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div
	bind:this={root}
	class="relative"
	role="presentation"
	onkeydown={(e) => e.key === 'Escape' && (open = false)}
>
	<button
		type="button"
		aria-label={ariaLabel}
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="flex items-center gap-1 rounded border border-gray-700 bg-gray-800 py-0.5 pr-1 pl-0.5 hover:bg-gray-700"
	>
		{#if value}
			<TypeBadge type={value} />
		{:else}
			<span
				class="flex h-5 w-16 items-center justify-center text-[10px] font-semibold text-gray-300"
			>
				{autoLabel}
			</span>
		{/if}
		<ChevronDown size={12} class="text-gray-400" />
	</button>

	{#if open}
		<div
			role="listbox"
			aria-label={ariaLabel}
			class="absolute right-0 bottom-full z-40 mb-1 grid w-max grid-cols-3 gap-1 rounded border border-gray-700 bg-gray-900 p-2 shadow-lg"
		>
			<button
				type="button"
				role="option"
				aria-selected={value === null}
				onclick={() => pick(null)}
				class="col-span-3 rounded border px-2 py-1 text-[10px] font-semibold text-gray-200 hover:bg-gray-800 {value ===
				null
					? 'border-sky-500'
					: 'border-gray-700'}"
			>
				{autoLabel}
			</button>
			{#each types as type (type)}
				<button
					type="button"
					role="option"
					aria-selected={value === type}
					onclick={() => pick(type)}
					class="rounded p-0.5 hover:bg-gray-800 {value === type ? 'ring-2 ring-sky-500' : ''}"
				>
					<TypeBadge {type} />
				</button>
			{/each}
		</div>
	{/if}
</div>
