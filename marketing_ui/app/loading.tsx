export default function MarketingLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="h-8 w-48 animate-pulse rounded-full bg-white" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="dash-metric h-24 animate-pulse" />
        ))}
      </div>
      <div className="dash-panel min-h-64 flex-1 animate-pulse" />
    </div>
  );
}
