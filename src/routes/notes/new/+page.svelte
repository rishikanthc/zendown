<script lang="ts">
	import NotePanel from '../../NotePanel.svelte';
	import { goto } from '$app/navigation';

	// Define a type for the data returned when a new note is created.
	// It must have a `canonical_path` for navigation.
	type NewNoteReturnData = {
		id: string;
		canonical_path: string;
		[key: string]: any;
	};

	// This function is called by NotePanel after a new note is successfully created.
	async function handleNoteCreated(newNote: NewNoteReturnData) {
		// After creating a new note, navigate to its page.
		if (newNote && newNote.canonical_path) {
			// `invalidateAll` ensures the sidebar and other layout data reloads.
			await goto(`/${newNote.canonical_path}`, { invalidateAll: true });
		} else {
			// As a fallback, go to the homepage if navigation fails.
			console.error('New note created, but canonical_path was missing. Redirecting to home.');
			await goto('/');
		}
	}

	// Provide a default content for a new note. This ensures the `content` prop
	// passed to NotePanel is never undefined.
	const newNoteContent = '# New Note\n\nStart writing...';
</script>

<div class="h-full w-full">
	<!--
		Render NotePanel for a new note.
		- Pass the default content.
		- Do not pass an `id`, which signals to NotePanel that this is a new note.
		- Pass the callback to handle navigation after the note is created.
	-->
	<NotePanel content={newNoteContent} onNoteCreated={handleNoteCreated} />
</div>
