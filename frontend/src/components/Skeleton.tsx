export function ScheduleCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 h-4 w-32 rounded bg-gray-200" />
      <div className="mb-2 h-3 w-48 rounded bg-gray-200" />
      <div className="mb-4 h-3 w-24 rounded bg-gray-200" />
      <div className="flex gap-2">
        <div className="h-10 w-20 rounded-lg bg-gray-200" />
        <div className="h-10 w-20 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

export function ScheduleListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <ScheduleCardSkeleton />
      <ScheduleCardSkeleton />
      <ScheduleCardSkeleton />
    </div>
  );
}
