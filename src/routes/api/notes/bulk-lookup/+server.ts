import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	let requestData;
	try {
		requestData = await request.json();
	} catch (error) {
		return json({ message: 'Invalid JSON body.' }, { status: 400 });
	}

	const { ids } = requestData;

	if (!ids || !Array.isArray(ids)) {
		return json({ message: 'An array of "ids" is required in the request body.' }, { status: 400 });
	}

	if (ids.length === 0) {
		return json({ message: 'The "ids" array cannot be empty.' }, { status: 400 });
	}

	// Ensure all IDs are strings, as they are in the database schema
	if (!ids.every((id) => typeof id === 'string')) {
		return json({ message: 'All IDs in the "ids" array must be strings.' }, { status: 400 });
	}

	try {
		const notes = await db
			.select({
				id: schema.note.id,
				title: schema.note.title,
				canonical_path: schema.note.canonical_path
			})
			.from(schema.note)
			.where(inArray(schema.note.id, ids as string[])); // Cast to string[] after validation

		// It's possible that some requested IDs were not found.
		// The current behavior is to return only the found notes.
		// If you need to indicate which IDs were not found, further logic would be needed.
		return json(notes, { status: 200 });
	} catch (error) {
		console.error('Error fetching notes by IDs:', error);
		return json({ message: 'Failed to fetch notes due to a server error.' }, { status: 500 });
	}
};
