<script lang="ts">
	import TiptapEditor from '$lib/TiptapEditor.svelte';
	
	let content = $state('<h1>Test Editor</h1><p>This is a test of the <strong>TiptapEditor</strong> component.</p><p>Try typing some <em>markdown</em> shortcuts:</p><ul><li>Type <code># </code> for headings</li><li>Type <code>* </code> for bullet lists</li><li>Type <code>> </code> for blockquotes</li><li>Type <code>==text==</code> for highlighting</li></ul><p>For callouts, use the Obsidian syntax:</p><ul><li><code>> [!note]</code> - Note</li><li><code>> [!info]</code> - Info</li><li><code>> [!tip]</code> - Tip</li><li><code>> [!important]</code> - Important</li><li><code>> [!success]</code> - Success</li><li><code>> [!question]</code> - Question</li><li><code>> [!warning]</code> - Warning</li><li><code>> [!caution]</code> - Caution</li><li><code>> [!failure]</code> - Failure</li><li><code>> [!danger]</code> - Danger</li><li><code>> [!bug]</code> - Bug</li><li><code>> [!example]</code> - Example</li><li><code>> [!todo]</code> - Todo</li></ul><p>You can put the callout specifier on its own line and content on the next line, or put everything on one line.</p>');
	
	function handleChange(newContent: string) {
		content = newContent;
		console.log('Content changed:', newContent);
	}
	
	function handleSave() {
		console.log('Saving content:', content);
	}
</script>

<div class="min-h-screen bg-gray-50 p-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl font-bold mb-8">TiptapEditor Test</h1>
		
		<div class="bg-white rounded-lg shadow-lg overflow-hidden">
			<TiptapEditor 
				bind:value={content}
				onChange={handleChange}
				onSave={handleSave}
				placeholder="Start typing here..."
				showToolbar={true}
			/>
		</div>
		
		<div class="mt-8 bg-white rounded-lg shadow-lg p-6">
			<h2 class="text-xl font-semibold mb-4">HTML Output:</h2>
			<pre class="bg-gray-100 p-4 rounded text-sm overflow-auto">{content}</pre>
		</div>
	</div>
</div> 