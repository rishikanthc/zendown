import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export interface NoteData {
	id: string;
	title: string;
	content: string;
	created_on: string;
	modified_on: string;
	tags: string | null;
	canonical_path: string;
}

export interface PageData {
	note: NoteData;
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const slug = params.slug;

	if (!slug) {
		throw error(400, 'Note slug is required.');
	}

	try {
		const response = await fetch(`/api/notes/${slug}`);

		if (!response.ok) {
			if (response.status === 404) {
				throw error(404, `Note with slug '${slug}' not found.`);
			}
			const errorData = await response.json().catch(() => ({ message: 'Failed to fetch note data' }));
			throw error(response.status, errorData.message || `Request failed: ${response.statusText}`);
		}

		const note: NoteData = await response.json();
		return {
			note
		};
	} catch (e: any) {
		if (e.status) {
			throw e;
		}
		console.error(`Failed to load note with slug '${slug}':`, e);
		throw error(500, e.message || 'An unexpected error occurred while fetching the note.');
	}
};