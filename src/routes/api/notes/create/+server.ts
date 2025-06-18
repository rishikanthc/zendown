import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	generateNoteId,
	slugify,
	extractTitleFromMarkdownServer
} from '$lib/server/utils';

export const POST: RequestHandler = async ({ request }) => {
	let requestData;
	try {
		requestData = await request.json();
	} catch (error) {
		return json({ message: 'Invalid JSON body.' }, { status: 400 });
	}

	const { content, tags: rawTags } = requestData;

	if (typeof content !== 'string') {
		return json({ message: 'Content is required and must be a string.' }, { status: 400 });
	}

	const title = extractTitleFromMarkdownServer(content);

	if (!title) {
		return json(
			{
				message:
					'Failed to extract title. A title (H1 heading, e.g., "# Your Title") is required within the content to create the note.'
			},
			{ status: 400 }
		);
	}

	const trimmedTitle = title.trim();
	const canonicalPath = slugify(trimmedTitle);

	if (canonicalPath === '') {
		return json(
			{
				message:
					'Title must produce a valid canonical path (e.g., ensure it contains alphanumeric characters).'
			},
			{ status: 400 }
		);
	}

	// Process tags
	let tagsValue: string | null = null;
	if (typeof rawTags === 'string' && rawTags.trim() !== '') {
		tagsValue = rawTags.trim();
	} else if (Array.isArray(rawTags) && rawTags.length > 0) {
		tagsValue = rawTags
			.filter((tag) => typeof tag === 'string' && tag.trim() !== '')
			.join(',');
		if (tagsValue === '') tagsValue = null;
	}

	const now = new Date();

	try {
		// Check if a note with this canonical_path already exists
		const [existingNoteByPath] = await db
			.select({ id: schema.note.id })
			.from(schema.note)
			.where(eq(schema.note.canonical_path, canonicalPath))
			.limit(1);

		if (existingNoteByPath) {
			return json(
				{
					message: `A note with the title '${trimmedTitle}' (resulting in path '${canonicalPath}') already exists. Please choose a different title.`
				},
				{ status: 409 } // Conflict
			);
		}

		// Create new note
		const newNoteId = generateNoteId();
		const newNoteData: schema.NewNote = {
			id: newNoteId,
			title: trimmedTitle,
			content,
			created_on: now,
			modified_on: now,
			tags: tagsValue,
			canonical_path: canonicalPath
		};

		const [insertedResult] = await db.insert(schema.note).values(newNoteData).returning();

		if (!insertedResult) {
			console.error(
				`Failed to insert new note with title: ${trimmedTitle}. This should not happen if previous checks passed.`
			);
			return json({ message: 'Failed to create new note due to an unexpected server error.' }, { status: 500 });
		}

		return json(insertedResult, { status: 201 });
	} catch (error: any) {
		console.error('Error creating note:', error);
		// Check for specific unique constraint violation on canonical_path if not caught by the explicit check
		// This is a safeguard, the check above should ideally prevent this.
		if (
			error.message &&
			error.message.toLowerCase().includes('unique constraint failed') &&
			error.message.includes('note.canonical_path')
		) {
			return json(
				{
					message: `A note with the canonical path '${canonicalPath}' derived from the title already exists. Titles must be unique enough to produce distinct canonical paths.`
				},
				{ status: 409 } // Conflict
			);
		}
		return json({ message: 'An unexpected error occurred on the server while creating the note.' }, { status: 500 });
	}
};