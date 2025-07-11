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

	interface Props {
		currentNoteId: number | null;
		currentCollections: string[];
		allCollections: string[];
	}

	let { currentNoteId, currentCollections, allCollections }: Props = $props();

	const dispatch = createEventDispatcher<{
		addCollection: { noteId: number; collectionName: string };
		removeCollection: { noteId: number; collectionName: string };
	}>();

	let isOpen = $state(false);
	let newCollectionInput = $state('');
	
	// Use $derived for computed values instead of $effect
	const availableCollections = $derived.by(() => {
		// Start with default collections
		const defaultCollections = [
			'Work',
			'Personal',
			'Project Ideas',
			'Meeting Notes',
			'Research',
			'Daily Journal',
			'Book Notes',
			'Code Snippets'
		];
		
		// Combine default collections with any additional collections from props
		const allCols = [...new Set([...defaultCollections, ...allCollections])];
		
		// Filter out collections that are already assigned to the current note
		const filtered = allCols.filter((collection: string) => 
			!currentCollections.includes(collection)
		);
		
		console.log('Collections: availableCollections updated:', {
			allCollections: allCollections.length,
			currentCollections: currentCollections.length,
			filtered: filtered.length,
			allCols: allCols.length
		});
		
		return filtered;
	});

	// Create a stable Fuse instance that updates when availableCollections changes
	const fuseInstance = $derived.by(() => {
		console.log('Collections: Creating new Fuse instance with:', availableCollections.length, 'items');
		return new Fuse(availableCollections, {
			threshold: 0.3,
			includeScore: true
		});
	});

	const filteredCollections = $derived.by(() => {
		if (!newCollectionInput.trim()) {
			return [];
		}
		
		console.log('Collections: Searching for:', newCollectionInput, 'in:', availableCollections.length, 'items');
		const results = fuseInstance.search(newCollectionInput);
		const mapped = results.map(result => result.item);
		console.log('Collections: Search results:', mapped);
		return mapped;
	});

	const showSuggestions = $derived.by(() => {
		const shouldShow = newCollectionInput.trim() && filteredCollections.length > 0;
		console.log('Collections: showSuggestions:', shouldShow, 'input:', newCollectionInput, 'results:', filteredCollections.length);
		return shouldShow;
	});

	function handleAddCollection(collectionName: string) {
		if (!currentNoteId || !collectionName.trim()) return;
		
		const name = collectionName.trim();
		console.log('Collections: Adding collection:', name, 'to note:', currentNoteId);
		dispatch('addCollection', { noteId: currentNoteId, collectionName: name });
		newCollectionInput = '';
	}

	function handleRemoveCollection(collectionName: string) {
		if (!currentNoteId) return;
		
		console.log('Collections: Removing collection:', collectionName, 'from note:', currentNoteId);
		dispatch('removeCollection', { noteId: currentNoteId, collectionName });
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
			
			<!-- Current Collections -->
			{#if currentCollections.length > 0}
				<div class="space-y-2">
					<p class="text-xs font-medium text-muted-foreground">Current Collections</p>
					<div class="flex flex-wrap gap-2">
						{#each currentCollections as collection}
							<Badge class="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 group">
								{collection}
								<button
									class="ml-1 opacity-70 hover:opacity-100 transition-opacity"
									onclick={() => handleRemoveCollection(collection)}
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
					{#if newCollectionInput.trim() && !showSuggestions}
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
				{#if showSuggestions}
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
		</div>
	</Popover.Content>
</Popover.Root> 