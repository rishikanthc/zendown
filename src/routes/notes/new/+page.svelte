<script lang="ts">
	import NotePanel from '../../NotePanel.svelte'; // Path relative to this file
	import { goto } from '$app/navigation';
	import type { Note } from '../../+page.svelte'; // Re-using Note type for clarity, ensure it has canonical_path

	// Define the expected structure of the new note data passed from NotePanel
	// This should match the structure of a note object, especially needing canonical_path.
	// The `Note` type from `+page.svelte` might be suitable if it includes `canonical_path`.
	// Let's assume `Note` type includes `id` and `canonical_path`.
	// If not, we might need a more specific type like:
	// type NewNoteReturnData = { id: string; canonical_path: string; [key: string]: any; };

	async function handleNoteCreated(newNote: Note) {
		if (newNote && newNote.canonical_path) {
			// Navigate to the newly created note's page
			// The canonical_path should not have a leading slash if used directly in goto like `/${path}`
			// If it might, ensure it's handled, or that slugify always returns a clean path.
			// The current structure seems to be `goto(\`/${newNote.canonical_path}\`)`
			await goto(`/${newNote.canonical_path}`);
		} else {
			// Fallback or error handling: if navigation fails, go to homepage
			console.error(
				'New note created, but canonical_path was missing for navigation. Redirecting to home.'
			);
			await goto('/');
		}
	}
</script>

<div class="w-full min-h-screen bg-white dark:bg-gray-900">
	<!--
		Render NotePanel without `initialContent` or `id` props.
		This makes NotePanel operate in "new note" mode,
		loading from localStorage (if anything is there for 'milkdown-editor-content')
		or using its default new note template.
		The onNoteCreated callback handles navigation after successful save.
	-->
	<NotePanel onNoteCreated={handleNoteCreated} />
</div>

<style>
	/* You can add specific styles for the new note page if needed,
	   or ensure global styles cover its appearance. */
</style>