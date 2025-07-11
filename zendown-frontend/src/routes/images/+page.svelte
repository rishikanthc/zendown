<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Attachment } from '$lib/api';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';

	let attachments: Attachment[] = $state([]);
	let isLoading = $state(false);
	let error = $state('');



	let selectedImage: Attachment | null = $state(null);
	let isImageModalOpen = $state(false);
	let deletingAttachmentId: number | null = $state(null);

	// Load all attachments
	async function loadAttachments() {
		try {
			isLoading = true;
			attachments = await api.getAllAttachments();
		} catch (err) {
			error = `Failed to load images: ${err}`;
		} finally {
			isLoading = false;
		}
	}



	// Delete attachment
	async function deleteAttachment(attachment: Attachment, event: Event) {
		event.stopPropagation(); // Prevent opening the modal
		
		try {
			deletingAttachmentId = attachment.id;
			await api.deleteAttachment(attachment.id);
			
			// Remove from local state
			attachments = attachments.filter(a => a.id !== attachment.id);
			
			// Close modal if the deleted image was open
			if (selectedImage?.id === attachment.id) {
				closeImageModal();
			}
			
			toast.success('Image deleted successfully');
		} catch (err) {
			toast.error(`Failed to delete image: ${err}`);
		} finally {
			deletingAttachmentId = null;
		}
	}

	// Copy markdown syntax to clipboard
	async function copyMarkdownSyntax(attachment: Attachment, event: Event) {
		event.stopPropagation(); // Prevent opening the modal
		
		const markdownSyntax = `![](${attachment.url})`;
		
		try {
			await navigator.clipboard.writeText(markdownSyntax);
			toast.success('Markdown syntax copied to clipboard');
		} catch (err) {
			toast.error('Failed to copy to clipboard');
		}
	}

	// Open image in modal
	function openImage(image: Attachment) {
		selectedImage = image;
		isImageModalOpen = true;
	}

	// Close image modal
	function closeImageModal() {
		isImageModalOpen = false;
		selectedImage = null;
	}

	// Format file size
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Format date
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(() => {
		loadAttachments();
	});
</script>

<Sidebar.Provider>
	<!-- Sidebar -->
	<Sidebar.Root class="border-none bg-neutral-50">
		<Sidebar.Header class="px-6 py-4">
			<div class="flex items-center gap-2">
				<div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
					<span class="text-primary-foreground font-semibold text-sm">Z</span>
				</div>
				<h1 class="text-lg font-semibold text-foreground">Zendown</h1>
			</div>
		</Sidebar.Header>
		
		<Sidebar.Content>
			<Sidebar.Group>
							<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<a href="/" class="w-full">
							<Sidebar.MenuButton>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
								</svg>
								<span>Notes</span>
							</Sidebar.MenuButton>
						</a>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<a href="/images" class="w-full">
							<Sidebar.MenuButton isActive={true}>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
								</svg>
								<span>Images</span>
							</Sidebar.MenuButton>
						</a>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
	</Sidebar.Root>

	<!-- Main content -->
	<main class="flex-1 flex flex-col min-h-screen">
		<!-- Header -->
		<header class="px-6 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<Sidebar.Trigger />
					<div class="flex items-center gap-3">
						<div>
							<h2 class="text-lg font-semibold text-foreground">Images</h2>
							<p class="text-sm text-muted-foreground">
								{attachments.length} image{attachments.length !== 1 ? 's' : ''} uploaded
							</p>
						</div>
					</div>
				</div>
				
				<div class="flex items-center gap-2">
					<Button 
						variant="outline" 
						size="sm"
						onclick={loadAttachments}
						disabled={isLoading}
					>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
						</svg>
						Refresh
					</Button>
				</div>
			</div>
		</header>

		<!-- Error banner -->
		{#if error}
			<div class="bg-destructive/10 border-b border-destructive/20 px-6 py-3">
				<div class="flex items-center justify-between">
					<p class="text-sm text-destructive">{error}</p>
					<Button 
						variant="ghost" 
						size="sm" 
						onclick={() => error = ''}
						class="text-destructive hover:text-destructive"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</Button>
				</div>
			</div>
		{/if}

		<!-- Content -->
		<div class="flex-1 p-6">
			{#if isLoading}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
					{#each Array(12) as _}
						<div class="aspect-square">
							<Skeleton class="w-full h-full rounded-lg" />
						</div>
					{/each}
				</div>
			{:else if attachments.length === 0}
				<div class="flex flex-col items-center justify-center h-64 text-center">
					<svg class="w-16 h-16 text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
					</svg>
					<h3 class="text-lg font-semibold text-foreground mb-2">No images yet</h3>
					<p class="text-muted-foreground mb-4">Upload images in your notes to see them here</p>
					<a href="/">
						<Button variant="outline">
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
							</svg>
							Go to Notes
						</Button>
					</a>
				</div>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
					{#each attachments as attachment}
						<div class="group cursor-pointer" onclick={() => openImage(attachment)}>
							<div class="relative aspect-square overflow-hidden rounded-lg bg-muted">
								<img 
									src={attachment.url} 
									alt={attachment.original_name}
									class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
									loading="lazy"
								/>
								<div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200"></div>
								
								<!-- Action buttons - revealed on hover -->
								<div class="absolute top-2 right-2 flex gap-1">
									<!-- Copy button -->
									<button
										onclick={(e) => copyMarkdownSyntax(attachment, e)}
										class="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:shadow-xl"
										title="Copy markdown syntax"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
										</svg>
									</button>
									
									<!-- Delete button -->
									<button
										onclick={(e) => deleteAttachment(attachment, e)}
										disabled={deletingAttachmentId === attachment.id}
										class="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
										title="Delete image"
									>
										{#if deletingAttachmentId === attachment.id}
											<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
											</svg>
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
											</svg>
										{/if}
									</button>
								</div>
							</div>
							<div class="mt-2 px-1">
								<h3 class="font-medium text-xs text-foreground truncate" title={attachment.original_name}>
									{attachment.original_name}
								</h3>
								<div class="flex items-center justify-between text-xs text-muted-foreground mt-1">
									<span>{formatFileSize(attachment.size)}</span>
									<span>{formatDate(attachment.created_at)}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</Sidebar.Provider>

<!-- Image Modal Overlay -->
{#if isImageModalOpen && selectedImage}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onclick={closeImageModal}>
		<div class="relative max-w-4xl max-h-[90vh] mx-4" onclick={(e) => e.stopPropagation()}>
			<!-- Close button -->
			<button 
				onclick={closeImageModal}
				class="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</button>
			
			<!-- Image container -->
			<div class="bg-white rounded-lg shadow-2xl overflow-hidden">
				<!-- Image -->
				<div class="relative flex items-center justify-center bg-gray-50">
					<img 
						src={selectedImage.url} 
						alt={selectedImage.original_name}
						class="max-w-full max-h-[70vh] object-contain"
					/>
				</div>
				
				<!-- Image info -->
				<div class="p-4 bg-white">
					<h3 class="font-semibold text-lg text-foreground mb-2">{selectedImage.original_name}</h3>
					<div class="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
						<div>
							<span class="font-medium">Size:</span>
							<br>
							{formatFileSize(selectedImage.size)}
						</div>
						<div>
							<span class="font-medium">Type:</span>
							<br>
							{selectedImage.mime_type}
						</div>
						<div>
							<span class="font-medium">Uploaded:</span>
							<br>
							{formatDate(selectedImage.created_at)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if} 