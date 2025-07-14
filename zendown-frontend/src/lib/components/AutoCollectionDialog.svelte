<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/sheet/index.js';
	import { createEventDispatcher } from 'svelte';
	import { api, type CreateAutoCollectionRequest } from '$lib/api';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		created: { collectionName: string };
	}>();

	let title = $state('');
	let description = $state('');
	let threshold = $state(0.3);
	let isLoading = $state(false);

	function handleSubmit() {
		if (!title.trim() || !description.trim()) {
			toast.error('Please fill in all fields');
			return;
		}

		isLoading = true;

		const request: CreateAutoCollectionRequest = {
			collection_name: title.trim(),
			description: description.trim(),
			threshold: threshold
		};

		api.createAutoCollection(request)
			.then(() => {
				toast.success(`Auto-collection "${title}" created successfully`);
				dispatch('created', { collectionName: title.trim() });
				handleClose();
			})
			.catch((error) => {
				console.error('Failed to create auto-collection:', error);
				toast.error(`Failed to create auto-collection: ${error.message}`);
			})
			.finally(() => {
				isLoading = false;
			});
	}

	function handleClose() {
		title = '';
		description = '';
		threshold = 0.3;
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			handleSubmit();
		} else if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create Auto-Collection</Dialog.Title>
			<Dialog.Description>
				Create a collection that automatically groups notes based on semantic similarity.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<label for="title" class="text-sm font-medium">Collection Name</label>
				<Input
					id="title"
					bind:value={title}
					placeholder="Enter collection name..."
					onkeydown={handleKeydown}
					disabled={isLoading}
				/>
			</div>

			<div class="space-y-2">
				<label for="description" class="text-sm font-medium">Description</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Describe what kind of notes should be included in this collection..."
					class="w-full min-h-[100px] px-3 py-2 text-sm border border-input bg-background rounded-md ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
					onkeydown={handleKeydown}
					disabled={isLoading}
				/>
			</div>

			<div class="space-y-2">
				<label for="threshold" class="text-sm font-medium">
					Similarity Threshold: {Math.round(threshold * 100)}%
				</label>
				<div class="space-y-2">
					<input
						id="threshold"
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={threshold}
						class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
						disabled={isLoading}
					/>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>0% (More inclusive)</span>
						<span>100% (More strict)</span>
					</div>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleClose} disabled={isLoading}>
				Cancel
			</Button>
			<Button onclick={handleSubmit} disabled={isLoading}>
				{isLoading ? 'Creating...' : 'Create Collection'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.slider::-webkit-slider-thumb {
		appearance: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: hsl(var(--primary));
		cursor: pointer;
	}

	.slider::-moz-range-thumb {
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: hsl(var(--primary));
		cursor: pointer;
		border: none;
	}
</style> 