export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-500" />
        </div>
        <span className="text-xs font-medium uppercase tracking-widest text-black/30 dark:text-white/30">
          Loading
        </span>
      </div>
    </div>
  );
}
