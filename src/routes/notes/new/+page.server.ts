import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If the user is not logged in, redirect them to the login page.
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// If the user is logged in, allow them to access the page.
	return {};
};
