export function hashTag(tag: string): number {
	let hash = 0;
	for (let i = 0; i < tag.length; i++) {
		hash = (hash << 5) - hash + tag.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

const TAG_PALETTE = [
	{
		badge:
			"bg-blue-500/10 text-blue-600 border-blue-200/60 dark:text-blue-400 dark:border-blue-800/40",
		active:
			"bg-blue-500/20 text-blue-700 border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/50",
	},
	{
		badge:
			"bg-emerald-500/10 text-emerald-600 border-emerald-200/60 dark:text-emerald-400 dark:border-emerald-800/40",
		active:
			"bg-emerald-500/20 text-emerald-700 border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/50",
	},
	{
		badge:
			"bg-purple-500/10 text-purple-600 border-purple-200/60 dark:text-purple-400 dark:border-purple-800/40",
		active:
			"bg-purple-500/20 text-purple-700 border-purple-400/50 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-400/50",
	},
	{
		badge:
			"bg-amber-500/10 text-amber-600 border-amber-200/60 dark:text-amber-400 dark:border-amber-800/40",
		active:
			"bg-amber-500/20 text-amber-700 border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/50",
	},
	{
		badge:
			"bg-pink-500/10 text-pink-600 border-pink-200/60 dark:text-pink-400 dark:border-pink-800/40",
		active:
			"bg-pink-500/20 text-pink-700 border-pink-400/50 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-400/50",
	},
	{
		badge:
			"bg-cyan-500/10 text-cyan-600 border-cyan-200/60 dark:text-cyan-400 dark:border-cyan-800/40",
		active:
			"bg-cyan-500/20 text-cyan-700 border-cyan-400/50 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-400/50",
	},
	{
		badge:
			"bg-orange-500/10 text-orange-600 border-orange-200/60 dark:text-orange-400 dark:border-orange-800/40",
		active:
			"bg-orange-500/20 text-orange-700 border-orange-400/50 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/50",
	},
	{
		badge:
			"bg-indigo-500/10 text-indigo-600 border-indigo-200/60 dark:text-indigo-400 dark:border-indigo-800/40",
		active:
			"bg-indigo-500/20 text-indigo-700 border-indigo-400/50 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/50",
	},
] as const;

export type TagColorSet = (typeof TAG_PALETTE)[number];

export function getTagColor(tag: string): TagColorSet {
	return TAG_PALETTE[hashTag(tag) % TAG_PALETTE.length]!;
}
