import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const identifier = params.id; // This 'id' from the path can be a note ID or a canonical_path

	if (!identifier || identifier.trim() === '') {
		return json({ message: 'Note identifier (ID or canonical path) is required.' }, { status: 400 });
	}

	try {
		const [note] = await db
			.select()
			.from(schema.note)
			.where(or(eq(schema.note.id, identifier), eq(schema.note.canonical_path, identifier)))
			.limit(1);

		if (note) {
			return json(note, { status: 200 });
		} else {
			return json({ message: `Note with identifier '${identifier}' not found.` }, { status: 404 });
		}
	} catch (error) {
		console.error(`Error fetching note with identifier '${identifier}':`, error);
		return json({ message: 'Failed to fetch note due to a server error.' }, { status: 500 });
	}
};