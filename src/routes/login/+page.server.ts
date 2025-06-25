import { hash, verify } from '@node-rs/argon2';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '$env/static/private';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (!validateUsername(username)) {
			return fail(400, {
				message: 'Invalid username (min 3, max 31 characters, alphanumeric only)'
			});
		}
		if (!validatePassword(password)) {
			return fail(400, { message: 'Invalid password (min 6, max 255 characters)' });
		}

		// Check if the provided username is the admin username from environment variables
		if (username !== ADMIN_USERNAME) {
			return fail(400, { message: 'Incorrect username or password' });
		}

		try {
			// Find the user in the database
			const [existingUser] = await db
				.select()
				.from(table.user)
				.where(eq(table.user.username, username));

			if (existingUser) {
				// User exists, verify password
				const validPassword = await verify(existingUser.passwordHash, password, {
					memoryCost: 19456,
					timeCost: 2,
					outputLen: 32,
					parallelism: 1
				});
				if (!validPassword) {
					// This case can happen if the admin password in the .env was changed
					// For security, we can either deny access or update the hash.
					// Let's update the hash to reflect the .env file as the source of truth.
					const newPasswordHash = await hash(ADMIN_PASSWORD, {
						memoryCost: 19456,
						timeCost: 2,
						outputLen: 32,
						parallelism: 1
					});
					await db
						.update(table.user)
						.set({ passwordHash: newPasswordHash })
						.where(eq(table.user.id, existingUser.id));

					// Re-verify with the new password from .env
					const validPasswordAfterUpdate = await verify(newPasswordHash, password);
					if (!validPasswordAfterUpdate) {
						return fail(400, { message: 'Incorrect username or password' });
					}
				}

				// Create session for existing user
				const sessionToken = auth.generateSessionToken();
				const session = await auth.createSession(sessionToken, existingUser.id);
				auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			} else {
				// User does not exist, this is the first login. Create the admin user.
				if (password !== ADMIN_PASSWORD) {
					return fail(400, { message: 'Incorrect username or password' });
				}

				const userId = generateUserId();
				const passwordHash = await hash(ADMIN_PASSWORD, {
					memoryCost: 19456,
					timeCost: 2,
					outputLen: 32,
					parallelism: 1
				});

				await db.insert(table.user).values({ id: userId, username, passwordHash });

				// Create session for the new admin user
				const sessionToken = auth.generateSessionToken();
				const session = await auth.createSession(sessionToken, userId);
				auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			}
		} catch (e) {
			console.error(e);
			return fail(500, { message: 'An internal error has occurred' });
		}

		return redirect(302, '/');
	}
};

function generateUserId() {
	// ID with 120 bits of entropy, or about the same as UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}

function validateUsername(username: unknown): username is string {
	return (
		typeof username === 'string' &&
		username.length >= 3 &&
		username.length <= 31 &&
		/^[a-z0-9_-]+$/.test(username)
	);
}

function validatePassword(password: unknown): password is string {
	return typeof password === 'string' && password.length >= 6 && password.length <= 255;
}
