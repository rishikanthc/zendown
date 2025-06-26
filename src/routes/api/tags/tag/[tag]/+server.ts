import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

// Regex to find markdown headings (h1-h6).
const headingRegex = /^(#{1,6}\s+.+)/gm;
// Regex to find tags.
const tagRegex = /#([a-zA-Z0-9_-]+)/g;

export const GET: RequestHandler = async ({ params }) => {
	const tagName = params.tag;

	if (!tagName || tagName.trim() === '') {
		return json({ message: 'Tag name is required.' }, { status: 400 });
	}

	try {
		const allNotes = await db.select({ id: schema.note.id, content: schema.note.content }).from(schema.note);

		const noteIdsWithTag: string[] = [];

		for (const note of allNotes) {
			if (typeof note.content !== 'string') {
				continue;
			}

			// First, remove all lines that are headings to avoid matching them.
			const contentWithoutHeadings = note.content.replace(headingRegex, '');

			// Then, find all matches for the tag regex in the remaining content.
			const matches = contentWithoutHeadings.matchAll(tagRegex);

			// Use a Set to see if the desired tag exists in this note.
			const tagsInNote = new Set<string>();
			for (const match of matches) {
				// match[1] is the captured group without the '#'
				tagsInNote.add(match[1]);
			}

			// If the note contains the tag we're looking for, add its ID to our list.
			if (tagsInNote.has(tagName)) {
				noteIdsWithTag.push(note.id);
			}
		}

		if (noteIdsWithTag.length === 0) {
			// This isn't an error, but a valid result. We could also just return an empty array.
			// For consistency, let's return a success status with the empty array.
			return json({ noteIds: [] }, { status: 200 });
		}

		return json({ noteIds: noteIdsWithTag }, { status: 200 });

	} catch (error) {
		console.error(`Error fetching notes for tag '${tagName}':`, error);
		return json({ message: 'Failed to fetch notes by tag due to a server error.' }, { status: 500 });
	}
};
