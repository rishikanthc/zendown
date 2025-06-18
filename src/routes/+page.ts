import type { PageLoad } from './$types';

export interface NoteTitle {
	id: string;
	title: string;
	canonical_path: string;
	created_on: string;
	modified_on: string;
}

export interface PageData {
	notes: NoteTitle[];
	error?: string;
}

export const load: PageLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/notes/titles');
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ message: 'Failed to fetch note titles' }));
			return {
				notes: [],
				error: errorData.message || `Request failed - Status: ${response.statusText}`
			};
		}
		const notes: NoteTitle[] = await response.json();
		return {
			notes
		};
	} catch (error: any) {
		console.error('Failed to load note titles:', error);
		return {
			notes: [],
			error: error.message || 'An unexpected error occurred while fetching note titles.'
		};
	}
};