<script lang="ts">
	import { Icon } from '@lucide/svelte';

	/**
	 * A sword on a shield, drawn in Lucide's own style (24px grid, 2px round
	 * stroke) since the set has no such icon. Takes the same props as any
	 * Lucide icon (`size`, `class`, ...).
	 */
	let props = $props();
	const iconData = {
		name: 'sword-shield',
		size: 24,
		node: [
			['path', { d: 'M12 2.5 4.5 5.5V11c0 4.7 3.1 8.2 7.5 10.5 4.4-2.3 7.5-5.8 7.5-10.5V5.5z' }],
			['path', { d: 'M12 6v8.5' }],
			['path', { d: 'M9.5 9.5h5' }],
			['path', { d: 'M12 14.5v1.5' }]
		]
	};
</script>

<Icon {...props} icon={iconData as never} />
