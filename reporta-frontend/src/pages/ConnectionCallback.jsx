import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

/**
 * Builds actionable guidance from the raw OAuth failure reason the backend
 * surfaced. Previously every failure rendered as a blank "please try again";
 * now the specific Google error (redirect URI, app verification, invalid
 * client, missing account, ...) becomes a concrete checklist.
 */
function diagnose(error) {
  if (!error) return null;
  const e = error.toLowerCase();

  if (e.includes('not_configured') || e.includes('not configured')) {
    return {
      title: 'Integration not configured on the server',
      message:
        'The backend is missing one or more Google credentials. This is a setup issue on your server, not with your Google account.',
      bullets: [
        'Open the backend `.env` file and confirm these are set:',
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and for Google Ads also GOOGLE_ADS_DEVELOPER_TOKEN',
        'Restart the API server after changing `.env`.',
      ],
    };
  }

  if (e.includes('no_accessible_account') || e.includes('no accessible')) {
    return {
      title: 'No accessible Google account found',
      message:
        'OAuth succeeded, but the account you signed in with has no GA4 property / Google Ads customer this app can see.',
      bullets: [
        'GA4: make sure the Google account owns (or has access to) a Google Analytics 4 property — a normal GA3/Universal property is not enough.',
        'GA4: enable "Google Analytics Admin API" and "Google Analytics Data API" in Google Cloud Console → APIs & Services → Library.',
        'Google Ads: the developer token must be approved for your ads account (test tokens only work with test accounts). Check https://ads.google.com/aw/apicenter.',
        'Sign in with the account that actually owns the ad account / GA4 property, then disconnect and reconnect.',
      ],
    };
  }

  if (e.includes('redirect_uri') || e.includes('redirect uri')) {
    return {
      title: 'Redirect URI mismatch',
      message:
        'Google rejected the callback URL because it is not registered as an authorized redirect URI for your OAuth 2.0 client.',
      bullets: [
        'Go to Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client.',
        'Under "Authorized redirect URIs", add EXACTLY these two (must match character-for-character, including http/https and the port):',
        `${API_BASE_URL}/integrations/ga4/callback`,
        `${API_BASE_URL}/integrations/google_ads/callback`,
        'Note: Google also requires you to have the "Google Analytics Admin API" / "Google Ads API" enabled in APIs & Services → Library.',
      ],
    };
  }

  if (e.includes('access_denied') || e.includes('access blocked') || e.includes('app is blocked') || e.includes('unverified') || e.includes('403')) {
    return {
      title: 'Google blocked the login (app not verified / in testing)',
      message:
        'This typically means the OAuth app is still in "Testing" mode or not verified, so Google blocks accounts that are not listed as test users.',
      bullets: [
        'In Google Cloud Console → OAuth consent screen, set Publishing status to "Testing".',
        'Add the Google account you are connecting with under "Test users" — otherwise Google refuses to sign in.',
        'For a real deployment, submit the app for verification (Sensitive scopes) or keep it in Testing with the account added.',
      ],
    };
  }

  if (e.includes('invalid_client') || e.includes('client_secret') || e.includes('client secret')) {
    return {
      title: 'Invalid OAuth client credentials',
      message:
        'Google could not find (or rejected) the client ID / client secret the backend used.',
      bullets: [
        'Double-check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend `.env` match an OAuth 2.0 credential of type "Web application" in Google Cloud Console.',
        'Make sure there are no stray spaces or quotes around the values in `.env`.',
        'Restart the API server after editing `.env`.',
      ],
    };
  }

  if (e.includes('invalid_grant') || e.includes('expired') || e.includes('revoked')) {
    return {
      title: 'The authorization code was rejected',
      message: 'Google refused to exchange the authorization code — usually because it already timed out (~10 min) or was used twice.',
      bullets: ['Just try connecting again. If it keeps failing, disconnect first and repeat the flow.'],
    };
  }

  if (e.includes('missing_code_or_state') || e.includes('cancelled') || e.includes('canceled')) {
    return {
      title: 'Connection canceled',
      message: 'You closed the Google window before finishing the authorization, or the callback was missing the code/state.',
      bullets: ['Click the integration again and complete the whole Google flow without closing the tab.'],
    };
  }

  return {
    title: 'Connection failed',
    message:
      'Here is the raw error from the provider (or server). Use it to narrow down the cause — it is also saved to the backend activity log.',
    bullets: [
      'If it mentions a redirect URI, an API scope, or an unverified app, the fixes above apply.',
      'If you are stuck, share this message with support.',
    ],
  };
}

export default function ConnectionCallback() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const provider = searchParams.get('connected');
  const error = searchParams.get('error');
  const diagnosis = useMemo(() => diagnose(error), [error]);

  useEffect(() => {
    // Show the outcome briefly, then land back on the client (or clients) page.
    const timer = setTimeout(() => {
      if (clientId) {
        navigate(`/clients/${clientId}`);
      } else {
        navigate('/clients');
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [clientId, navigate]);

  return (
    <div className="min-h-screen bg-white dark:bg-dark flex items-center justify-center px-6 py-10">
      <div className="max-w-lg w-full text-center">
        {error ? (
          <>
            <XCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
              Connection Failed
            </h1>

            <div className="bg-gray-50 dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded-lg p-5 text-left mt-6">
              <h2 className="flex items-center text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                {diagnosis?.title || 'Unable to connect'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {diagnosis?.message || 'The provider did not accept the connection request.'}
              </p>

              {diagnosis?.bullets?.length > 0 && (
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-4">
                  {diagnosis.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-gray-400 dark:text-gray-500 mr-2">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-1">
                    Raw error
                  </p>
                  <pre className="text-xs bg-white dark:bg-dark border border-gray-200 dark:border-gray-800 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300">
                    {error}
                  </pre>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-500 mt-6">
              Redirecting back to {clientId ? 'client details' : 'clients'}…
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
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Redirecting back to {clientId ? 'client details' : 'clients'}…
            </p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Processing connection...</p>
          </>
        )}
      </div>
    </div>
  );
}
