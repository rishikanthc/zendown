import { error, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import * as auth from '$lib/server/auth';

// This is the list of origins that are allowed to make cross-site requests.
// It's configured in your .env file (e.g., SITE_ADDRESS=http://localhost:5173,https://your-frontend.com)
const allowedOrigins =
	env.SITE_ADDRESS?.split(',')
		.map((s) => s.trim())
		.filter(Boolean) ?? [];

/**
 * A hook to apply security-related headers and checks, including CSRF protection and CORS.
 * This runs for every request to your server.
 */
const securityHandle: Handle = async ({ event, resolve }) => {
	const requestOrigin = event.request.headers.get('origin');
	const siteOrigin = event.url.origin;

	// --- CSRF Protection for form submissions ---
	// Since we disabled SvelteKit's default `checkOrigin` in `svelte.config.js`,
	// we need to perform the check ourselves. This is crucial for any request
	// that could change state on the server (`POST`, `PUT`, etc.).
	if (
		event.request.method === 'POST' ||
		event.request.method === 'PUT' ||
		event.request.method === 'PATCH' ||
		event.request.method === 'DELETE'
	) {
		// A request is considered safe if:
		// 1. It doesn't have an Origin header. This is typical for same-origin requests
		//    in older browsers and for server-to-server requests.
		// 2. The Origin header matches the site's own origin.
		// 3. The Origin header is in our explicit list of allowed origins.
		const isSafe =
			!requestOrigin || requestOrigin === siteOrigin || allowedOrigins.includes(requestOrigin);

		if (!isSafe) {
			// If the origin is not allowed, we block the request immediately.
			throw error(403, `Forbidden: Cross-site request from ${requestOrigin} is not allowed.`);
		}
	}

	// --- CORS Handling ---
	// Part 1: Handle Preflight (OPTIONS) requests
	// The browser sends an OPTIONS request before the actual cross-origin request
	// to check if the server understands the method and headers.
	if (event.request.method === 'OPTIONS') {
		// We only need to handle OPTIONS for cross-origin requests from allowed domains.
		if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
					'Access-Control-Allow-Origin': requestOrigin,
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Allow-Credentials': 'true'
				}
			});
		}
		// For any other OPTIONS request, we can just return a simple forbidden response.
		return new Response('Forbidden', { status: 403 });
	}

	// Part 2: Handle the actual request (GET, POST, etc.)
	// We let SvelteKit handle the request first...
	const response = await resolve(event);

	// ...and then add CORS headers to the response if it's from an allowed cross-origin domain.
	// This tells the browser that it's safe to read the response.
	if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
		response.headers.set('Access-Control-Allow-Origin', requestOrigin);
		response.headers.set('Access-Control-Allow-Credentials', 'true');
	}

	return response;
};

/**
 * A hook to handle user session management.
 * It validates the session cookie and sets `event.locals.user` and `event.locals.session`.
 */
const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);

	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;
	return resolve(event);
};

// The hooks are executed in the order they are passed to `sequence`.
// `securityHandle` runs first, performing crucial security checks,
// followed by `handleAuth` for session management.
export const handle: Handle = sequence(securityHandle, handleAuth);
