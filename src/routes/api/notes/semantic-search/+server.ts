import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface AISimilarityResult {
	id: string;
	score: number;
}

interface AIServerSearchResponse {
	query_text: string;
	similar_results: AISimilarityResult[];
	count: number;
}

interface NoteDetails {
	id: string;
	title: string;
	canonical_path: string;
}

interface SemanticSearchResult extends NoteDetails {
	score: number;
}

export const POST: RequestHandler = async (event) => {
	let requestBody;
	try {
		requestBody = await event.request.json();
	} catch (error) {
		return json({ message: 'Invalid JSON body.' }, { status: 400 });
	}

	const { query_text, thresh = 0.3, limit = 10 } = requestBody;

	if (!query_text || typeof query_text !== 'string' || query_text.trim() === '') {
		return json(
			{ message: 'query_text is required and must be a non-empty string.' },
			{ status: 400 }
		);
	}
	if (typeof thresh !== 'number' || thresh < 0 || thresh > 1) {
		return json({ message: 'thresh must be a number between 0 and 1.' }, { status: 400 });
	}
	if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
		return json({ message: 'limit must be a positive integer.' }, { status: 400 });
	}

	// Step 1: Call the AI server to get semantically similar document IDs and scores
	let aiResponseData: AIServerSearchResponse;
	try {
		const aiSearchPayload = {
			query_text,
			thresh,
			limit
		};

		const aiSearchEndpoint = env.AI_SERVER_URL + '/api/search/semantic/';
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
				`AI Server /api/search/semantic/ Error for query "${query_text}": ${aiResponse.status} - ${errorText}`
			);
			return json(
				{
					message: `Failed to get semantic search results from AI server. Status: ${aiResponse.status}`
				},
				{ status: aiResponse.status === 404 ? 404 : 502 } // 502 Bad Gateway if AI server error
			);
		}
		aiResponseData = (await aiResponse.json()) as AIServerSearchResponse;

		if (!aiResponseData || !Array.isArray(aiResponseData.similar_results)) {
			console.error(
				`AI Server /api/search/semantic/ returned unexpected data structure for query "${query_text}":`,
				aiResponseData
			);
			return json(
				{ message: 'Received unexpected data format from AI server for semantic search results.' },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error(
			`Error calling AI server /api/search/semantic/ for query "${query_text}":`,
			error
		);
		return json(
			{ message: 'Failed to connect to AI server for semantic search.' },
			{ status: 503 } // 503 Service Unavailable
		);
	}

	const similarResults = aiResponseData.similar_results;

	if (similarResults.length === 0) {
		return json([], { status: 200 }); // No similar documents found
	}

	const relatedIds = similarResults.map((result) => result.id);
	const scoresMap = new Map(similarResults.map((result) => [result.id, result.score]));

	// Step 2: Call the bulk-lookup endpoint to get titles and canonical paths
	let noteDetailsList: NoteDetails[];
	try {
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
				`Internal /api/notes/bulk-lookup Error during semantic search: ${bulkLookupResponse.status} - ${errorText}`
			);
			return json(
				{ message: 'Failed to fetch note details for semantic search results.' },
				{ status: 500 }
			);
		}
		noteDetailsList = (await bulkLookupResponse.json()) as NoteDetails[];
	} catch (error) {
		console.error('Error calling internal /api/notes/bulk-lookup during semantic search:', error);
		return json(
			{ message: 'Failed to fetch note details for semantic search due to an internal error.' },
			{ status: 500 }
		);
	}

	// Step 3: Combine the information and sort
	const searchResults: SemanticSearchResult[] = noteDetailsList
		.map((note) => {
			const score = scoresMap.get(note.id);
			if (score === undefined) {
				console.warn(
					`Score not found for ID ${note.id} from AI server results during semantic search.`
				);
				return null;
			}
			return {
				id: note.id,
				title: note.title,
				canonical_path: note.canonical_path,
				score: score
			};
		})
		.filter((note): note is SemanticSearchResult => note !== null);

	// Sort by score in descending order
	searchResults.sort((a, b) => b.score - a.score);

	return json(searchResults, { status: 200 });
};
