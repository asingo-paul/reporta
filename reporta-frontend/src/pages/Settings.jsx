import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Save, Upload, CreditCard, User, Palette, CheckCircle, History, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { templateAPI, billingAPI, authAPI, auditAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import { useToast } from '../contexts/ToastContext';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const tabHint = searchParams.get('tab');
  // Preserve an explicit `?tab=billing` (used by the Stripe callback
  // redirect) over the default tab.
  const [activeTab, setActiveTab] = useState(tabHint === 'billing' ? 'billing' : 'template');
  
  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white mb-8 uppercase">Settings</h1>

          {/* Tabs */}
          <div className="mb-8 border-b border-gray-200 dark:border-gray-800">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('template')}
                className={`py-4 px-1 border-b-2 font-light text-xs uppercase tracking-wider ${
                  activeTab === 'template'
                    ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <Palette className="h-4 w-4 inline mr-2" />
                Report Template
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`py-4 px-1 border-b-2 font-light text-xs uppercase tracking-wider ${
                  activeTab === 'account'
                    ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Account
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`py-4 px-1 border-b-2 font-light text-xs uppercase tracking-wider ${
                  activeTab === 'billing'
                    ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <CreditCard className="h-4 w-4 inline mr-2" />
                Billing
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-4 px-1 border-b-2 font-light text-xs uppercase tracking-wider ${
                  activeTab === 'activity'
                    ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <History className="h-4 w-4 inline mr-2" />
                Activity
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'template' && <TemplateSettings />}
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'billing' && <BillingSettings />}
          {activeTab === 'activity' && <ActivityLog />}
        </div>
      </PageWrapper>
    </>
  );
}

// Toggleable report metrics, grouped by the kind of data source they need.
// Keys must match the backend's `MetricKind::as_str()` exactly so
// `enabled_metrics` round-trips cleanly. A metric only appears in a report when
// a connected source can actually supply it (e.g. CTR/CPC/ROAS need an ad
// account; sessions/pageviews need Google Analytics).
const METRIC_GROUPS = [
  {
    group: 'Advertising (Meta / Google Ads)',
    metrics: [
      { key: 'impressions', label: 'Impressions' },
      { key: 'clicks', label: 'Clicks' },
      { key: 'spend', label: 'Spend' },
      { key: 'ctr', label: 'CTR' },
      { key: 'cpc', label: 'CPC' },
      { key: 'conversions', label: 'Conversions' },
      { key: 'conversion_rate', label: 'Conversion Rate' },
      { key: 'cost_per_conversion', label: 'Cost per Conversion' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'roas', label: 'ROAS' },
    ],
  },
  {
    group: 'Website traffic (Google Analytics 4)',
    metrics: [
      { key: 'sessions', label: 'Sessions' },
      { key: 'total_users', label: 'Total Users' },
      { key: 'new_users', label: 'New Users' },
      { key: 'page_views', label: 'Page Views' },
      { key: 'engagement_rate', label: 'Engagement Rate' },
      { key: 'avg_engagement_time', label: 'Avg. Engagement Time' },
    ],
  },
];

const METRIC_OPTIONS = METRIC_GROUPS.flatMap((g) => g.metrics);

function TemplateSettings() {
  const toast = useToast();
  const [formData, setFormData] = useState({
    brand_primary_color: '#6366F1',
    brand_secondary_color: '#F59E0B',
    enabled_metrics: METRIC_OPTIONS.map((m) => m.key),
    intro_blurb: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const response = await templateAPI.get();
      const data = response.data;
      setFormData({
        brand_primary_color: data.brand_primary_color || '#6366F1',
        brand_secondary_color: data.brand_secondary_color || '#F59E0B',
        enabled_metrics:
          data.enabled_metrics && data.enabled_metrics.length > 0
            ? data.enabled_metrics
            : METRIC_OPTIONS.map((m) => m.key),
        intro_blurb: data.intro_blurb || '',
      });
      if (data.logo_url) {
        setLogoPreview(data.logo_url);
        loadLogo(data.logo_url);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // The backend returns the stored logo *filename* (not a public URL), so we
  // fetch the bytes and render them as a local object URL.
  const loadLogo = async (filename) => {
    try {
      const response = await templateAPI.getLogo(filename);
      setLogoPreview(URL.createObjectURL(response.data));
    } catch (error) {
      console.error('Failed to load logo:', error);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMetric = (key) => {
    setFormData((prev) => {
      const has = prev.enabled_metrics.includes(key);
      const next = has
        ? prev.enabled_metrics.filter((k) => k !== key)
        : [...prev.enabled_metrics, key];
      return { ...prev, enabled_metrics: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Upload logo if changed (backend returns the fresh template).
      if (logoFile) {
        await templateAPI.uploadLogo(logoFile);
      }

      // Update template settings with the real contract fields.
      await templateAPI.update(formData);

      toast.success('Template settings saved successfully!');
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card">
        <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">Report Template Customization</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Customize how your reports look when sent to clients
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Intro Blurb */}
          <div>
            <label htmlFor="intro_blurb" className="section-title">
              Intro Blurb
            </label>
            <textarea
              id="intro_blurb"
              name="intro_blurb"
              value={formData.intro_blurb}
              onChange={handleChange}
              rows={3}
              className="input resize-none"
              placeholder="A short welcome message shown at the top of each report. Use [Client Name] to insert the client's name."
            />
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Appears at the top of every generated report.
            </p>
          </div>

          {/* Logo */}
          <div>
            <label className="section-title">Company Logo</label>
            <div className="flex items-center space-x-4">
              {logoPreview && (
                <div className="h-20 w-20 border border-gray-300 dark:border-gray-700 rounded overflow-hidden bg-gray-100 dark:bg-dark flex items-center justify-center">
                  <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div className="flex-1">
                <label className="btn btn-secondary cursor-pointer inline-flex items-center text-xs py-2 px-6">
                  <Upload className="h-4 w-4 mr-2" />
                  {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  PNG or JPG, max 2MB. Recommended size: 400x400px
                </p>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="brand_primary_color" className="section-title">
                Primary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="brand_primary_color"
                  name="brand_primary_color"
                  value={formData.brand_primary_color}
                  onChange={handleChange}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-700 rounded cursor-pointer bg-white dark:bg-dark"
                />
                <input
                  type="text"
                  value={formData.brand_primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand_primary_color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#6366F1"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Main brand color</p>
            </div>

            <div>
              <label htmlFor="brand_secondary_color" className="section-title">
                Secondary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="brand_secondary_color"
                  name="brand_secondary_color"
                  value={formData.brand_secondary_color}
                  onChange={handleChange}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-700 rounded cursor-pointer bg-white dark:bg-dark"
                />
                <input
                  type="text"
                  value={formData.brand_secondary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand_secondary_color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#F59E0B"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Accent color for charts</p>
            </div>
          </div>

          {/* Metrics */}
          <div>
            <label className="section-title">Report Metrics</label>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Choose which metrics appear in generated reports
            </p>
            <div className="space-y-5">
              {METRIC_GROUPS.map(({ group, metrics }) => (
                <div key={group}>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">{group}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {metrics.map((metric) => {
                      const enabled = formData.enabled_metrics.includes(metric.key);
                      return (
                        <button
                          type="button"
                          key={metric.key}
                          onClick={() => toggleMetric(metric.key)}
                          className={`flex items-center justify-between px-4 py-3 border text-xs uppercase tracking-wider transition-colors ${
                            enabled
                              ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white bg-gray-100 dark:bg-dark-50'
                              : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-600'
                          }`}
                        >
                          <span>{metric.label}</span>
                          <span
                            className={`w-4 h-4 border flex items-center justify-center text-[10px] transition-colors ${
                              enabled
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                                : 'border-gray-300 dark:border-gray-700'
                            }`}
                          >
                            {enabled ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="border border-gray-200 dark:border-gray-800 rounded p-6 bg-gray-100 dark:bg-dark-50">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Preview</p>
            <div className="bg-white dark:bg-dark border border-gray-200 dark:border-gray-800 rounded p-6">
              <div className="flex items-center space-x-4 mb-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-12 w-auto" />
                )}
                <h3 className="text-xl font-light tracking-wide" style={{ color: formData.brand_primary_color }}>
                  Report Template
                </h3>
              </div>
              <div className="h-2 rounded" style={{ backgroundColor: formData.brand_primary_color }}></div>
              <div className="mt-4 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-800">
            <button
              type="submit"
              className="btn btn-primary inline-flex items-center"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountSettings() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card">
        <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">Account Information</h2>
        
        <div className="space-y-6">
          <div>
            <label className="section-title">Name</label>
            <p className="text-gray-900 dark:text-white font-light">{user?.name}</p>
          </div>

          <div>
            <label className="section-title">Email</label>
            <p className="text-gray-900 dark:text-white font-light">{user?.email}</p>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              To update your account information or change your password, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingSettings() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';
  const [view, setView] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // `isCheckingOut` drives the "confirming your payment…" banner. It's turned
  // off the moment we've actively confirmed with Stripe, so the page never
  // gets stuck on "still confirming".
  const [isCheckingOut, setIsCheckingOut] = useState(checkoutSuccess);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  const loadSubscription = async () => {
    const response = await billingAPI.getSubscription();
    setView(response.data);
    setError(null);
    return response.data;
  };

  // Actively pull the account's subscription straight from Stripe (rather
  // than waiting on the async webhook) and refresh the local view from the
  // result. This is the fast, deterministic confirmation path after checkout.
  const syncFromStripe = async () => {
    const response = await billingAPI.syncSubscription();
    setView(response.data);
    setError(null);
    return response.data;
  };

  useEffect(() => {
    (async () => {
      try {
        if (checkoutSuccess) {
          // New payment: reconcile with Stripe right away so it shows up
          // immediately instead of only when the webhook happens to land.
          const fresh = await syncFromStripe();
          if (fresh?.is_currently_valid) setIsCheckingOut(false);
        } else {
          await loadSubscription();
        }
      } catch (e) {
        console.error('Failed to load subscription:', e);
        if (e.response?.status !== 404) {
          setError('Unable to load subscription information');
        } else {
          // 404 = no subscription row yet (fresh account).
          setView({ subscription: null, is_currently_valid: false });
        }
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the initial sync is still pending (e.g. Stripe was briefly
  // unreachable) poll for a short window — but stop early if the endpoint
  // isn't available (404 = an older backend without the sync route), so we
  // never loop forever or flood the console with errors. Either way the
  // "confirming" state is always cleared so it can never persist.
  useEffect(() => {
    if (!checkoutSuccess) return undefined;
    if (!isCheckingOut) return undefined;
    let attempts = 0;
    const poll = setInterval(async () => {
      try {
        const fresh = await syncFromStripe();
        if (fresh?.is_currently_valid) {
          clearInterval(poll);
          setIsCheckingOut(false);
        }
      } catch (e) {
        // Backend doesn't expose the sync route → nothing more to do here.
        if (e?.response?.status === 404) {
          clearInterval(poll);
          setIsCheckingOut(false);
          return;
        }
        /* otherwise keep retrying until the cap */
      }
      if (++attempts >= 6) {
        clearInterval(poll);
        setIsCheckingOut(false);
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [checkoutSuccess, isCheckingOut]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      if (checkoutSuccess) {
        await syncFromStripe();
      } else {
        await loadSubscription();
      }
      toast.success('Subscription status refreshed');
    } catch {
      toast.error('Failed to refresh subscription status');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await billingAPI.createPortalSession();
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to create portal session:', error);
      toast.error('Failed to open billing portal. Please try again.');
    }
  };

  const handleSubscribe = async () => {
    try {
      const response = await billingAPI.createCheckoutSession();
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  const sub = view?.subscription || null;
  const isCurrentlyValid = !!view?.is_currently_valid;
  const status = sub?.status;
  const periodStart = view?.current_period_start;
  const periodEnd = view?.current_period_end;
  const isCancelling = periodEnd != null && sub?.cancel_at_period_end;

  return (
    <div className="max-w-3xl">
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">Subscription & Billing</h2>
          <button
            onClick={handleRefresh}
            className="btn btn-secondary text-xs py-1 px-3 inline-flex items-center"
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {isCurrentlyValid ? (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4">
              <p className="text-green-600 dark:text-green-400 font-medium uppercase tracking-wider">Active Subscription</p>
              <p className="text-sm text-green-600 dark:text-green-500/80 mt-1">
                {isCancelling
                  ? 'Your subscription is active and paid through the current period, then it will cancel.'
                  : 'Your subscription is active, up to date, and validated to the date shown below.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="section-title">Plan</label>
                <p className="text-gray-900 dark:text-white font-light">Professional - $29/mo</p>
              </div>
              {periodStart && (
                <div>
                  <label className="section-title">Paid from</label>
                  <p className="text-gray-900 dark:text-white font-light">
                    {format(new Date(periodStart), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {periodEnd && (
                <div>
                  <label className="section-title">{isCancelling ? 'Access ends' : 'Renews on'}</label>
                  <p className="text-gray-900 dark:text-white font-light">
                    {format(new Date(periodEnd), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={handleManageSubscription}
                className="btn btn-primary inline-flex items-center"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Subscription
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Update payment method, view invoices, or cancel your subscription
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
              <p className="text-yellow-600 dark:text-yellow-400 font-medium uppercase tracking-wider">
                {isCheckingOut
                  ? 'Confirming your payment…'
                  : sub && status
                    ? `Subscription ${status}`
                    : 'No Active Subscription'}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500/80 mt-1">
                {isCheckingOut
                  ? 'Please wait a moment — we are confirming your payment with Stripe.'
                  : sub && status
                    ? status === 'incomplete' || status === 'past_due' || status === 'unpaid'
                      ? 'Your payment is not in good standing. Use Refresh, or update your payment method to keep full access.'
                      : 'Your subscription is not currently active.'
                    : 'Subscribe to unlock unlimited reports and AI insights.'}
              </p>
              {periodEnd && !isCurrentlyValid && (
                <p className="text-sm mt-2 text-yellow-600 dark:text-yellow-500/80">
                  Access expired on {format(new Date(periodEnd), 'MMM d, yyyy')}.
                </p>
              )}
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded p-6">
              <h3 className="text-lg font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">Professional Plan</h3>
              <p className="text-3xl font-light text-gray-900 dark:text-white mb-4">
                $29<span className="text-lg font-normal text-gray-600 dark:text-gray-400">/month</span>
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  Unlimited clients
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  Unlimited reports
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  AI-powered insights
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  All integrations
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  Custom branding
                </li>
              </ul>
              
              <div className="space-y-3">
                <Link to="/checkout" className="btn btn-primary w-full justify-center inline-flex">
                  View Full Details & Subscribe
                </Link>
                <button onClick={handleSubscribe} className="btn btn-secondary w-full justify-center">
                  Quick Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Activity Log ----------
//
// The confirmation log: every recorded create/update/delete/send action is
// written server-side to `audit_logs` (who, what, which row, from which IP)
// and surfaced here so the agency can see exactly what happened in their
// workspace, and when.

const ACTION_META = {
  'client.created': { label: 'Client created', tone: 'green' },
  'client.updated': { label: 'Client updated', tone: 'blue' },
  'client.deleted': { label: 'Client deleted', tone: 'red' },
  'connection.revoked': { label: 'Integration disconnected', tone: 'red' },
  'integration.connect_started': { label: 'Integration connect started', tone: 'blue' },
  'integration.connected': { label: 'Integration connected', tone: 'green' },
  'integration.connect_failed': { label: 'Integration connect failed', tone: 'red' },
  'report.generated': { label: 'Report generated', tone: 'green' },
  'report.summary_edited': { label: 'Report summary edited', tone: 'blue' },
  'report.sent': { label: 'Report sent to client', tone: 'green' },
  'report.pdf_downloaded': { label: 'Report PDF downloaded', tone: 'blue' },
  'report.deleted': { label: 'Report deleted', tone: 'red' },
  'template.updated': { label: 'Report template updated', tone: 'blue' },
  'template.logo_uploaded': { label: 'Logo uploaded', tone: 'blue' },
  'auth.signup': { label: 'Account created', tone: 'green' },
  'auth.login': { label: 'Signed in', tone: 'gray' },
  'auth.login_failed': { label: 'Failed sign-in attempt', tone: 'red' },
  'billing.checkout_started': { label: 'Checkout started', tone: 'blue' },
  'billing.portal_opened': { label: 'Billing portal opened', tone: 'blue' },
  'billing.payment_completed': { label: 'Payment completed', tone: 'green' },
  'billing.payment_failed': { label: 'Payment failed', tone: 'red' },
  'billing.payment_unknown_customer': { label: 'Payment not linked to account', tone: 'red' },
  'billing.subscription_ended': { label: 'Subscription ended', tone: 'red' },
};

const TONE_CLASSES = {
  green: 'border-green-600 text-green-600 dark:border-green-700 dark:text-green-400',
  blue: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400',
  red: 'border-red-600 text-red-600 dark:border-red-700 dark:text-red-400',
  gray: 'border-gray-400 text-gray-600 dark:border-gray-600 dark:text-gray-400',
};

// Human-readable one-line summary from the action + its metadata payload.
function describeEntry(entry) {
  const m = entry.metadata || {};
  switch (entry.action) {
    case 'client.created':
    case 'client.updated':
      return `Client: ${m.name || '—'}`;
    case 'client.deleted':
      return `Deleted client: ${m.name || '—'} (reports and integrations removed)`;
    case 'connection.revoked':
      return `Provider: ${String(m.provider || '—').toUpperCase()}`;
    case 'integration.connect_started':
    case 'integration.connected':
      return `Provider: ${String(m.provider || '—').toUpperCase()}`;
    case 'integration.connect_failed':
      return `Provider: ${String(m.provider || '—').toUpperCase()} · Reason: ${m.reason || 'unknown'}`;
    case 'report.generated':
      return `Period: ${m.period_start || '?'} → ${m.period_end || '?'}`;
    case 'report.summary_edited':
      return `Edited summary (${m.length ?? 0} characters)`;
    case 'report.sent':
      return `Sent to: ${m.to_name || ''} <${m.to_email || '—'}>`;
    case 'report.pdf_downloaded':
      return 'Downloaded the generated PDF';
    case 'report.deleted':
      return `Period: ${m.period_start || '?'} → ${m.period_end || '?'}${m.was_sent ? ' · was previously sent' : ''}`;
    case 'template.logo_uploaded':
      return `File: ${m.filename || '—'} (${m.bytes ?? 0} bytes)`;
    case 'template.updated':
      return `Enabled metrics: ${(m.enabled_metrics || []).join(', ') || '—'}`;
    case 'auth.login':
    case 'auth.signup':
      return `Email: ${m.email || '—'}`;
    case 'auth.login_failed':
      return `Email: ${m.email || '—'} · Reason: ${m.reason === 'bad_password' ? 'incorrect password' : m.reason || 'unknown'}`;
    case 'billing.checkout_started':
    case 'billing.portal_opened':
      return 'Directs to Stripe to manage payment.';
    case 'billing.payment_completed':
      return `${m.kind === 'renewal' ? 'Renewal' : 'Initial'} payment · Status: ${m.status || '—'} · Valid: ${m.in_period ? 'yes' : 'no'}` +
        (m.period_start && m.period_end
          ? ` · Paid ${new Date(m.period_start).toLocaleDateString()} → ${new Date(m.period_end).toLocaleDateString()}`
          : '');
    case 'billing.payment_failed':
      return `Payment failed · Status: ${m.status || '—'} · Attempt ${m.attempt_count ?? 1}`;
    case 'billing.payment_unknown_customer':
      return 'Payment received for a Stripe customer not linked to any account.';
    case 'billing.subscription_ended':
      return `Status: ${m.status || '—'}`;
    default:
      return '';
  }
}

function ActivityLog() {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivity = async () => {
    try {
      const response = await auditAPI.list({ limit: 100 });
      setEntries(response.data);
    } catch (error) {
      console.error('Failed to load activity log:', error);
      toast.error('Failed to load activity log');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // loadActivity sets state after awaiting the network call (not synchronously),
    // but the linter conservatively flags it — as it does for every loader on this
    // page — so we suppress that single check here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card">
        <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">Activity Log</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Every create, update, delete, and send action on this account is recorded here — including who
          did it and from where.
        </p>

        {entries.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No activity recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const meta = ACTION_META[entry.action] || { label: entry.action, tone: 'gray' };
              const detail = describeEntry(entry);
              return (
                <div
                  key={entry.id}
                  className="border border-gray-200 dark:border-gray-800 rounded p-4"
                >
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 border rounded-full text-xs ${TONE_CLASSES[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {detail && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{detail}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    {entry.ip_address ? ` · from ${entry.ip_address}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
