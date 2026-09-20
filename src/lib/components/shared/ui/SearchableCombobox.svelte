<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		items,
		selected = $bindable(null),
		getLabel,
		placeholder = 'Select…',
		icon,
		row,
		trailing,
		tooltip,
		clearable = true,
		disabled = false,
		class: className = ''
	}: {
		items: T[];
		selected?: T | null;
		getLabel: (item: T) => string;
		placeholder?: string;
		icon?: Snippet<[T]>;
		/**
		 * Replaces a dropdown row's plain `getLabel(item)` text with richer
		 * content (e.g. a move's name plus its type/category/power) when
		 * given. Falls back to the plain label when omitted.
		 */
		row?: Snippet<[T]>;
		/**
		 * Extra content shown after the input, before the clear button —
		 * only while collapsed with something selected (same as `icon`, but
		 * trailing rather than leading). Nothing renders when omitted.
		 */
		trailing?: Snippet<[T]>;
		/**
		 * A hover tooltip for the collapsed, selected control (not shown
		 * while the dropdown itself is open, or for an individual dropdown
		 * row — a tooltip nested in the dropdown's own scrollable list
		 * would get clipped by its `overflow-auto`). Nothing renders, and no
		 * `group` hover wiring is added, when omitted.
		 */
		tooltip?: Snippet<[T]>;
		/** Whether a selection can be cleared back to `null` (default true). */
		clearable?: boolean;
		disabled?: boolean;
		/** Extra classes for the root element — e.g. flex sizing when placed in a row. */
		class?: string;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let highlighted = $state(0);
	let inputEl: HTMLInputElement | undefined;

	// The dropdown row currently moused over, and its own bounding box —
	// captured once on hover, not tracked live — so `rowTooltip` (a plain
	// `position: fixed` element, not nested under the scrollable `<ul>`) can
	// place itself without being clipped by that list's own `overflow-auto`
	// the way an absolutely-positioned tooltip nested inside it would be
	// (`fixed` positions against the viewport, escaping any ancestor's
	// overflow clipping, as long as nothing in between establishes its own
	// containing block via `transform`/`filter`/... — nothing here does).
	let hoveredItem = $state<T | null>(null);
	let hoveredRect = $state<DOMRect | null>(null);

	const TOOLTIP_MARGIN = 8;
	const TOOLTIP_MAX_WIDTH = 288; // matches `max-w-72` below
	const TOOLTIP_EST_HEIGHT = 120; // just for the above/below flip check

	const rowTooltipStyle = $derived.by(() => {
		if (!hoveredRect) return '';
		let left = Math.min(hoveredRect.left, window.innerWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_MARGIN);
		left = Math.max(TOOLTIP_MARGIN, left);
		let top = hoveredRect.bottom + 4;
		if (top + TOOLTIP_EST_HEIGHT > window.innerHeight - TOOLTIP_MARGIN) {
			top = hoveredRect.top - TOOLTIP_EST_HEIGHT - 4;
		}
		return `left: ${left}px; top: ${top}px;`;
	});

	function hoverRow(item: T, e: MouseEvent) {
		hoveredItem = item;
		hoveredRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	}

	function unhoverRow() {
		hoveredItem = null;
		hoveredRect = null;
	}

	// No cap here: even the biggest list (species, ~1500) is still just
	// plain rows in a scrollable box — cheap enough to render in full,
	// and capping it hid entries a query hadn't narrowed down to yet.
	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q ? items.filter((item) => getLabel(item).toLowerCase().includes(q)) : items;
	});

	function select(item: T) {
		selected = item;
		query = '';
		open = false;
		unhoverRow();
		inputEl?.blur();
	}

	function onFocus() {
		open = true;
		highlighted = 0;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			open = true;
			return;
		}
		if (!open) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlighted = Math.min(highlighted + 1, results.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlighted = Math.max(highlighted - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (results[highlighted]) select(results[highlighted]);
				break;
			case 'Escape':
				open = false;
				break;
		}
	}

	function clear() {
		selected = null;
		query = '';
		unhoverRow();
		inputEl?.focus();
	}
</script>

<div class="relative {className} {tooltip ? 'group' : ''}">
	<div
		class="flex h-8 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 {disabled
			? 'opacity-40'
			: ''}"
	>
		{#if selected && !open && icon}
			{@render icon(selected)}
		{/if}
		<input
			bind:this={inputEl}
			type="text"
			class="w-full border-none bg-transparent p-0 text-sm text-gray-100 placeholder:text-gray-500 focus:ring-0"
			placeholder={selected && !open ? getLabel(selected) : placeholder}
			bind:value={query}
			{disabled}
			onfocus={onFocus}
			onblur={() =>
				setTimeout(() => {
					open = false;
					unhoverRow();
				}, 100)}
			onkeydown={onKeydown}
		/>
		{#if selected && !open && trailing}
			{@render trailing(selected)}
		{/if}
		{#if selected && clearable}
			<button
				type="button"
				class="shrink-0 text-gray-500 hover:text-gray-300"
				onclick={clear}
				{disabled}
				aria-label="Clear selection"
			>
				✕
			</button>
		{/if}
	</div>

	{#if selected && !open && tooltip}
		<div
			role="tooltip"
			class="pointer-events-none invisible absolute top-full left-0 z-40 mt-1 w-max max-w-72 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] text-gray-300 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
		>
			{@render tooltip(selected)}
		</div>
	{/if}

	{#if open && results.length > 0}
		<ul
			class="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg"
			onscroll={unhoverRow}
		>
			{#each results as item, i (getLabel(item))}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-gray-100 hover:bg-indigo-500/20 {i ===
						highlighted
							? 'bg-indigo-500/20'
							: ''}"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => select(item)}
						onmouseenter={tooltip ? (e) => hoverRow(item, e) : undefined}
						onmouseleave={tooltip ? unhoverRow : undefined}
					>
						{#if icon}{@render icon(item)}{/if}
						{#if row}
							{@render row(item)}
						{:else}
							<span>{getLabel(item)}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if hoveredItem && tooltip}
			<div
				role="tooltip"
				class="pointer-events-none fixed z-40 w-max max-w-72 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] text-gray-300 shadow-lg"
				style={rowTooltipStyle}
			>
				{@render tooltip(hoveredItem)}
			</div>
		{/if}
	{/if}
</div>
