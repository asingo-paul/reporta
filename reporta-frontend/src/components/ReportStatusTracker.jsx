import { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function ReportStatusTracker({ reportId, initialStatus, onStatusChange }) {
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (status === 'processing' || status === 'pending') {
      // Simulate progress (replace with actual API polling)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 5;
        });
      }, 1000);

      // Track elapsed time
      const timeInterval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

      // Poll for status updates every 5 seconds
      const statusInterval = setInterval(async () => {
        try {
          // Replace with actual API call
          // const response = await reportsAPI.get(reportId);
          // const newStatus = response.data.status;
          
          // Simulate status change for demo
          const newStatus = Math.random() > 0.9 ? 'completed' : status;
          
          if (newStatus !== status) {
            setStatus(newStatus);
            setProgress(100);
            if (onStatusChange) {
              onStatusChange(newStatus);
            }
          }
        } catch (error) {
          console.error('Failed to poll status:', error);
        }
      }, 5000);

      return () => {
        clearInterval(progressInterval);
        clearInterval(timeInterval);
        clearInterval(statusInterval);
      };
    }
  }, [reportId, status, onStatusChange]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          title: 'Report Complete',
          message: 'Your report is ready to view and download'
        };
      case 'processing':
        return {
          icon: Loader,
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          title: 'Generating Report',
          message: 'AI is analyzing your data and creating insights...'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          title: 'Report Failed',
          message: 'There was an error generating your report. Please try again.'
        };
      default: // pending
        return {
          icon: Clock,
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          title: 'Report Queued',
          message: 'Your report is in the queue and will start processing shortly...'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const isProcessing = status === 'processing' || status === 'pending';

  return (
    <div className={`card ${config.bg} ${config.border} border`}>
      <div className="flex items-start space-x-4">
        <div className={`flex-shrink-0 ${isProcessing ? 'animate-pulse' : ''}`}>
          <Icon className={`h-8 w-8 ${config.color} ${status === 'processing' ? 'animate-spin' : ''}`} />
        </div>

        <div className="flex-1">
          <h3 className={`text-lg font-medium ${config.color} mb-1 uppercase tracking-wider`}>
            {config.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {config.message}
          </p>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Progress: {Math.round(progress)}%
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Elapsed: {formatTime(elapsedTime)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Estimated time: 2-5 minutes
              </p>
            </div>
          )}

          {/* Steps */}
          {isProcessing && (
            <div className="mt-4 space-y-2">
              <StepItem completed text="Fetching data from integrations" />
              <StepItem completed={progress > 30} processing={progress <= 30} text="Analyzing metrics" />
              <StepItem completed={progress > 60} processing={progress > 30 && progress <= 60} text="Generating AI insights" />
              <StepItem completed={progress > 90} processing={progress > 60 && progress <= 90} text="Creating PDF" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepItem({ completed, processing, text }) {
  return (
    <div className="flex items-center space-x-2 text-sm">
      {completed ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : processing ? (
        <Loader className="h-4 w-4 text-blue-500 animate-spin" />
      ) : (
        <div className="h-4 w-4 border-2 border-gray-300 dark:border-gray-700 rounded-full"></div>
      )}
      <span className={completed ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'}>
        {text}
      </span>
    </div>
  );
}
