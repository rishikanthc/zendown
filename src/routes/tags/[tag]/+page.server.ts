import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

// Define the expected structure of a note's title information
interface NoteTitle {
	id: string;
	title: string;
	canonical_path: string;
}

// Define the data structure for the page
export interface PageData {
	notes: NoteTitle[];
	tag: string;
	error?: string;
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const tag = params.tag;

	if (!tag) {
		throw error(400, 'Tag parameter is required.');
	}

	try {
		// Step 1: Fetch the list of note IDs for the given tag.
		const idResponse = await fetch(`/api/tags/tag/${tag}`);

		if (!idResponse.ok) {
			const errorData = await idResponse.json().catch(() => ({ message: 'Failed to fetch note IDs for the tag.' }));
			// Throw a SvelteKit error to be handled by the error page.
			throw error(idResponse.status, errorData.message || `Request failed: ${idResponse.statusText}`);
		}

		const { noteIds } = await idResponse.json();

		if (!noteIds || noteIds.length === 0) {
			// No notes found for this tag, return an empty array.
			return {
				notes: [],
				tag: tag
			};
		}

		// Step 2: Fetch the details (title, path) for the found note IDs.
		const notesResponse = await fetch('/api/notes/bulk-lookup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ ids: noteIds })
		});

		if (!notesResponse.ok) {
			const errorData = await notesResponse.json().catch(() => ({ message: 'Failed to fetch note details.' }));
			throw error(notesResponse.status, errorData.message || `Failed to fetch details for notes.`);
		}

		const notes: NoteTitle[] = await notesResponse.json();

		// Return the successfully fetched note details.
		return {
			notes,
			tag: tag
		};

	} catch (e: any) {
		// Catch any unhandled errors, including thrown SvelteKit errors, and re-throw them.
		if (e.status) {
			throw e;
		}
		console.error(`Failed to load notes for tag '${tag}':`, e);
		throw error(500, e.message || `An unexpected error occurred while fetching notes for the tag '${tag}'.`);
	}
};
