<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<div>
	{@render children()}
	<Toaster />
</div>

<style>
	.app {
		height: 100vh;
		width: 100vw;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	/* Reset default margins and padding */
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
