<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Search, Loader2, AlertTriangle, X } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	// Props
	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	// State
	let searchTerm = $state('');
	let isLoading = $state(false);
	let searchResults = $state<SearchResultItem[]>([]);
	let searchError = $state<string | null>(null);
	let inputRef: HTMLInputElement | null = $state(null);

	interface SearchResultItem {
		id: string;
		title: string;
		canonical_path: string;
		score: number;
	}

	async function performSearch() {
		if (!searchTerm.trim()) {
			searchResults = [];
			searchError = null;
			return;
		}

		isLoading = true;
		searchError = null;
		searchResults = [];

		try {
			const response = await fetch('/api/notes/semantic-search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ query_text: searchTerm.trim(), limit: 10 })
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: 'Failed to submit search query.' }));
				throw new Error(errorData.message || `Error: ${response.statusText}`);
			}

			const results: SearchResultItem[] = await response.json();
			searchResults = results;
			if (results.length === 0) {
				searchError = 'No results found for your query.';
			}
		} catch (err: any) {
			console.error('Search error:', err);
			searchError = err.message || 'An unexpected error occurred.';
			searchResults = [];
		} finally {
			isLoading = false;
		}
	}

	// Local keydown handler for the input field
	function handleInputKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault(); // Prevent form submission if it were in a form
			performSearch();
		}
		// Escape is handled by handleGlobalKeyDown or backdrop click
	}

	function closeDialog() {
		// Reset state before closing for next open
		searchTerm = '';
		searchResults = [];
		searchError = null;
		isLoading = false;
		onClose();
	}

	// Global keydown listener, primarily for Escape to close the dialog
	function handleGlobalKeyDown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			closeDialog();
		}
	}

	$effect(() => {
		if (open) {
			// Reset state when dialog opens
			searchTerm = '';
			searchResults = [];
			searchError = null;
			isLoading = false;

			tick().then(() => {
				// Ensure input is rendered and visible before focusing
				inputRef?.focus();
			});
			window.addEventListener('keydown', handleGlobalKeyDown);
		} else {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		}

		// Cleanup function for $effect
		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		};
	});
</script>

{#if open}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex items-start justify-center bg-gray-50/60 p-4 pt-[15vh] backdrop-blur-sm sm:pt-[20vh]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="semantic-search-dialog-title"
		onclick={closeDialog}
	>
		<div
			class="relative w-full max-w-xl transform rounded-sm bg-white shadow-2xl transition-all dark:bg-gray-800"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center p-2 dark:border-gray-700">
				<Search class="mr-3 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
				<Input
					bind:value={searchTerm}
					bind:this={inputRef}
					type="text"
					placeholder="Search notes by meaning..."
					class="flex-1 rounded-sm border-none bg-transparent p-0 px-1 text-base dark:text-gray-100"
					oninput={() => {
						searchError = null;
						// searchResults = []; // Optionally clear results immediately on input, or wait for Enter
					}}
					onkeydown={handleInputKeyDown}
				/>
				<Button
					variant="ghost"
					size="icon"
					onclick={closeDialog}
					class="-mr-2 ml-2 shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				>
					<X class="h-5 w-5" />
					<span class="sr-only">Close dialog</span>
				</Button>
			</div>

			<div
				class="max-h-[50vh] min-h-[100px] overflow-y-auto p-4 sm:p-6"
				id="search-results-container"
			>
				{#if isLoading}
					<div class="flex items-center justify-center py-6 text-gray-600 dark:text-gray-300">
						<Loader2 class="mr-2 h-6 w-6 animate-spin" />
						<span>Searching...</span>
					</div>
				{:else if searchError}
					<div
						class="flex flex-col items-center justify-center py-6 text-red-600 dark:text-red-400"
					>
						<AlertTriangle class="mb-2 h-8 w-8" />
						<p class="text-center">{searchError}</p>
					</div>
				{:else if searchResults.length > 0}
					<ul class="space-y-1">
						{#each searchResults as result (result.id)}
							<li>
								<a
									href="/{result.canonical_path}"
									class="block rounded-sm p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
									onclick={closeDialog}
								>
									<p class="font-medium text-gray-700 hover:underline">
										{result.title}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										Score: {result.score.toFixed(4)}
									</p>
								</a>
							</li>
						{/each}
					</ul>
				{:else if searchTerm.trim() && !isLoading && !searchError}
					<div class="py-6 text-center text-gray-500 dark:text-gray-400">
						Press Enter to search.
					</div>
				{:else if !searchTerm.trim() && !isLoading && !searchError}
					<div class="py-6 text-center text-gray-500 dark:text-gray-400">
						Start typing to find notes by semantic meaning.
					</div>
				{/if}
			</div>

			{#if !isLoading && searchResults.length > 0}
				<div class="border-t border-gray-200 px-4 py-3 text-right dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Found {searchResults.length} result(s).
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	input[type='text'].flex-1 {
		box-shadow: none !important;
	}
	#search-results-container::-webkit-scrollbar {
		width: 6px;
	}
	#search-results-container::-webkit-scrollbar-track {
		background: transparent;
	}
	#search-results-container::-webkit-scrollbar-thumb {
		background-color: #cbd5e1; /* gray-300 */
		border-radius: 3px;
	}
	.dark #search-results-container::-webkit-scrollbar-thumb {
		background-color: #4b5563; /* gray-600 */
	}
</style>
