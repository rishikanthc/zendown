import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { AI_SERVER_URL } from '$env/static/private';

interface AISimilarityResult {
	id: string;
	score: number;
}

interface AIServerSearchResponse {
	query_id: string;
	similar_results: AISimilarityResult[]; // Assuming this structure based on the requirement to return scores
	count: number;
}

interface NoteDetails {
	id: string;
	title: string;
	canonical_path: string;
}

interface RelatedNote extends NoteDetails {
	score: number;
}

export const GET: RequestHandler = async (event) => {
	const documentId = event.url.searchParams.get('id');

	if (!documentId || documentId.trim() === '') {
		return json({ message: 'Query parameter "id" is required.' }, { status: 400 });
	}

	// Step 1: Call the AI server to get related document IDs and scores
	let aiResponseData: AIServerSearchResponse;
	try {
		const aiSearchPayload = {
			id: documentId,
			thresh: 0.3, // Default threshold
			limit: 10 // Default limit, can be made configurable via query params if needed
		};

		const aiSearchEndpoint = AI_SERVER_URL + '/api/search/similar/';
		const aiResponse = await fetch(aiSearchEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(aiSearchPayload)
		});

		if (!aiResponse.ok) {
			const errorText = await aiResponse.text();
			console.error(
				`AI Server /api/search/similar/ Error for ID ${documentId}: ${aiResponse.status} - ${errorText}`
			);
			return json(
				{
					message: `Failed to fetch related documents from AI server. Status: ${aiResponse.status}`
				},
				{ status: aiResponse.status === 404 ? 404 : 502 } // 502 Bad Gateway if AI server error
			);
		}
		aiResponseData = (await aiResponse.json()) as AIServerSearchResponse;

		// Validate the structure of aiResponseData, especially similar_results
		if (!aiResponseData || !Array.isArray(aiResponseData.similar_results)) {
			console.error(
				`AI Server /api/search/similar/ returned unexpected data structure for ID ${documentId}:`,
				aiResponseData
			);
			return json(
				{ message: 'Received unexpected data format from AI server for similar documents.' },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error(`Error calling AI server /api/search/similar/ for ID ${documentId}:`, error);
		return json(
			{ message: 'Failed to connect to AI server for fetching related documents.' },
			{ status: 503 }
		); // 503 Service Unavailable
	}

	const similarResults = aiResponseData.similar_results;

	if (similarResults.length === 0) {
		return json([], { status: 200 }); // No related documents found
	}

	const relatedIds = similarResults.map((result) => result.id);
	const scoresMap = new Map(similarResults.map((result) => [result.id, result.score]));

	// Step 2: Call the bulk-lookup endpoint to get titles and canonical paths
	let noteDetailsList: NoteDetails[];
	try {
		// Use event.fetch for internal API calls
		const bulkLookupResponse = await event.fetch('/api/notes/bulk-lookup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ ids: relatedIds })
		});

		if (!bulkLookupResponse.ok) {
			const errorText = await bulkLookupResponse.text();
			console.error(
				`Internal /api/notes/bulk-lookup Error: ${bulkLookupResponse.status} - ${errorText}`
			);
			return json(
				{ message: 'Failed to fetch note details for related documents.' },
				{ status: 500 }
			);
		}
		noteDetailsList = (await bulkLookupResponse.json()) as NoteDetails[];
	} catch (error) {
		console.error('Error calling internal /api/notes/bulk-lookup:', error);
		return json(
			{ message: 'Failed to fetch note details due to an internal error.' },
			{ status: 500 }
		);
	}

	// Step 3: Combine the information and sort
	const relatedNotes: RelatedNote[] = noteDetailsList
		.map((note) => {
			const score = scoresMap.get(note.id);
			if (score === undefined) {
				// This case should ideally not happen if AI server and DB are in sync
				// and AI only returns IDs that exist.
				// However, if it does, we might choose to exclude it or log it.
				console.warn(`Score not found for ID ${note.id} from AI server results.`);
				return null;
			}
			return {
				id: note.id,
				title: note.title,
				canonical_path: note.canonical_path,
				score: score
			};
		})
		.filter((note): note is RelatedNote => note !== null); // Filter out any nulls

	// Sort by score in descending order
	relatedNotes.sort((a, b) => b.score - a.score);

	return json(relatedNotes, { status: 200 });
};
