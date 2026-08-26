import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';

export default function ConnectionCallback() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const provider = searchParams.get('connected');
  const error = searchParams.get('error');

  useEffect(() => {
    // Redirect to appropriate page after showing success/error message
    const timer = setTimeout(() => {
      if (clientId) {
        navigate(`/clients/${clientId}`);
      } else {
        navigate('/clients');
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [clientId, navigate]);

  return (
    <div className="min-h-screen bg-white dark:bg-dark flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {error ? (
          <>
            <XCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
              Connection Failed
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error === 'missing_code_or_state' && 'Authentication was cancelled or incomplete.'}
              {error === 'connection_failed' && 'Failed to establish connection. Please try again.'}
              {!['missing_code_or_state', 'connection_failed'].includes(error) && `Error: ${error}`}
            </p>
          </>
        ) : provider ? (
          <>
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
              Successfully Connected!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {provider === 'ga4' && 'Google Analytics 4 has been connected.'}
              {provider === 'google_ads' && 'Google Ads has been connected.'}
              {provider === 'meta' && 'Meta (Facebook/Instagram) has been connected.'}
            </p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Processing connection...</p>
          </>
        )}
        
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Redirecting back to {clientId ? 'client details' : 'clients'}...
        </p>
      </div>
    </div>
  );
}
