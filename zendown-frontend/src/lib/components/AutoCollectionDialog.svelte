<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/sheet/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
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
	<Dialog.Content class="sm:max-w-md bg-white z-[100] p-6">
		<Dialog.Header class="mb-6">
			<Dialog.Title class="text-xl font-semibold text-gray-900 mb-2">Create Auto-Collection</Dialog.Title>
			<Dialog.Description class="text-sm text-gray-600 leading-relaxed">
				Create a collection that automatically groups notes based on semantic similarity.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6">
			<div class="space-y-2">
				<label for="title" class="text-sm font-medium text-gray-700">Collection Name</label>
				<Input
					id="title"
					bind:value={title}
					placeholder="Enter collection name..."
					onkeydown={handleKeydown}
					disabled={isLoading}
					class="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10"
				/>
			</div>

			<div class="space-y-2">
				<label for="description" class="text-sm font-medium text-gray-700">Description</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Describe what kind of notes should be included in this collection..."
					class="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 bg-white rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm"
					onkeydown={handleKeydown}
					disabled={isLoading}
				/>
			</div>

			<div class="space-y-3">
				<label for="threshold" class="text-sm font-medium text-gray-700">
					Similarity Threshold: <span class="text-blue-600 font-semibold">{Math.round(threshold * 100)}%</span>
				</label>
				<div class="space-y-3">
					<div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
						<Slider
							type="single"
							min={0}
							max={1}
							step={0.05}
							bind:value={threshold}
							disabled={isLoading}
							class="w-full [&_[data-slot=slider-track]]:bg-gray-300 [&_[data-slot=slider-range]]:bg-blue-600 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:border-blue-600 [&_[data-slot=slider-thumb]]:shadow-lg [&_[data-slot=slider-thumb]]:hover:scale-110 [&_[data-slot=slider-thumb]]:transition-transform"
						/>
					</div>
					<div class="flex justify-between text-xs text-gray-500 px-1">
						<span class="flex items-center gap-1">
							<div class="w-2 h-2 bg-gray-400 rounded-full"></div>
							0% (More inclusive)
						</span>
						<span class="flex items-center gap-1">
							100% (More strict)
							<div class="w-2 h-2 bg-blue-600 rounded-full"></div>
						</span>
					</div>
				</div>
			</div>
		</div>

		<Dialog.Footer class="flex gap-3 pt-4 border-t border-gray-200">
			<Button variant="outline" onclick={handleClose} disabled={isLoading} class="flex-1 h-10">
				Cancel
			</Button>
			<Button onclick={handleSubmit} disabled={isLoading} class="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
				{isLoading ? 'Creating...' : 'Create Collection'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

 