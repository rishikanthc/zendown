export interface Note {
	id: number;
	title: string;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface CreateNoteRequest {
	title: string;
	content: string;
}

export interface UpdateNoteRequest {
	title: string;
	content: string;
}

export interface Attachment {
	id: number;
	filename: string;
	original_name: string;
	mime_type: string;
	size: number;
	path: string;
	url: string;
	created_at: string;
}

export interface RelatedNoteResponse {
	note: Note;
	score: number;
}

export interface SemanticSearchResponse {
	note: Note;
	score: number;
}

export interface FullTextSearchResponse {
	note: Note;
	score: number;
}

export interface Collection {
	id: number;
	name: string;
	created_at: string;
	is_auto?: boolean;
	description?: string;
	threshold?: number;
}

export interface AddCollectionRequest {
	collection_name: string;
}

export interface RemoveCollectionRequest {
	collection_name: string;
}

export interface CreateAutoCollectionRequest {
	collection_name: string;
	description: string;
	threshold: number;
}

class API {
	private baseURL = '/api';

	async createNote(note: CreateNoteRequest): Promise<Note> {
		const response = await fetch(`${this.baseURL}/notes`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(note),
		});

		if (!response.ok) {
			throw new Error(`Failed to create note: ${response.statusText}`);
		}

		return response.json();
	}

	async getNote(id: number): Promise<Note> {
		const response = await fetch(`${this.baseURL}/notes/${id}`);

		if (!response.ok) {
			throw new Error(`Failed to get note: ${response.statusText}`);
		}

		return response.json();
	}

	async getAllNotes(): Promise<Note[]> {
		const response = await fetch(`${this.baseURL}/notes`);

		if (!response.ok) {
			throw new Error(`Failed to get notes: ${response.statusText}`);
		}

		return response.json();
	}

	async updateNote(id: number, note: UpdateNoteRequest): Promise<Note> {
		const response = await fetch(`${this.baseURL}/notes/${id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(note),
		});

		if (!response.ok) {
			throw new Error(`Failed to update note: ${response.statusText}`);
		}

		return response.json();
	}

	async deleteNote(id: number): Promise<void> {
		const response = await fetch(`${this.baseURL}/notes/${id}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			throw new Error(`Failed to delete note: ${response.statusText}`);
		}
	}

	async searchNotes(query: string): Promise<Note[]> {
		const response = await fetch(`${this.baseURL}/notes/search?q=${encodeURIComponent(query)}`);

		if (!response.ok) {
			throw new Error(`Failed to search notes: ${response.statusText}`);
		}

		return response.json();
	}

	async getRelatedNotes(noteId: number, threshold: number = 0.3): Promise<RelatedNoteResponse[]> {
		const params = new URLSearchParams({
			threshold: threshold.toString()
		});
		
		const response = await fetch(`${this.baseURL}/notes/${noteId}/related?${params}`);

		if (!response.ok) {
			throw new Error(`Failed to get related notes: ${response.statusText}`);
		}

		return response.json();
	}

	async semanticSearch(query: string, threshold: number = 0.3): Promise<SemanticSearchResponse[]> {
		const params = new URLSearchParams({
			q: query,
			threshold: threshold.toString()
		});
		
		const response = await fetch(`${this.baseURL}/notes/semantic-search?${params}`);

		if (!response.ok) {
			throw new Error(`Failed to perform semantic search: ${response.statusText}`);
		}

		return response.json();
	}

	async fullTextSearch(query: string, limit: number = 20): Promise<FullTextSearchResponse[]> {
		const params = new URLSearchParams({
			q: query,
			limit: limit.toString()
		});
		
		const response = await fetch(`${this.baseURL}/notes/fulltext-search?${params}`);

		if (!response.ok) {
			throw new Error(`Failed to perform full-text search: ${response.statusText}`);
		}

		return response.json();
	}

	async uploadAttachment(file: File): Promise<Attachment> {
		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${this.baseURL}/attachments/upload`, {
			method: 'POST',
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Failed to upload attachment: ${response.statusText}`);
		}

		return response.json();
	}

	async getAllAttachments(): Promise<Attachment[]> {
		const response = await fetch(`${this.baseURL}/attachments/all`);

		if (!response.ok) {
			throw new Error(`Failed to get attachments: ${response.statusText}`);
		}

		return response.json();
	}

	async deleteAttachment(id: number): Promise<void> {
		const response = await fetch(`${this.baseURL}/attachments/${id}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			throw new Error(`Failed to delete attachment: ${response.statusText}`);
		}
	}

	// Collection methods
	async getAllCollections(): Promise<Collection[]> {
		const response = await fetch(`${this.baseURL}/collections`);

		if (!response.ok) {
			throw new Error(`Failed to get collections: ${response.statusText}`);
		}

		return response.json();
	}

	async getNoteCollections(noteId: number): Promise<Collection[]> {
		const response = await fetch(`${this.baseURL}/notes/${noteId}/collections`);

		if (!response.ok) {
			throw new Error(`Failed to get note collections: ${response.statusText}`);
		}

		return response.json();
	}

	async getNotesByCollection(collectionId: number): Promise<Note[]> {
		const response = await fetch(`${this.baseURL}/collections/${collectionId}/notes`);

		if (!response.ok) {
			throw new Error(`Failed to get notes by collection: ${response.statusText}`);
		}

		return response.json();
	}

	async addNoteToCollection(noteId: number, collectionName: string): Promise<Collection> {
		const response = await fetch(`${this.baseURL}/notes/${noteId}/collections`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ collection_name: collectionName }),
		});

		if (!response.ok) {
			throw new Error(`Failed to add note to collection: ${response.statusText}`);
		}

		return response.json();
	}

	async removeNoteFromCollection(noteId: number, collectionName: string): Promise<void> {
		const response = await fetch(`${this.baseURL}/notes/${noteId}/collections`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ collection_name: collectionName }),
		});

		if (!response.ok) {
			throw new Error(`Failed to remove note from collection: ${response.statusText}`);
		}
	}

	async createAutoCollection(request: CreateAutoCollectionRequest): Promise<Collection> {
		const response = await fetch(`${this.baseURL}/collections/auto`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			throw new Error(`Failed to create auto-collection: ${response.statusText}`);
		}

		return response.json();
	}

	async syncAutoCollection(collectionId: number): Promise<void> {
		const response = await fetch(`${this.baseURL}/collections/auto/${collectionId}`, {
			method: 'PUT',
		});

		if (!response.ok) {
			throw new Error(`Failed to sync auto-collection: ${response.statusText}`);
		}
	}

	async exportNoteAsMarkdown(noteId: number): Promise<Blob> {
		const response = await fetch(`${this.baseURL}/notes/${noteId}/export`);

		if (!response.ok) {
			throw new Error(`Failed to export note: ${response.statusText}`);
		}

		return response.blob();
	}

	async exportNoteAsRawHTML(noteId: number): Promise<Blob> {
		const response = await fetch(`${this.baseURL}/notes/${noteId}/export-raw`);

		if (!response.ok) {
			throw new Error(`Failed to export note as raw HTML: ${response.statusText}`);
		}

		return response.blob();
	}

	async exportAllNotesAsZip(): Promise<Blob> {
		const response = await fetch(`${this.baseURL}/notes/export-all`);

		if (!response.ok) {
			throw new Error(`Failed to export all notes: ${response.statusText}`);
		}

		return response.blob();
	}
}

export const api = new API(); 