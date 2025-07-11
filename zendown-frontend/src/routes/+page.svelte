<script lang="ts">
	import '$lib/tw.css';
	import { api, type Note, type RelatedNoteResponse, type SemanticSearchResponse, type Collection } from '$lib/api';
	import { onMount, onDestroy } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import TiptapEditor from '$lib/TiptapEditor.svelte';
	import WordCount from '$lib/components/WordCount.svelte';

	import { toast } from 'svelte-sonner';
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
	import Collections from '$lib/components/Collections.svelte';
	
	let value = $state('');

	let currentNote: Note | null = $state(null);
	let notes: Note[] = $state([]);
	let isLoading = $state(false);
	let error = $state('');

	let hasUnsavedChanges = $state(false);
	let lastSavedContent = $state('');

	// Collections state
	let collections: Collection[] = $state([]);
	let isLoadingCollections = $state(false);
	let collectionsError = $state('');

	// Collection notes state
	let collectionNotes: Record<number, Note[]> = $state({});
	let isLoadingCollectionNotes: Record<number, boolean> = $state({});
	let expandedCollections: number[] = $state([]);

	// Tab state
	let activeTab = $state('notes');

	// Related notes state
	let relatedNotes: RelatedNoteResponse[] = $state([]);
	let isLoadingRelatedNotes = $state(false);
	let relatedNotesError = $state('');

	// Semantic search state
	let isSearchOpen = $state(false);
	let searchQuery = $state('');
	let searchResults: SemanticSearchResponse[] = $state([]);
	let isLoadingSearch = $state(false);
	let searchError = $state('');

	// Zen mode state
	let isZenMode = $state(false);
	let previousSidebarState = $state(true); // Store sidebar state before entering zen mode

	// Reactive sorted notes - automatically updates when notes change
	let sortedNotes = $derived(() => {
		return [...notes].sort((a, b) => 
			new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
		);
	});

	let sidebar: any;
	onMount(() => {
		sidebar = useSidebar();
		loadNotes();
		loadCollections();
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});

	// Load collections
	async function loadCollections() {
		try {
			isLoadingCollections = true;
			collectionsError = '';
			collections = await api.getAllCollections();
		} catch (err) {
			collectionsError = `Failed to load collections: ${err}`;
			console.error('Error loading collections:', err);
		} finally {
			isLoadingCollections = false;
		}
	}

	// Load notes for a specific collection
	async function loadCollectionNotes(collectionId: number, forceReload = false) {
		console.log('Loading notes for collection:', collectionId, 'forceReload:', forceReload);
		if (collectionNotes[collectionId] && !forceReload) {
			console.log('Notes already loaded for collection:', collectionId);
			return; // Already loaded
		}
		
		try {
			isLoadingCollectionNotes[collectionId] = true;
			console.log('Fetching notes from API for collection:', collectionId);
			const notes = await api.getNotesByCollection(collectionId);
			console.log('Received notes:', notes);
			collectionNotes[collectionId] = notes || [];
		} catch (err) {
			console.error(`Failed to load notes for collection ${collectionId}:`, err);
			collectionNotes[collectionId] = [];
		} finally {
			isLoadingCollectionNotes[collectionId] = false;
		}
	}

	// Refresh collection notes for a specific collection
	async function refreshCollectionNotes(collectionId: number) {
		await loadCollectionNotes(collectionId, true);
	}

	// Refresh all currently expanded collections
	async function refreshAllExpandedCollections() {
		const promises = expandedCollections.map(collectionId => 
			refreshCollectionNotes(collectionId)
		);
		await Promise.all(promises);
	}

	// Toggle collection expansion
	async function toggleCollection(collectionId: number) {
		console.log('Toggle collection called with ID:', collectionId);
		console.log('Current expanded collections:', expandedCollections);
		
		if (expandedCollections.includes(collectionId)) {
			// Collapse
			console.log('Collapsing collection:', collectionId);
			expandedCollections = expandedCollections.filter(id => id !== collectionId);
		} else {
			// Expand
			console.log('Expanding collection:', collectionId);
			expandedCollections = [...expandedCollections, collectionId];
			// Load notes if not already loaded
			await loadCollectionNotes(collectionId);
		}
		
		console.log('Updated expanded collections:', expandedCollections);
	}

	// Zen mode toggle function
	function toggleZenMode() {
		if (isZenMode) {
			// Exit zen mode
			isZenMode = false;
			if (sidebar) sidebar.setOpen(previousSidebarState);
			if (typeof document !== 'undefined') {
				document.exitFullscreen?.();
			}
		} else {
			// Enter zen mode
			if (sidebar) previousSidebarState = sidebar.open;
			isZenMode = true;
			if (sidebar) sidebar.setOpen(false);
			if (typeof document !== 'undefined') {
				document.documentElement.requestFullscreen?.();
			}
		}
	}

	// Keyboard shortcut handler
	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey && event.key === 'g') {
			event.preventDefault();
			toggleZenMode();
		}
	}

	// Extract title from HTML content (Tiptap format)
	function extractTitle(content: string): string {
		// If content is empty, return default title
		if (!content || content.trim() === '') {
			return 'Untitled Note';
		}

		// Create a temporary DOM element to parse the HTML
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = content;

		// Look for the first h1 heading specifically
		const h1Heading = tempDiv.querySelector('h1');
		
		if (h1Heading) {
			const title = h1Heading.textContent?.trim();
			if (title && title.length > 0) {
				return title;
			}
		}

		// If no h1 heading found, look for the first non-empty text content
		const firstTextNode = tempDiv.querySelector('p, div, span');
		
		if (firstTextNode) {
			const text = firstTextNode.textContent?.trim();
			if (text && text.length > 0) {
				// Limit to first 50 characters to avoid very long titles
				return text.length > 50 ? text.substring(0, 50) + '...' : text;
			}
		}

		return 'Untitled Note';
	}

	// Check if content is empty or just whitespace
	function isContentEmpty(content: string): boolean {
		return content.trim() === '';
	}

	// Auto-save note
	async function saveNote(isAutoSave = false) {
		// Don't save if content is empty and no current note
		if (!currentNote && isContentEmpty(value)) {
			return;
		}

		// Don't save if content hasn't actually changed
		if (currentNote && value === lastSavedContent) {
			return;
		}

		// Don't save if there are no unsaved changes
		if (!hasUnsavedChanges) {
			return;
		}

		if (!currentNote) {
			// Create new note only if content is not empty
			try {
				const title = extractTitle(value);
				currentNote = await api.createNote({ title, content: value });
				lastSavedContent = value;
				hasUnsavedChanges = false;
				// Add the new note to the notes array
				notes = [currentNote, ...notes];
				
				// Only show toast for manual saves, not auto-saves
				if (!isAutoSave) {
					toast.success('Note created successfully');
				}
			} catch (err) {
				// Always show error toasts regardless of save type
				toast.error(`Failed to create note: ${err}`);
			}
		} else {
			// Update existing note
			try {
				const title = extractTitle(value);
				const updatedNote = await api.updateNote(currentNote.id, { title, content: value });
				lastSavedContent = value;
				hasUnsavedChanges = false;
				// Update the current note and the notes array
				currentNote = updatedNote;
				notes = notes.map(note => note.id === updatedNote.id ? updatedNote : note);
				
				// Only show toast for manual saves, not auto-saves
				if (!isAutoSave) {
					toast.success('Note updated successfully');
				}
			} catch (err) {
				// Always show error toasts regardless of save type
				toast.error(`Failed to update note: ${err}`);
			}
		}
	}

	// Load all notes
	async function loadNotes() {
		try {
			isLoading = true;
			notes = await api.getAllNotes();
			// Sort notes by recently modified (newest first)
			notes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
			
			// Load the first (most recently modified) note by default
			if (notes.length > 0 && !currentNote) {
				await loadNote(notes[0]);
			}
		} catch (err) {
			error = `Failed to load notes: ${err}`;
		} finally {
			isLoading = false;
		}
	}

	// Load a specific note
	async function loadNote(note: Note) {
		try {
			currentNote = await api.getNote(note.id);
			value = currentNote.content;
			lastSavedContent = currentNote.content;
			hasUnsavedChanges = false;
		} catch (err) {
			error = `Failed to load note: ${err}`;
		}
	}

	// Create new note
	function newNote() {
		currentNote = null;
		value = '';
		lastSavedContent = '';
		hasUnsavedChanges = false;
	}

	// Delete note by ID (for context menu)
	async function deleteNoteById(noteId: number) {
		try {
			await api.deleteNote(noteId);
			
			// Remove the note from the notes array
			notes = notes.filter(note => note.id !== noteId);
			
			// If the deleted note was the current note, load the next available note
			if (currentNote?.id === noteId) {
				if (notes.length > 0) {
					// Load the first note from the remaining notes
					await loadNote(notes[0]);
				} else {
					// If no notes remain, create a new empty note
					newNote();
				}
			}
			
			toast.success('Note deleted successfully');
		} catch (err) {
			toast.error(`Failed to delete note: ${err}`);
		}
	}

	// Load related notes for the current note
	async function loadRelatedNotes(noteId: number) {
		if (!noteId) return;
		
		try {
			isLoadingRelatedNotes = true;
			relatedNotesError = '';
			
			relatedNotes = await api.getRelatedNotes(noteId, 0.3);
			
		} catch (err) {
			relatedNotesError = `Failed to load related notes: ${err}`;
			console.error('Error loading related notes:', err);
		} finally {
			isLoadingRelatedNotes = false;
		}
	}

	// Semantic search functions
	function openSearch() {
		isSearchOpen = true;
		searchQuery = '';
		searchResults = [];
		searchError = '';
		// Focus the input after a brief delay to ensure the overlay is rendered
		setTimeout(() => {
			const input = document.getElementById('search-input');
			if (input) input.focus();
		}, 100);
	}

	function closeSearch() {
		isSearchOpen = false;
		searchQuery = '';
		searchResults = [];
		searchError = '';
	}

	async function performSearch() {
		if (!searchQuery.trim()) return;
		
		try {
			isLoadingSearch = true;
			searchError = '';
			
			searchResults = await api.semanticSearch(searchQuery.trim(), 0.3);
			
		} catch (err) {
			searchError = `Failed to perform search: ${err}`;
			console.error('Error performing semantic search:', err);
		} finally {
			isLoadingSearch = false;
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			performSearch();
		} else if (event.key === 'Escape') {
			closeSearch();
		}
	}

	function selectSearchResult(result: SemanticSearchResponse) {
		loadNote(result.note);
		closeSearch();
	}

	// Collections event handlers
	async function handleAddCollection(event: CustomEvent<{ noteId: number; collectionName: string }>) {
		const { noteId, collectionName } = event.detail;
		toast.success(`Added to "${collectionName}" collection`);
		
		// Reload collections to get the new collection if it was created
		await loadCollections();
		
		// If the collection is currently expanded, refresh its notes
		const collection = collections.find(c => c.name === collectionName);
		if (collection && expandedCollections.includes(collection.id)) {
			await refreshCollectionNotes(collection.id);
		}
	}

	async function handleRemoveCollection(event: CustomEvent<{ noteId: number; collectionName: string }>) {
		const { noteId, collectionName } = event.detail;
		toast.success(`Removed from "${collectionName}" collection`);
		
		// If the collection is currently expanded, refresh its notes
		const collection = collections.find(c => c.name === collectionName);
		if (collection && expandedCollections.includes(collection.id)) {
			await refreshCollectionNotes(collection.id);
		}
	}

	// Handle content changes from TiptapEditor
	function handleContentChange(newValue: string) {
		value = newValue;
	}

	// Track unsaved changes
	$effect(() => {
		if (currentNote) {
			hasUnsavedChanges = value !== lastSavedContent;
		} else {
			hasUnsavedChanges = value.trim() !== '';
		}
	});

	// Reactive effect to load related notes when current note changes
	$effect(() => {
		if (currentNote?.id) {
			loadRelatedNotes(currentNote.id);
		} else {
			// Clear related notes when no note is selected
			relatedNotes = [];
			relatedNotesError = '';
		}
	});

	// Reactive effect to reload collections when tab changes to collections
	$effect(() => {
		if (activeTab === 'collections') {
			loadCollections();
		}
	});
</script>

<Sidebar.Provider>
	<!-- Sidebar -->
	{#if !isZenMode}
		<Sidebar.Root class="border-none bg-neutral-50">
			<Sidebar.Header class="px-6 py-4">
				<div class="flex items-center gap-2">
					<div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
						<span class="text-primary-foreground font-semibold text-sm">Z</span>
					</div>
					<h1 class="text-lg font-semibold text-foreground">Zendown</h1>
				</div>
			</Sidebar.Header>
			
			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton onclick={newNote}>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
									</svg>
									<span>New Note</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<a href="/images" class="w-full">
									<Sidebar.MenuButton>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
										</svg>
										<span>Images</span>
									</Sidebar.MenuButton>
								</a>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
				
				<Sidebar.Separator />
				
				<Sidebar.Group>
					<Sidebar.GroupContent>
						<Tabs.Root bind:value={activeTab} class="w-full">
							<Tabs.List class="flex gap-1 mb-2">
								<Tabs.Trigger value="notes" class="w-9 h-9 p-0 flex items-center justify-center">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
									</svg>
								</Tabs.Trigger>
								<Tabs.Trigger value="collections" class="w-9 h-9 p-0 flex items-center justify-center">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
									</svg>
								</Tabs.Trigger>
							</Tabs.List>
							
							<Tabs.Content value="notes">
								{#if isLoading}
									<Sidebar.Menu>
										{#each Array(3) as _}
											<Sidebar.MenuItem>
												<Sidebar.MenuSkeleton />
											</Sidebar.MenuItem>
										{/each}
									</Sidebar.Menu>
								{:else if notes.length === 0}
									<div class="px-3 py-8 text-center">
										<div class="text-muted-foreground text-sm">
											<p class="mb-2">No notes yet</p>
											<p class="text-xs">Create your first note to get started</p>
										</div>
									</div>
								{:else}
									<Sidebar.Menu>
										{#each sortedNotes() as note}
											<ContextMenu.Root>
												<ContextMenu.Trigger>
													<Sidebar.MenuItem>
														<Sidebar.MenuButton 
															isActive={currentNote?.id === note.id}
															onclick={() => loadNote(note)}
														>
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
															</svg>
															<span>{note.title}</span>
														</Sidebar.MenuButton>
													</Sidebar.MenuItem>
												</ContextMenu.Trigger>
												<ContextMenu.Content>
													<ContextMenu.Item onSelect={() => deleteNoteById(note.id)}>
														<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
														</svg>
														Delete
													</ContextMenu.Item>
												</ContextMenu.Content>
											</ContextMenu.Root>
										{/each}
									</Sidebar.Menu>
								{/if}
							</Tabs.Content>
							
							<Tabs.Content value="collections">
								{#if isLoadingCollections}
									<Sidebar.Menu>
										{#each Array(3) as _}
											<Sidebar.MenuItem>
												<Sidebar.MenuSkeleton />
											</Sidebar.MenuItem>
										{/each}
									</Sidebar.Menu>
								{:else if collectionsError}
									<div class="px-3 py-8 text-center">
										<div class="text-muted-foreground text-sm">
											<p class="mb-2">Failed to load collections</p>
											<p class="text-xs">{collectionsError}</p>
										</div>
									</div>
								{:else if collections.length === 0}
									<div class="px-3 py-8 text-center">
										<div class="text-muted-foreground text-sm">
											<p class="mb-2">No collections yet</p>
											<p class="text-xs">Create collections to organize your notes</p>
										</div>
									</div>
								{:else}
									<Sidebar.Menu>
										{#each collections as collection}
											<Sidebar.MenuItem>
												<Sidebar.MenuButton 
													isActive={expandedCollections.includes(collection.id)}
													onclick={() => toggleCollection(collection.id)}
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
													</svg>
													<span>{collection.name}</span>
												</Sidebar.MenuButton>
											</Sidebar.MenuItem>
											
											<!-- Collection notes (shown when expanded) -->
											{#if expandedCollections.includes(collection.id)}
												{#if isLoadingCollectionNotes[collection.id]}
													<Sidebar.MenuItem>
														<div class="pl-6">
															<Sidebar.MenuSkeleton />
														</div>
													</Sidebar.MenuItem>
												{:else if collectionNotes[collection.id] && collectionNotes[collection.id].length > 0}
													{#each collectionNotes[collection.id] as note}
														<Sidebar.MenuItem>
															<div class="pl-6">
																<Sidebar.MenuButton 
																	isActive={currentNote?.id === note.id}
																	onclick={() => loadNote(note)}
																>
																	<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
																	</svg>
																	<span>{note.title}</span>
																</Sidebar.MenuButton>
															</div>
														</Sidebar.MenuItem>
													{/each}
												{:else}
													<Sidebar.MenuItem>
														<div class="pl-6 px-3 py-2">
															<div class="text-muted-foreground text-xs">
																No notes in this collection
															</div>
														</div>
													</Sidebar.MenuItem>
												{/if}
											{/if}
										{/each}
									</Sidebar.Menu>
								{/if}
							</Tabs.Content>
						</Tabs.Root>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			</Sidebar.Content>
		</Sidebar.Root>
	{/if}

	<!-- Main content -->
	<main class="flex-1 flex flex-col" class:zen-mode={isZenMode}>
		<!-- Header -->
		{#if !isZenMode}
			<header class="px-6 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<Sidebar.Trigger />
					</div>
					<div class="flex items-center gap-2">
						{#if currentNote}
							<Collections
								currentNoteId={currentNote.id}
								on:addCollection={handleAddCollection}
								on:removeCollection={handleRemoveCollection}
							/>
						{/if}
						<Button 
							variant="ghost" 
							size="icon" 
							onclick={openSearch}
							class="h-9 w-9"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
							</svg>
						</Button>
					</div>
				</div>
			</header>
		{/if}

		<!-- Error banner -->
		{#if error}
			<div class="bg-destructive/10 border-b border-destructive/20 px-6 py-3">
				<div class="flex items-center justify-between">
					<p class="text-sm text-destructive">{error}</p>
					<Button 
						variant="ghost" 
						size="sm" 
						onclick={() => error = ''}
						class="text-destructive hover:text-destructive"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</Button>
				</div>
			</div>
		{/if}

		<!-- Editor -->
		<div class="w-[800px] mx-auto" class:zen-editor={isZenMode}>
			<TiptapEditor 
				bind:value
				onChange={handleContentChange}
				onSave={saveNote}
				placeholder="Start writing your thoughts..."
				{isZenMode}
			/>
		</div>

		<!-- Related Notes Section -->
		{#if currentNote && !isZenMode}
			<div class="w-[800px] mx-auto mt-6 pb-8">
				<Separator class="mb-4" />
				
				<div class="space-y-3">
					<h3 class="text-base font-medium text-gray-700">Related Notes</h3>
					
					{#if isLoadingRelatedNotes}
						<div class="space-y-1">
							{#each Array(3) as _}
								<div class="flex items-center justify-between p-2">
									<div class="flex items-center space-x-2 flex-1">
										<Skeleton class="h-3.5 w-3.5" />
										<Skeleton class="h-4 w-32" />
									</div>
									<Skeleton class="h-3 w-8" />
								</div>
							{/each}
						</div>
					{:else if relatedNotesError}
						<div class="text-sm text-muted-foreground">
							<p>{relatedNotesError}</p>
						</div>
					{:else if relatedNotes.length === 0}
						<div class="text-sm text-muted-foreground">
							<p>No related notes found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each relatedNotes as relatedNote}
								<div class="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors group">
									<div class="flex items-center space-x-2 flex-1 min-w-0">
										<svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
										</svg>
										<button 
											class="text-sm text-gray-700 hover:text-blue-600 transition-colors text-left truncate flex-1"
											onclick={() => loadNote(relatedNote.note)}
										>
											{relatedNote.note.title}
										</button>
									</div>
									<div class="flex items-center space-x-1">
										<span class="text-xs text-gray-500 font-mono">
											{(relatedNote.score * 100).toFixed(0)}%
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</Sidebar.Provider>

<!-- Semantic Search Overlay -->
{#if isSearchOpen}
	<div class="fixed inset-0 z-50 flex items-start justify-center pt-20">
		<!-- Backdrop -->
		<div 
			class="absolute inset-0 bg-black/20 backdrop-blur-sm" 
			onclick={closeSearch}
		></div>
		
		<!-- Search Container -->
		<div class="relative w-full max-w-2xl mx-4">
			<!-- Search Input -->
			<div class="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
					<Input
						id="search-input"
						bind:value={searchQuery}
						onkeydown={handleSearchKeydown}
						placeholder="Search your notes semantically..."
						class="flex-1 border-0 shadow-none focus-visible:ring-0 text-base"
					/>
					{#if isLoadingSearch}
						<div class="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
					{/if}
				</div>
			</div>
			
			<!-- Search Results -->
			{#if searchQuery.trim() && (searchResults.length > 0 || isLoadingSearch || searchError)}
				<div class="mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden">
					{#if isLoadingSearch}
						<div class="p-4">
							<div class="space-y-3">
								{#each Array(3) as _}
									<div class="flex items-center justify-between">
										<div class="flex items-center space-x-3 flex-1">
											<Skeleton class="h-4 w-4" />
											<Skeleton class="h-4 w-48" />
										</div>
										<Skeleton class="h-3 w-8" />
									</div>
								{/each}
							</div>
						</div>
					{:else if searchError}
						<div class="p-4 text-sm text-red-600">
							{searchError}
						</div>
					{:else if searchResults.length === 0}
						<div class="p-4 text-sm text-gray-500">
							No results found for "{searchQuery}"
						</div>
					{:else}
						<div class="max-h-80 overflow-y-auto">
							{#each searchResults as result}
								<button
									class="w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
									onclick={() => selectSearchResult(result)}
								>
									<div class="flex items-center justify-between">
										<div class="flex items-center space-x-3 flex-1 min-w-0">
											<svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
											</svg>
											<div class="min-w-0 flex-1">
												<div class="text-sm font-medium text-gray-900 truncate">
													{result.note.title}
												</div>
												<div class="text-xs text-gray-500 mt-1">
													{new Date(result.note.updated_at).toLocaleDateString()}
												</div>
											</div>
										</div>
										<div class="flex items-center space-x-2">
											<span class="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
												{(result.score * 100).toFixed(0)}%
											</span>
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Fixed unsaved changes indicator -->
{#if hasUnsavedChanges}
	<div class="fixed top-4 right-4 z-50 w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-lg"></div>
{/if}

<!-- Word Count -->
<WordCount content={value} />




<style>

@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Space+Grotesk:wght@300..700&display=swap');

  /* Override Carta's focus outline CSS variables */
  :global(.carta-theme__tw) {
    --focus-outline: transparent !important;
    --focus-outline-dark: transparent !important;
  }

  /* Remove focus outlines from all Carta editor elements */
  :global(.carta-editor),
  :global(.carta-editor *),
  :global(.carta-input),
  :global(.carta-input *),
  :global(.carta-input-wrapper),
  :global(.carta-input-wrapper *),
  :global(.carta-editor > textarea) {
    outline: none !important;
    /* border: none !important; */
    box-shadow: none !important;
  }

  /* Specific override for the textarea */
  :global(.carta-editor > textarea) {
    height: 100% !important;
    min-height: 100%;
    box-sizing: border-box;
    outline: none !important;
    /* border: none !important; */
    box-shadow: none !important;
  }

  /* Remove any focus-visible styles */
  :global(.carta-editor:focus-visible),
  :global(.carta-input:focus-visible),
  :global(.carta-input-wrapper:focus-visible),
  :global(.carta-editor > textarea:focus-visible) {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }

  /* Sidebar button styles - override shadcn defaults */
  :global([data-sidebar="menu-button"]) {
    transition: all 0.2s ease-in-out;
  }

  :global([data-sidebar="menu-button"]:hover) {
    background-color: rgb(229 231 235) !important; /* gray-200 */
  }

  :global([data-sidebar="menu-button"][data-active="true"]) {
    background-color: rgb(209 213 219) !important; /* gray-300 */
    font-weight: normal !important; /* Remove bold text */
  }

  :global([data-sidebar="menu-button"][data-active="true"]:hover) {
    background-color: rgb(209 213 219) !important; /* Keep same color on hover when active */
  }

  /* Zen mode styles */
  .zen-mode {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .zen-editor {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
  }
</style>