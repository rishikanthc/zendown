import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import { slugify } from '$lib/server/utils';

export const GET: RequestHandler = async ({ url }) => {
	const title = url.searchParams.get('title');
	const canonicalPathQuery = url.searchParams.get('canonical_path');

	if (!title && !canonicalPathQuery) {
		return json(
			{ message: 'Please provide either a "title" or "canonical_path" query parameter.' },
			{ status: 400 }
		);
	}

	let pathToCheck: string | undefined;

	if (canonicalPathQuery) {
		pathToCheck = canonicalPathQuery.trim();
	} else if (title) {
		pathToCheck = slugify(title.trim());
	}

	if (!pathToCheck || pathToCheck === '') {
		return json(
			{
				message:
					'The provided title or canonical_path resulted in an empty string to check. Please provide a valid identifier.'
			},
			{ status: 400 }
		);
	}

	try {
		const [note] = await db
			.select({ id: schema.note.id })
			.from(schema.note)
			.where(eq(schema.note.canonical_path, pathToCheck))
			.limit(1);

		if (note) {
			return json({ exists: true, canonical_path: pathToCheck, id: note.id }, { status: 200 });
		} else {
			return json({ exists: false, canonical_path: pathToCheck }, { status: 200 });
		}
	} catch (error) {
		console.error('Error checking if note exists:', error);
		return json({ message: 'Failed to check if note exists due to a server error.' }, { status: 500 });
	}
};