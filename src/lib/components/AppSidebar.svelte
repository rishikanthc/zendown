<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { File, User } from 'lucide-svelte';

	type NoteListItem = {
		id: string;
		title: string | null;
		canonical_path: string;
	};

	let notes = $state<NoteListItem[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);

	async function fetchNotes() {
		isLoading = true;
		errorMessage = null;
		try {
			const response = await fetch('/api/notes/titles');
			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({ message: response.statusText }));
				throw new Error(
					`Failed to fetch notes: ${errorBody.message || response.statusText || 'Unknown server error'}`
				);
			}
			const data = await response.json();
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
			notes = [];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchNotes();
	});
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
										href="/{note.canonical_path}"
										{...menuButtonProps}
										class="m-0 flex w-full shrink-0 items-center gap-1 rounded-xs p-1 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
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

	<Sidebar.Footer class="mt-auto border-t border-gray-200 p-2 dark:border-gray-700">
		{#if $page.data.user}
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						class="w-full justify-start text-sm"
						aria-label={`Account options for ${$page.data.user.username}`}
					>
						{#snippet child({ props: menuButtonProps })}
							<a
								href="/account"
								{...menuButtonProps}
								class="flex w-full items-center gap-2 rounded-md p-2 text-left text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								<User class="h-4 w-4 shrink-0" />
								<span class="truncate">
									{$page.data.user.username}
								</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		{/if}
	</Sidebar.Footer>
</Sidebar.Root>

<style lang="postcss">
	:global(body) {
		/* Sidebar responsive handling is managed by the component library */
	}
</style>
