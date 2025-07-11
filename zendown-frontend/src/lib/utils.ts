import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Calculate word count from HTML content
 * Strips HTML tags and counts words
 */
export function getWordCount(htmlContent: string): number {
	if (!htmlContent || htmlContent.trim() === '') {
		return 0;
	}
	
	// Create a temporary DOM element to parse HTML
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = htmlContent;
	
	// Get text content (strips HTML tags)
	const textContent = tempDiv.textContent || tempDiv.innerText || '';
	
	// Split by whitespace and filter out empty strings
	const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
	
	return words.length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
