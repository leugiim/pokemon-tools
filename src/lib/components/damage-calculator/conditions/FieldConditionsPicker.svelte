<script lang="ts">
	import {
		BATTLE_FORMAT_OPTIONS,
		field,
		TERRAIN_OPTIONS,
		WEATHER_OPTIONS,
		type Terrain,
		type Weather
	} from '$lib/modules/damage-calculator/stores/field.svelte';
	import { sides } from '$lib/modules/damage-calculator/stores/team.svelte';
	import {
		FIELD_ABILITY_FLAGS,
		fieldAbilityEffect,
		fieldAbilityName,
		providesFieldAbility,
		type FieldAbilityFlag
	} from '$lib/modules/damage-calculator/calc/fieldAbilities';
	import { resetOverrideOnAutoChange } from '$lib/modules/damage-calculator/calc/autoOverride.svelte';
	import ToggleButton from '$lib/components/shared/ui/ToggleButton.svelte';

	const allSlots = $derived([...sides.teamA, ...sides.teamB]);

	// Forcing a field ability On/Off is only meant to last as long as the
	// team state that made it worth forcing — the moment a Pokemon with
	// (or without) `flag`'s own ability actually gets selected onto or off
	// the field, the override clears itself back to Auto, though it can
	// always be forced again afterward (`forceFieldAbility`, below).
	for (const flag of FIELD_ABILITY_FLAGS) {
		resetOverrideOnAutoChange(
			() => providesFieldAbility(allSlots, flag),
			() => (field[flag] = null)
		);
	}

	/** Clicking the already-active option clears the selection back to "none" — the same click-to-deselect behavior for both mutually-exclusive groups. */
	function toggleWeather(weather: Weather) {
		field.weather = field.weather === weather ? null : weather;
	}
	function toggleTerrain(terrain: Terrain) {
		field.terrain = field.terrain === terrain ? null : terrain;
	}

	/**
	 * Forces a field ability's own override to the opposite of whatever it
	 * currently, effectively shows (`providesFieldAbility` — live
	 * auto-derived while `field[flag]` is still `null`, or the standing
	 * override otherwise). Replaces the 3-option `<select>` this used to
	 * be: while untouched the button always tracks Auto live, and one
	 * click pins it to a manual override — same convention as every other
	 * plain boolean `ToggleButton` in this app (Protect, Gravity, ...),
	 * just with a live-computed rather than always-`false` starting point.
	 * That override itself clears back to Auto automatically the moment it
	 * stops matching the team's own state (`resetOverrideOnAutoChange`,
	 * above) — there's no manual click path back to Auto, but forcing it
	 * again after an auto-reset is always still one click away.
	 */
	function forceFieldAbility(flag: FieldAbilityFlag) {
		field[flag] = !providesFieldAbility(allSlots, flag, field);
	}

	/** Which of the 4 on-field Pokemon Auto mode would credit for `flag` — or `null` if none does. */
	function autoProvider(flag: FieldAbilityFlag) {
		return allSlots.find((slot) => slot.ability === fieldAbilityName(flag)) ?? null;
	}

	/** Describes `flag`'s *actual* current state, same convention as `AllySupportToggles`' own tooltip. */
	function tooltip(flag: FieldAbilityFlag): string {
		const ability = fieldAbilityName(flag);
		const provider = autoProvider(flag);
		if (field[flag] === null) {
			return `${ability}: Auto — ${provider ? `${provider.species?.name ?? 'that Pokémon'} has it` : 'no Pokémon on the field has it'}`;
		}
		return `${ability}: forced ${field[flag] ? 'on' : 'off'} for the whole field`;
	}
</script>

<div
	class="flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3 text-[10px] text-gray-400 shadow-sm"
>
	<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
		<div
			class="inline-flex divide-x divide-gray-700 overflow-hidden rounded border border-gray-700"
		>
			{#each BATTLE_FORMAT_OPTIONS as format (format)}
				<ToggleButton
					active={field.battleFormat === format}
					onclick={() => (field.battleFormat = format)}
					title="Only affects how multi-target moves (Earthquake, Rock Slide, ...) are calculated — the roster is always 2 Pokemon per side"
				>
					{format}
				</ToggleButton>
			{/each}
		</div>
		<div
			class="inline-flex divide-x divide-gray-700 overflow-hidden rounded border border-gray-700"
		>
			<ToggleButton
				active={!field.statPointsUnlimited}
				onclick={() => (field.statPointsUnlimited = false)}
				title="Stat Points capped at 66 total across all six stats — Regulation M-C's real rule"
			>
				66 SP
			</ToggleButton>
			<ToggleButton
				active={field.statPointsUnlimited}
				onclick={() => (field.statPointsUnlimited = true)}
				title="No total cap — each stat can still only go up to 32 SP on its own. For exploring builds beyond what the real format allows"
			>
				Unlimited SP
			</ToggleButton>
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
		<div
			class="inline-flex divide-x divide-gray-700 overflow-hidden rounded border border-gray-700"
		>
			{#each WEATHER_OPTIONS as weather (weather)}
				<ToggleButton active={field.weather === weather} onclick={() => toggleWeather(weather)}>
					{weather}
				</ToggleButton>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
		<div
			class="inline-flex divide-x divide-gray-700 overflow-hidden rounded border border-gray-700"
		>
			{#each TERRAIN_OPTIONS as terrain (terrain)}
				<ToggleButton active={field.terrain === terrain} onclick={() => toggleTerrain(terrain)}>
					{terrain}
				</ToggleButton>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
		<ToggleButton
			class="rounded border border-gray-700"
			active={field.gravity}
			onclick={() => (field.gravity = !field.gravity)}
			title="Grounds Flying-types and Levitate/Air Balloon holders — Ground-type moves can hit them"
		>
			Gravity
		</ToggleButton>
		{#each FIELD_ABILITY_FLAGS as flag (flag)}
			{@const ability = fieldAbilityName(flag)}
			<ToggleButton
				class="rounded border border-gray-700"
				active={providesFieldAbility(allSlots, flag, field)}
				onclick={() => forceFieldAbility(flag)}
				title={tooltip(flag)}
			>
				{ability}
				{#if fieldAbilityEffect(flag)}<span class="ml-1 opacity-70">{fieldAbilityEffect(flag)}</span
					>{/if}
			</ToggleButton>
		{/each}
	</div>
</div>
