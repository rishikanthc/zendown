import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Regex to find markdown headings (h1-h6).
// It matches lines starting with 1 to 6 '#' characters followed by a space.
const headingRegex = /^(#{1,6}\s+.+)/gm;

// Regex to find tags.
// It looks for a '#' followed by one or more letters, numbers, underscores, or hyphens.
// This is run on content that has already had headings removed.
const tagRegex = /#([a-zA-Z0-9_-]+)/g;

export const GET: RequestHandler = async ({ params }) => {
	const noteId = params.id;

	if (!noteId || noteId.trim() === '') {
		return json({ message: 'Note ID is required.' }, { status: 400 });
	}

	try {
		const [note] = await db
			.select({ content: schema.note.content })
			.from(schema.note)
			.where(eq(schema.note.id, noteId))
			.limit(1);

		if (!note) {
			return json({ message: `Note with ID '${noteId}' not found.` }, { status: 404 });
		}

		if (typeof note.content !== 'string') {
			// Note exists but has no content, return empty list.
			return json({ tags: [] }, { status: 200 });
		}

		// First, remove all lines that are headings to avoid matching them.
		const contentWithoutHeadings = note.content.replace(headingRegex, '');

		// Then, find all matches for the tag regex in the remaining content.
		const matches = contentWithoutHeadings.matchAll(tagRegex);

		// Use a Set to automatically handle uniqueness of tags.
		const tags = new Set<string>();
		for (const match of matches) {
			// match[1] is the captured group without the '#'
			tags.add(match[1]);
		}

		// Return the unique tags as an array.
		return json({ tags: Array.from(tags) }, { status: 200 });
	} catch (error) {
		console.error(`Error fetching tags for note ID '${noteId}':`, error);
		return json({ message: 'Failed to fetch tags due to a server error.' }, { status: 500 });
	}
};
