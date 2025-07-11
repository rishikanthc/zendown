<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import GroupIcon from '@lucide/svelte/icons/group';
	import XIcon from '@lucide/svelte/icons/x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { createEventDispatcher } from 'svelte';
	import Fuse from 'fuse.js';
	import { api, type Collection } from '$lib/api';

	interface Props {
		currentNoteId: number | null;
	}

	let { currentNoteId }: Props = $props();

	const dispatch = createEventDispatcher<{
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
	
	// Use $derived for computed values instead of $effect
	const availableCollections = $derived.by(() => {
		// Get all collection names with null check
		const allCollectionNames = allCollections?.map(c => c.name) || [];
		
		// Filter out collections that are already assigned to the current note
		const currentCollectionNames = currentCollections?.map(c => c.name) || [];
		return allCollectionNames.filter((collection: string) => 
			!currentCollectionNames.includes(collection)
		);
	});

	// Create a stable Fuse instance that updates when availableCollections changes
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
			// Reload collections to get updated state
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
			// Reload collections to get updated state
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
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		<Button 
			variant="ghost" 
			size="icon" 
			class="h-9 w-9"
		>
			<GroupIcon class="w-4 h-4" />
		</Button>
	</Popover.Trigger>
	
	<Popover.Content 
		class="w-80 p-4 bg-white shadow-lg rounded-lg border-0" 
		align="end"
		side="bottom"
		sideOffset={4}
	>
		<div class="space-y-3">
			<h4 class="font-medium leading-none">Collections</h4>
			<p class="text-sm text-muted-foreground">
				Organize your notes into collections
			</p>
			
			{#if isLoading}
				<div class="flex items-center justify-center py-4">
					<div class="text-sm text-muted-foreground">Loading collections...</div>
				</div>
			{:else if hasError}
				<div class="flex items-center justify-center py-4">
					<div class="text-sm text-red-500">Failed to load collections</div>
				</div>
			{:else}
				<!-- Current Collections -->
				{#if currentCollections && currentCollections.length > 0}
					<div class="space-y-2">
						<p class="text-xs font-medium text-muted-foreground">Current Collections</p>
						<div class="flex flex-wrap gap-2">
							{#each currentCollections as collection}
								<Badge class="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 group">
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
				<div class="space-y-2">
					<p class="text-xs font-medium text-muted-foreground">Add Collection</p>
					<div class="relative">
						<Input
							bind:value={newCollectionInput}
							onkeydown={handleInputKeydown}
							placeholder="Type collection name..."
							class="pr-8 focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
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
						<div class="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg max-h-48 overflow-y-auto border-0">
							{#each filteredCollections as collection}
								<button
									class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors first:rounded-t-md last:rounded-b-md"
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
	</Popover.Content>
</Popover.Root> 