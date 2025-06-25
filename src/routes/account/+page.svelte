<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { User, LogOut } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
	<div
		class="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex flex-col items-center">
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50"
			>
				<User class="h-8 w-8 text-blue-600 dark:text-blue-400" />
			</div>
			<h1 class="text-2xl font-semibold text-gray-800 dark:text-gray-100">
				Hello, {data.user.username}!
			</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Your User ID is: <span class="font-mono">{data.user.id}</span>
			</p>
			<p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
				You are currently logged in as the administrator.
			</p>
		</div>

		<div class="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
			<form method="post" action="?/logout" use:enhance>
				<Button type="submit" variant="destructive" class="w-full">
					<LogOut class="mr-2 h-4 w-4" />
					Sign out
				</Button>
			</form>
		</div>

		<div class="mt-6 text-center">
			<a href="/" class="text-sm text-blue-600 hover:underline dark:text-blue-400"
				>&larr; Back to notes</a
			>
		</div>
	</div>
</div>
