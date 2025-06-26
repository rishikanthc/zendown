<script lang="ts">
	import { onMount } from 'svelte';

	let { noteId }: { noteId: string | undefined } = $props();

	let tags = $state<string[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);

	async function fetchTags() {
		if (!noteId) {
			isLoading = false;
			tags = [];
			errorMessage = null;
			return;
		}

		isLoading = true;
		errorMessage = null;
		try {
			const response = await fetch(`/api/tags/${noteId}`);
			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({ message: response.statusText }));
				throw new Error(`Failed to fetch tags: ${errorBody.message || 'Unknown server error'}`);
			}
			const data = await response.json();
			if (data && Array.isArray(data.tags)) {
				tags = data.tags;
			} else {
				tags = [];
				console.warn('Tags data is not in the expected format:', data);
			}
		} catch (e: any) {
			console.error('Error fetching tags:', e);
			errorMessage = e.message || 'An unknown error occurred while fetching tags.';
			tags = [];
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		fetchTags();
	});
</script>

<div class="w-full px-0 pb-2 md:fixed md:top-24 md:right-4 md:z-40 md:w-[200px] md:p-0">
	{#if isLoading}
		<div class="p-2 text-xs text-gray-500 dark:text-gray-400">Loading tags...</div>
	{:else if errorMessage}
		<div
			class="rounded-md bg-red-100 p-2 text-xs text-red-700 dark:bg-red-900 dark:text-red-300"
			role="alert"
		>
			<p class="font-medium">Error:</p>
			<p>{errorMessage}</p>
		</div>
	{:else if tags.length > 0}
		<div class="flex flex-wrap items-center justify-start gap-1 md:justify-end">
			{#each tags as tag (tag)}
				<a
					href="/tags/{tag}"
					class="px-1.5 py-0.5 font-[Noto_Sans] text-sm text-black decoration-0 transition-colors hover:text-blue-500 hover:underline dark:bg-blue-900/50 dark:text-blue-200"
					rel="tag"
				>
					#{tag}
				</a>
			{/each}
		</div>
	{/if}
</div>
