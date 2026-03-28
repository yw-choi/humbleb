export function ScheduleCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-card-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="mb-2 h-3.5 w-28 rounded bg-muted" />
          <div className="mb-1.5 h-5 w-36 rounded bg-muted" />
          <div className="mb-1.5 h-3.5 w-24 rounded bg-muted" />
          <div className="h-3.5 w-16 rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-12 w-16 rounded-xl bg-muted" />
          <div className="h-12 w-16 rounded-xl bg-muted" />
        </div>
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
