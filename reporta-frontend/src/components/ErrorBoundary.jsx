import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Log to error reporting service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-dark flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="card text-center py-16">
              {/* Error Icon */}
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>

              {/* Error Message */}
              <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white mb-3 uppercase">
                Something Went Wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed max-w-md mx-auto">
                We encountered an unexpected error. This has been logged and we'll look into it.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-8 text-left bg-gray-100 dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded p-4 max-w-xl mx-auto overflow-auto">
                  <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => window.location.reload()}
                  className="btn btn-primary inline-flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </button>
                <a
                  href="/dashboard"
                  className="btn btn-secondary inline-flex items-center"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </a>
              </div>

              {/* Help Text */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  If this problem persists,{' '}
                  <a href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">
                    contact support
                  </a>
                  {' '}for assistance
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
