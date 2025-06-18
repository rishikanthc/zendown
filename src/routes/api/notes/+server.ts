import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { encodeBase32LowerCase } from '@oslojs/encoding';

// Helper to generate a unique ID for notes
function generateNoteId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(15)); // 120 bits of entropy
	return encodeBase32LowerCase(bytes);
}

// Helper function to create a canonical path (slug)
function slugify(text: string): string {
	if (!text) return '';
	return text
		.toString()
		.normalize('NFKD') // Normalize accented characters
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w-]+/g, '') // Remove all non-word chars (except hyphen)
		.replace(/--+/g, '-'); // Replace multiple - with single -
}

export const POST: RequestHandler = async ({ request }) => {
	let requestData;
	try {
		requestData = await request.json();
	} catch (error) {
		return json({ message: 'Invalid JSON body. Please provide valid JSON.' }, { status: 400 });
	}

	const { title, content, tags: rawTags } = requestData;

	if (!title || typeof title !== 'string' || title.trim() === '') {
		return json({ message: 'Title is required and must be a non-empty string.' }, { status: 400 });
	}
	// Content can be an empty string, but must be provided as a string
	if (typeof content !== 'string') {
		return json({ message: 'Content is required and must be a string.' }, { status: 400 });
	}

	// Process tags: store as a comma-separated string or null if not provided/empty array
	let tagsValue: string | null = null;
	if (typeof rawTags === 'string' && rawTags.trim() !== '') {
		tagsValue = rawTags.trim();
	} else if (Array.isArray(rawTags) && rawTags.length > 0) {
		tagsValue = rawTags
			.filter((tag) => typeof tag === 'string' && tag.trim() !== '')
			.join(',');
		if (tagsValue === '') tagsValue = null; // Handle array of empty strings
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

	const now = new Date();

	try {
		const [existingNote] = await db
			.select()
			.from(schema.note)
			.where(eq(schema.note.canonical_path, canonicalPath))
			.limit(1);

		if (existingNote) {
			// Update existing note
			const updatePayload: Partial<schema.Note> = {
				title: trimmedTitle, // Update title to the (potentially new) one from the request
				content,
				modified_on: now,
				tags: tagsValue // Update tags (can be set to null to clear them)
			};

			const [updatedResult] = await db
				.update(schema.note)
				.set(updatePayload)
				.where(eq(schema.note.id, existingNote.id))
				.returning();

			if (!updatedResult) {
				console.error(
					`Failed to update note with id: ${existingNote.id}. The note might have been deleted concurrently.`
				);
				return json(
					{ message: 'Failed to update note. It may have been deleted.' },
					{ status: 404 }
				);
			}
			return json(updatedResult, { status: 200 });
		} else {
			// Create new note
			const newNoteId = generateNoteId();
			const newNoteData: schema.NewNote = {
				id: newNoteId,
				title: trimmedTitle,
				content,
				created_on: now,
				modified_on: now, // For new notes, created_on and modified_on are the same
				tags: tagsValue,
				canonical_path: canonicalPath
			};

			const [insertedResult] = await db.insert(schema.note).values(newNoteData).returning();

			if (!insertedResult) {
				// This implies the insert failed, possibly due to a race condition where
				// another request created a note with the same canonical_path between our SELECT and INSERT.
				// The unique constraint on canonical_path would then cause the INSERT to fail.
				console.error(
					`Failed to insert new note. A note with canonical_path: ${canonicalPath} might have been created concurrently.`
				);
				// We can double-check to provide a more specific error.
				const [conflictNote] = await db
					.select({ id: schema.note.id })
					.from(schema.note)
					.where(eq(schema.note.canonical_path, canonicalPath))
					.limit(1);
				if (conflictNote) {
					return json(
						{
							message: `A note with a similar title (canonical path: ${canonicalPath}) was created concurrently or already exists with a different ID. Please try a different title or refresh.`
						},
						{ status: 409 }
					); // Conflict
				}
				// If still no conflict note, then it's a more generic insert failure.
				return json({ message: 'Failed to create new note due to a server error.' }, { status: 500 });
			}
			return json(insertedResult, { status: 201 });
		}
	} catch (error: any) {
		console.error('Error upserting note:', error);
		// Check for specific unique constraint violation on canonical_path if not caught by the race condition logic
		if (
			error.message &&
			error.message.toLowerCase().includes('unique constraint failed') &&
			error.message.includes('note.canonical_path')
		) {
			return json(
				{
					message: `A note with the canonical path '${canonicalPath}' derived from the title already exists. Titles must be unique enough to produce distinct canonical paths.`
				},
				{ status: 409 }
			); // Conflict
		}
		return json({ message: 'An unexpected error occurred on the server.' }, { status: 500 });
	}
};