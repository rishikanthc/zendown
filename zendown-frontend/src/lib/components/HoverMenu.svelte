<script lang="ts">
		import { Button } from '$lib/components/ui/button/index.js';
	import { createEventDispatcher } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import {Grip} from '@lucide/svelte';
	import GroupIcon from '@lucide/svelte/icons/group';
	import ArrowBigDownDashIcon from '@lucide/svelte/icons/arrow-big-down-dash';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Fuse from 'fuse.js';
	import { api, type Collection } from '$lib/api';

	interface Props {
		currentNoteId: number | null;
		notesCount: number;
		isExportingAll: boolean;
		exportProgress: { current: number; total: number };
		forceClose?: boolean;
	}

	let { currentNoteId, notesCount, isExportingAll, exportProgress, forceClose = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		exportAllNotes: void;
		openSearch: void;
		addCollection: { noteId: number; collectionName: string };
		removeCollection: { noteId: number; collectionName: string };
	}>();

	let isOpen = $state(false);
	let newCollectionInput = $state('');
	let currentCollections = $state<Collection[]>([]);
	let allCollections = $state<Collection[]>([]);
	let isLoading = $state(false);
	let hasError = $state(false);

	// Load collections when component mounts or note changes
	$effect(() => {
		if (currentNoteId) {
			loadCollections();
		} else {
			// Reset state when no note is selected
			currentCollections = [];
			allCollections = [];
			isLoading = false;
			hasError = false;
		}
	});

	// Close popover when forceClose is true
	$effect(() => {
		if (forceClose && isOpen) {
			isOpen = false;
		}
	});

	async function loadCollections() {
		if (!currentNoteId) return;
		
		try {
			isLoading = true;
			hasError = false;
			const [noteCollections, allCols] = await Promise.all([
				api.getNoteCollections(currentNoteId),
				api.getAllCollections()
			]);
			
			currentCollections = noteCollections || [];
			allCollections = allCols || [];
		} catch (error) {
			console.error('Failed to load collections:', error);
			hasError = true;
			currentCollections = [];
			allCollections = [];
		} finally {
			isLoading = false;
		}
	}

	// Use $derived for computed values
	const availableCollections = $derived.by(() => {
		const allCollectionNames = allCollections?.map(c => c.name) || [];
		const currentCollectionNames = currentCollections?.map(c => c.name) || [];
		return allCollectionNames.filter((collection: string) => 
			!currentCollectionNames.includes(collection)
		);
	});

	const fuseInstance = $derived.by(() => {
		const collections = availableCollections || [];
		return new Fuse(collections, {
			threshold: 0.3,
			includeScore: true
		});
	});

	const filteredCollections = $derived.by(() => {
		if (!newCollectionInput?.trim()) {
			return [];
		}
		
		const results = fuseInstance.search(newCollectionInput);
		return results.map(result => result.item);
	});

	const showSuggestions = $derived.by(() => {
		return newCollectionInput?.trim() && filteredCollections?.length > 0;
	});

	async function handleAddCollection(collectionName: string) {
		if (!currentNoteId || !collectionName.trim()) return;
		
		const name = collectionName.trim();
		try {
			await api.addNoteToCollection(currentNoteId, name);
			dispatch('addCollection', { noteId: currentNoteId, collectionName: name });
			newCollectionInput = '';
			await loadCollections();
		} catch (error) {
			console.error('Failed to add collection:', error);
		}
	}

	async function handleRemoveCollection(collectionName: string) {
		if (!currentNoteId) return;
		
		try {
			await api.removeNoteFromCollection(currentNoteId, collectionName);
			dispatch('removeCollection', { noteId: currentNoteId, collectionName });
			await loadCollections();
		} catch (error) {
			console.error('Failed to remove collection:', error);
		}
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (newCollectionInput.trim()) {
				handleAddCollection(newCollectionInput);
			}
		} else if (event.key === 'Escape') {
			newCollectionInput = '';
		}
	}

	function selectSuggestion(collectionName: string) {
		handleAddCollection(collectionName);
	}

	function createNewCollection() {
		if (newCollectionInput.trim()) {
			handleAddCollection(newCollectionInput);
		}
	}

	function handleExportClick() {
		dispatch('exportAllNotes');
	}

	function handleSearchClick() {
		dispatch('openSearch');
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		<Button 
			variant="ghost" 
			size="icon" 
			class="h-8 w-8 sm:h-9 sm:w-9 transition-all duration-200 hover:bg-gray-100"
			title="More options"
		>
			<Grip class="w-6 h-6" />
		</Button>
	</Popover.Trigger>
	
	<Popover.Content 
		class="w-80 p-0 bg-white shadow-lg rounded-lg border-0" 
		align="end"
		side="bottom"
		sideOffset={4}
	>
		<div class="py-3">
			<!-- Collections Section -->
			{#if currentNoteId}
				<div class="px-4 pb-3 border-b border-gray-100">
					<h4 class="text-sm font-medium text-gray-900 mb-2">Collections</h4>
					
					{#if isLoading}
						<div class="text-xs text-gray-500">Loading collections...</div>
					{:else if hasError}
						<div class="text-xs text-red-500">Failed to load collections</div>
					{:else}
						<!-- Current Collections -->
						{#if currentCollections && currentCollections.length > 0}
							<div class="mb-3">
								<p class="text-xs font-medium text-gray-600 mb-2">Current Collections</p>
								<div class="flex flex-wrap gap-1">
									{#each currentCollections as collection}
										<Badge class="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 text-xs px-2 py-1 group">
											{collection.name}
											<button
												class="ml-1 opacity-70 hover:opacity-100 transition-opacity"
												onclick={() => handleRemoveCollection(collection.name)}
											>
												<XIcon class="w-3 h-3" />
											</button>
										</Badge>
									{/each}
								</div>
							</div>
						{/if}
						
						<!-- Add Collection Input -->
						<div>
							<p class="text-xs font-medium text-gray-600 mb-2">Add Collection</p>
							<div class="relative">
								<Input
									bind:value={newCollectionInput}
									onkeydown={handleInputKeydown}
									placeholder="Type collection name..."
									class="text-xs h-8 pr-8 focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
								/>
								{#if newCollectionInput && newCollectionInput.trim() && !showSuggestions}
									<Button
										variant="ghost"
										size="icon"
										class="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
										onclick={createNewCollection}
									>
										<PlusIcon class="w-3 h-3" />
									</Button>
								{/if}
							</div>
							
							<!-- Suggestions -->
							{#if showSuggestions && filteredCollections && filteredCollections.length > 0}
								<div class="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg max-h-32 overflow-y-auto border border-gray-200">
									{#each filteredCollections as collection}
										<button
											class="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors first:rounded-t-md last:rounded-b-md"
											onclick={() => selectSuggestion(collection)}
										>
											{collection}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Export All Notes Button -->
			<button
				class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 relative"
				onclick={handleExportClick}
				disabled={isExportingAll || notesCount === 0}
				class:opacity-50={isExportingAll || notesCount === 0}
				class:cursor-not-allowed={isExportingAll || notesCount === 0}
			>
				{#if isExportingAll}
					<div class="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
				{:else}
					<ArrowBigDownDashIcon class="w-4 h-4 text-gray-600" />
				{/if}
				<span>Export All Notes</span>
				{#if isExportingAll}
					<span class="text-xs text-gray-500 ml-auto">
						{exportProgress.current}/{exportProgress.total}
					</span>
				{/if}
			</button>

			<!-- Search Button -->
			<button
				class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3"
				onclick={handleSearchClick}
			>
				<SearchIcon class="w-4 h-4 text-gray-600" />
				<span>Search Notes</span>
			</button>
		</div>
	</Popover.Content>
</Popover.Root>

 