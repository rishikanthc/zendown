import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import {
	slugify,
	extractTitleFromMarkdownServer
} from '$lib/server/utils';
import { AI_SERVER_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	let requestData;
	try {
		requestData = await request.json();
	} catch (error) {
		return json({ message: 'Invalid JSON body.' }, { status: 400 });
	}

	const { id: noteId, content, tags: rawTags } = requestData;

	if (!noteId || typeof noteId !== 'string') {
		return json({ message: 'Note ID is required and must be a string.' }, { status: 400 });
	}
	if (typeof content !== 'string') {
		return json({ message: 'Content is required and must be a string.' }, { status: 400 });
	}

	const newTitle = extractTitleFromMarkdownServer(content);

	if (!newTitle) {
		return json(
			{
				message:
					'Failed to extract title from content. A title (H1 heading, e.g., "# Your Title") is required within the content.'
			},
			{ status: 400 }
		);
	}
	const newTrimmedTitle = newTitle.trim();
	const newCanonicalPath = slugify(newTrimmedTitle);

	if (newCanonicalPath === '') {
		return json(
			{
				message:
					'The new title must produce a valid canonical path (e.g., ensure it contains alphanumeric characters).'
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
		// Fetch the existing note
		const [existingNote] = await db
			.select()
			.from(schema.note)
			.where(eq(schema.note.id, noteId))
			.limit(1);

		if (!existingNote) {
			return json({ message: `Note with ID '${noteId}' not found.` }, { status: 404 });
		}

		const updatePayload: Partial<typeof schema.note.$inferInsert> = {
			content,
			modified_on: now,
			tags: tagsValue
		};

		// Check if the title or canonical path needs to be updated
		if (newTrimmedTitle !== existingNote.title || newCanonicalPath !== existingNote.canonical_path) {
			updatePayload.title = newTrimmedTitle; // Always update title if it's different (even if only casing)

			if (newCanonicalPath !== existingNote.canonical_path) {
				// Canonical path is changing, check for conflicts with OTHER notes
				const [conflictingNote] = await db
					.select({ id: schema.note.id })
					.from(schema.note)
					.where(
						and(
							eq(schema.note.canonical_path, newCanonicalPath),
							ne(schema.note.id, noteId) // Important: exclude the current note from conflict check
						)
					)
					.limit(1);

				if (conflictingNote) {
					return json(
						{
							message: `A different note with the title '${newTrimmedTitle}' (resulting in path '${newCanonicalPath}') already exists. Please choose a different title.`
						},
						{ status: 409 } // Conflict
					);
				}
				updatePayload.canonical_path = newCanonicalPath;
			}
		}


		const [updatedResult] = await db
			.update(schema.note)
			.set(updatePayload)
			.where(eq(schema.note.id, noteId))
			.returning();

		if (!updatedResult) {
			// This might happen if the note was deleted between the select and update
			return json(
				{ message: `Failed to update note with ID '${noteId}'. It might have been deleted.` },
				{ status: 404 }
			);
		}

		// Attempt to upsert the document to the AI vector server
		if (updatedResult && updatedResult.id && typeof updatedResult.content === 'string') {
			try {
				const aiUpsertPayload = {
					id: updatedResult.id,
					content: updatedResult.content
				};
				const aiUpsertEndpoint = AI_SERVER_URL + '/api/upsert/';

				// console.log(`Attempting to upsert updated note to AI: ${JSON.stringify(aiUpsertPayload)} at ${aiUpsertEndpoint}`);

				const aiResponse = await fetch(aiUpsertEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(aiUpsertPayload)
				});

				if (!aiResponse.ok) {
					// Log error from AI server but don't fail the main operation
					const errorText = await aiResponse.text();
					console.error(
						`AI Server Upsert Error for updated note ${updatedResult.id}: ${aiResponse.status} - ${errorText}`
					);
				} else {
					// const responseData = await aiResponse.json();
					console.log(
						`Successfully upserted updated note ${updatedResult.id} to AI server.`
					);
				}
			} catch (aiError) {
				// Log network or other errors calling AI server but don't fail the main operation
				console.error(
					`Failed to call AI server for upserting updated note ${updatedResult.id}:`,
					aiError
				);
			}
		} else {
			console.warn(`Could not upsert updated note to AI server: updatedResult or its properties (id, content) are missing or invalid. ID: ${updatedResult?.id}`);
		}

		return json(updatedResult, { status: 200 });

	} catch (error: any) {
		console.error(`Error updating note with ID '${noteId}':`, error);
		// Check for unique constraint violation on canonical_path if the explicit check somehow missed it
		// (e.g. race condition if the conflict check logic has a flaw, though it should be robust)
		if (
			error.message &&
			error.message.toLowerCase().includes('unique constraint failed') &&
			error.message.includes('note.canonical_path')
		) {
			return json(
				{
					message: `Updating this note would create a title conflict (path: '${newCanonicalPath}'). Another note with a similar title already exists.`
				},
				{ status: 409 } // Conflict
			);
		}
		return json({ message: 'An unexpected error occurred on the server while updating the note.' }, { status: 500 });
	}
};