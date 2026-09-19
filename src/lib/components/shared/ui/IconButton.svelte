<script lang="ts">
	import type { Component } from 'svelte';

	/**
	 * A small icon-only button with a tooltip of its own: `label` (the
	 * button's current text, also its accessible name) in bold, and the
	 * optional `description` under it. The tooltip lives on a wrapper so it
	 * still shows for a disabled button, where it can say why.
	 */
	let {
		icon: Icon,
		label,
		description = undefined,
		onclick,
		disabled = false,
		variant = 'default'
	}: {
		icon: Component<{ size?: number; class?: string }>;
		label: string;
		description?: string;
		onclick: () => void;
		disabled?: boolean;
		variant?: 'default' | 'primary';
	} = $props();
</script>

<span class="group relative inline-flex self-start">
	<button
		type="button"
		{disabled}
		{onclick}
		aria-label={label}
		class="rounded border p-1.5 disabled:pointer-events-none disabled:opacity-30 {variant ===
		'primary'
			? 'border-sky-700 bg-sky-900/40 text-sky-200 hover:bg-sky-800/60 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-300'
			: 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'}"
	>
		<Icon size={14} />
	</button>
	<span
		role="tooltip"
		class="pointer-events-none absolute right-0 bottom-full z-40 mb-1 hidden w-max max-w-56 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] text-gray-300 shadow-lg group-focus-within:block group-hover:block"
	>
		<span class="block font-semibold text-gray-100">{label}</span>
		{#if description}<span class="block">{description}</span>{/if}
	</span>
</span>
