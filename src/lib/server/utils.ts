import { encodeBase32LowerCase } from '@oslojs/encoding';

/**
 * Generates a unique ID for notes.
 * Uses 120 bits of entropy, encoded in base32 lowercase.
 * @returns {string} A unique note ID.
 */
export function generateNoteId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(15)); // 120 bits of entropy
	return encodeBase32LowerCase(bytes);
}

/**
 * Creates a canonical path (slug) from a given text string.
 * Normalizes characters, converts to lowercase, replaces spaces with hyphens,
 * removes non-word characters (except hyphens), and collapses multiple hyphens.
 * @param {string} text - The input string to slugify.
 * @returns {string} The generated slug.
 */
export function slugify(text: string): string {
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

/**
 * Extracts the title (H1 heading) from a Markdown string.
 * Looks for the first line starting with '# '.
 * @param {string} markdown - The Markdown content.
 * @returns {string | null} The extracted title, or null if no H1 heading is found.
 */
export function extractTitleFromMarkdownServer(markdown: string): string | null {
	if (!markdown) return null;
	// Matches lines starting with '#' followed by a space, capturing the text after.
	// The 'm' flag enables multi-line mode, so '^' matches the start of any line.
	const match = markdown.match(/^(?:#\s+)(.+)$/m);
	if (match && match[1]) {
		return match[1].trim();
	}
	return null;
}
