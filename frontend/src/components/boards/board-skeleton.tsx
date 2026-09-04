// Loading skeleton for the board detail view — three column-shaped placeholders.

import { Skeleton } from '@/components/ui/skeleton';

export function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex w-80 shrink-0 flex-col gap-2 rounded-lg bg-muted/30 p-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-8" />
          </div>
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-14 w-full rounded-md" />
            ))}
          </div>
          <Skeleton className="mt-auto h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
