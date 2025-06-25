<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	let { form }: { form: ActionData } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
	<div class="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
		<h1 class="mb-6 text-center font-[Megrim] text-3xl text-blue-600 dark:text-blue-400">
			ZenDown
		</h1>
		<h2 class="mb-6 text-center text-xl font-semibold text-gray-700 dark:text-gray-200">
			Admin Login
		</h2>
		<form method="post" action="?/login" use:enhance class="space-y-6">
			<div>
				<label for="username" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>Username</label
				>
				<Input
					id="username"
					name="username"
					type="text"
					required
					class="w-full"
					placeholder="Enter your username"
				/>
			</div>
			<div>
				<label for="password" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>Password</label
				>
				<Input
					id="password"
					name="password"
					type="password"
					required
					class="w-full"
					placeholder="Enter your password"
				/>
			</div>
			{#if form?.message}
				<p class="text-sm text-red-600 dark:text-red-400">
					{form.message}
				</p>
			{/if}
			<Button type="submit" class="w-full">Login</Button>
		</form>
	</div>
</div>
