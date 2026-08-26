// Reusable loading skeleton components

export function CardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-12 w-12 bg-gray-200 dark:bg-gray-800 rounded"></div>
        <div className="flex space-x-2">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>
      <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-4"></div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
        <div className="h-5 w-5 bg-gray-200 dark:bg-gray-800 rounded"></div>
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-2"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-3"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded animate-pulse">
      <div className="flex items-center space-x-4 flex-1">
        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded"></div>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
        <div className="h-5 w-5 bg-gray-200 dark:bg-gray-800 rounded"></div>
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-20"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-16"></div>
      </td>
    </tr>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-2"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      </div>
      <div>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-2"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      </div>
      <div>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-2"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      </div>
      <div className="flex space-x-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-6"></div>
      <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded"></div>
      <div className="flex justify-around mt-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-16"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-16"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-16"></div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Skeleton */}
      <div className="mb-8 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-2"></div>
        <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Quick Actions Skeleton */}
      <div className="card mb-8 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>

      {/* Recent Reports Skeleton */}
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      </div>
    </div>
  );
}

export function ClientsListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 animate-pulse">
        <div className="mb-4 md:mb-0">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-2"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
        </div>
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
      </div>

      {/* Search Skeleton */}
      <div className="mb-6 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function ReportDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-4"></div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48 mb-2"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
          </div>
          <div className="flex space-x-3">
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="card mb-8">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Summary */}
      <div className="card">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  );
}
