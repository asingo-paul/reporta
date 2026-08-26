import { useState } from 'react';
import { Filter, SortAsc, SortDesc, X, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export function ClientFilter({ onFilterChange, onSortChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSortChange = (field) => {
    let newOrder = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    onSortChange({ field, order: newOrder });
  };

  const SortIcon = sortOrder === 'asc' ? SortAsc : SortDesc;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary text-xs py-2 px-4 inline-flex items-center"
      >
        <Filter className="h-4 w-4 mr-2" />
        Sort
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded shadow-xl z-20">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">
                  Sort By
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => handleSortChange('name')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                    sortBy === 'name'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <span>Name</span>
                  {sortBy === 'name' && <SortIcon className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => handleSortChange('created')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                    sortBy === 'created'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <span>Date Created</span>
                  {sortBy === 'created' && <SortIcon className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => handleSortChange('updated')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                    sortBy === 'updated'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <span>Last Updated</span>
                  {sortBy === 'updated' && <SortIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ReportFilter({ onFilterChange, onSortChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: 'all'
  });
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSortChange = (field) => {
    let newOrder = 'desc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    onSortChange({ field, order: newOrder });
  };

  const activeFilters = Object.values(filters).filter(v => v !== 'all').length;
  const SortIcon = sortOrder === 'asc' ? SortAsc : SortDesc;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary text-xs py-2 px-4 inline-flex items-center relative"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filter & Sort
        {activeFilters > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 dark:bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
            {activeFilters}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded shadow-xl z-20 max-h-[80vh] overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">
                  Filter & Sort
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2 block">
                  Status
                </label>
                <div className="space-y-1">
                  {[
                    { value: 'all', label: 'All Reports', icon: null },
                    { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
                    { value: 'processing', label: 'Processing', icon: Clock, color: 'text-yellow-500' },
                    { value: 'failed', label: 'Failed', icon: AlertCircle, color: 'text-red-500' }
                  ].map(status => {
                    const Icon = status.icon;
                    return (
                      <button
                        key={status.value}
                        onClick={() => handleFilterChange('status', status.value)}
                        className={`w-full flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors ${
                          filters.status === status.value
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                        }`}
                      >
                        {Icon && <Icon className={`h-4 w-4 ${status.color}`} />}
                        <span>{status.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2 block">
                  Date Range
                </label>
                <div className="space-y-1">
                  {[
                    { value: 'all', label: 'All Time' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Last 7 Days' },
                    { value: 'month', label: 'Last 30 Days' },
                    { value: 'quarter', label: 'Last 90 Days' }
                  ].map(range => (
                    <button
                      key={range.value}
                      onClick={() => handleFilterChange('dateRange', range.value)}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors ${
                        filters.dateRange === range.value
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                      }`}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>{range.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Options */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <label className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2 block">
                  Sort By
                </label>
                <div className="space-y-1">
                  {[
                    { value: 'created', label: 'Date Created' },
                    { value: 'updated', label: 'Last Updated' },
                    { value: 'name', label: 'Client Name' }
                  ].map(sort => (
                    <button
                      key={sort.value}
                      onClick={() => handleSortChange(sort.value)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                        sortBy === sort.value
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                      }`}
                    >
                      <span>{sort.label}</span>
                      {sortBy === sort.value && <SortIcon className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setFilters({ status: 'all', dateRange: 'all' });
                    onFilterChange({ status: 'all', dateRange: 'all' });
                  }}
                  className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors py-2"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
