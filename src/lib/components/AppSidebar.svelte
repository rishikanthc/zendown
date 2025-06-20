<script lang="ts">
	import { onMount } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { File } from 'lucide-svelte';

	// Props definition, if any are needed in the future (e.g., currentNoteId for highlighting)
	// let { currentNoteId: activeNoteId } = $props<{ currentNoteId?: string }>();

	type NoteListItem = {
		id: string; // Used as the key for #each
		title: string | null;
		canonical_path: string; // Used for the href
	};

	let notes = $state<NoteListItem[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);

	async function fetchNotes() {
		isLoading = true;
		errorMessage = null;
		try {
			const response = await fetch('/api/notes/titles'); // Standard endpoint for fetching all notes
			if (!response.ok) {
				let errorBody = { message: response.statusText };
				try {
					errorBody = await response.json();
				} catch (e) {
					// Ignore if response is not JSON
				}
				throw new Error(
					`Failed to fetch notes: ${errorBody.message || response.statusText || 'Unknown server error'}`
				);
			}
			const data = await response.json();
			// Adapt this line based on the actual structure of your API response
			// e.g., if API returns { data: { notes: [] } }, use data.data.notes
			const fetchedNotes = data.notes || data;

			if (!Array.isArray(fetchedNotes)) {
				console.warn('Fetched notes data is not an array:', fetchedNotes);
				notes = [];
				throw new Error('Received unexpected data format from server.');
			}
			notes = fetchedNotes;
		} catch (e: any) {
			console.error('Error fetching notes for sidebar:', e);
			errorMessage = e.message || 'An unknown error occurred while fetching notes.';
			notes = []; // Clear notes on error to prevent displaying stale data
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchNotes();
		// fetchNotes();
	});

	// This component fetches notes on mount. If it's conditionally rendered (e.g. using #if)
	// in the parent, onMount will run each time it's "loaded into view".
</script>

<Sidebar.Root side="left" collapsible="offcanvas" class="border-none bg-gray-50 dark:bg-gray-800">
	<Sidebar.Header class="p-3">
		<Sidebar.Group>
			<Sidebar.GroupLabel class="font-[Megrim] text-xl text-blue-600 sm:text-2xl dark:text-gray-100"
				>ZenDown</Sidebar.GroupLabel
			>
		</Sidebar.Group>
	</Sidebar.Header>

	<Sidebar.Content class="p-2">
		<Sidebar.Group>
			{#if isLoading}
				<Sidebar.Menu>
					{#each Array(5) as _, i (i)}
						<Sidebar.MenuItem>
							<Sidebar.MenuSkeleton class="my-1 h-7 sm:h-8" />
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			{:else if errorMessage}
				<div
					class="my-2 rounded-md bg-red-100 p-2 text-xs text-red-700 sm:p-3 sm:text-sm dark:bg-red-900 dark:text-red-300"
					role="alert"
				>
					<p class="font-medium">Error loading notes:</p>
					<p>{errorMessage}</p>
					<button
						onclick={fetchNotes}
						class="mt-2 text-xs font-medium text-red-700 hover:underline sm:text-sm dark:text-red-300"
					>
						Try again
					</button>
				</div>
			{:else if notes.length === 0}
				<div class="my-2 p-3 text-center text-xs text-gray-500 sm:text-sm dark:text-gray-400">
					No notes found.
				</div>
			{:else}
				<Sidebar.Menu>
					{#each notes as note (note.id)}
						<Sidebar.MenuItem class="my-0">
							<Sidebar.MenuButton
								class="w-full justify-start p-0 text-xs sm:text-sm"
								aria-label={`Open note: ${note.title || 'Untitled Note'}`}
							>
								{#snippet child({ props: menuButtonProps })}
									<a
										href={`${note.canonical_path}`}
										{...menuButtonProps}
										class="m-0 flex w-full shrink-0 items-center gap-1 rounded-xs p-0.5 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
									>
										<File class="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
										<span class="truncate">
											{note.title || 'Untitled Note'}
										</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			{/if}
		</Sidebar.Group>
	</Sidebar.Content>
	<!-- <Sidebar.Footer /> can be added here if needed -->
</Sidebar.Root>

<style lang="postcss">
	/* PostCSS can be used for Tailwind directives if needed, or keep it plain CSS */
	/* Styles specific to AppSidebar, if shadcn defaults & Tailwind utilities aren't enough */
	:global(body) {
		/* This ensures that when the sidebar is open, the main content area might need adjustment */
		/* However, shadcn-svelte's Sidebar.Provider and CSS variables should handle this */
	}
</style>
