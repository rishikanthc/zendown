import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const identifier = params.id; // This 'id' from the path can be a note ID or a canonical_path

	if (!identifier || identifier.trim() === '') {
		return json(
			{ message: 'Note identifier (ID or canonical path) is required.' },
			{ status: 400 }
		);
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

export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check if the user is authenticated
	if (!locals.user) {
		return json(
			{ message: 'Unauthorized. You must be logged in to delete a note.' },
			{ status: 401 }
		);
	}

	const noteId = params.id;

	if (!noteId || noteId.trim() === '') {
		return json({ message: 'Note ID is required.' }, { status: 400 });
	}

	try {
		// Attempt to delete the note and get the deleted record's ID
		const deletedNotes = await db
			.delete(schema.note)
			.where(eq(schema.note.id, noteId))
			.returning({ deletedId: schema.note.id });

		if (deletedNotes.length > 0 && deletedNotes[0].deletedId) {
			return json(
				{ id: deletedNotes[0].deletedId, message: 'Note deleted successfully.' },
				{ status: 200 }
			);
		} else {
			// If no rows were affected, the note was not found
			return json({ message: `Note with ID '${noteId}' not found.` }, { status: 404 });
		}
	} catch (error) {
		console.error(`Error deleting note with ID '${noteId}':`, error);
		return json({ message: 'Failed to delete note due to a server error.' }, { status: 500 });
	}
};
