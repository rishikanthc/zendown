import { PUBLIC_SITE_TITLE } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// The `user` and `session` objects are attached to `locals` by the `handleAuth` hook in `src/hooks.server.ts`.
	// By returning them here, they become available to all pages through the `$page.data` store.
	return {
		user: locals.user,
		siteTitle: PUBLIC_SITE_TITLE || 'ZenDown'
	};
};
