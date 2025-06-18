import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const GET: RequestHandler = async () => {
	try {
		const notes = await db
			.select({
				id: schema.note.id,
				title: schema.note.title,
				canonical_path: schema.note.canonical_path,
				created_on: schema.note.created_on,
				modified_on: schema.note.modified_on
			})
			.from(schema.note)
			.orderBy(schema.note.modified_on); // Or schema.note.title, or schema.note.created_on

		return json(notes, { status: 200 });
	} catch (error) {
		console.error('Error fetching note titles:', error);
		return json({ message: 'Failed to fetch note titles due to a server error.' }, { status: 500 });
	}
};