<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		variant = "default",
		...restProps
	}: ContextMenuPrimitive.ItemProps & {
		inset?: boolean;
		variant?: "default" | "destructive";
	} = $props();
</script>

<ContextMenuPrimitive.Item
	bind:ref
	data-slot="context-menu-item"
	data-inset={inset}
	data-variant={variant}
			class={cn(
			"data-highlighted:bg-gray-100 data-highlighted:text-gray-900 data-[variant=destructive]:text-red-600 data-[variant=destructive]:data-highlighted:bg-red-50 data-[variant=destructive]:data-highlighted:text-red-700 data-[variant=destructive]:*:[svg]:!text-red-600 [&_svg:not([class*='text-'])]:text-gray-500 outline-hidden relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 transition-colors duration-150",
			className
		)}
	{...restProps}
/>
