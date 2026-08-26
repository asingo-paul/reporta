import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Upload, CreditCard, User, Palette, CheckCircle } from 'lucide-react';
import { templateAPI, billingAPI, authAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('template');
  
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
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'template' && <TemplateSettings />}
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'billing' && <BillingSettings />}
        </div>
      </PageWrapper>
    </>
  );
}

function TemplateSettings() {
  const [template, setTemplate] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    primary_color: '#6366F1',
    secondary_color: '#F59E0B',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const response = await templateAPI.get();
      setTemplate(response.data);
      setFormData({
        company_name: response.data.company_name || '',
        primary_color: response.data.primary_color || '#6366F1',
        secondary_color: response.data.secondary_color || '#F59E0B',
      });
      if (response.data.logo_url) {
        setLogoPreview(response.data.logo_url);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setIsLoading(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      // Upload logo if changed
      if (logoFile) {
        await templateAPI.uploadLogo(logoFile);
      }

      // Update template settings
      await templateAPI.update(formData);
      
      setSuccess('Template settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to save template:', error);
      setError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="company_name" className="section-title">
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              className="input"
              placeholder="Your Company Name"
            />
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This will appear on all generated reports
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
              <label htmlFor="primary_color" className="section-title">
                Primary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="primary_color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-700 rounded cursor-pointer bg-white dark:bg-dark"
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#6366F1"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Main brand color</p>
            </div>

            <div>
              <label htmlFor="secondary_color" className="section-title">
                Secondary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="secondary_color"
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-700 rounded cursor-pointer bg-white dark:bg-dark"
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#F59E0B"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Accent color for charts</p>
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
                <h3 className="text-xl font-light tracking-wide" style={{ color: formData.primary_color }}>
                  {formData.company_name || 'Your Company Name'}
                </h3>
              </div>
              <div className="h-2 rounded" style={{ backgroundColor: formData.primary_color }}></div>
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
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await billingAPI.getSubscription();
      setSubscription(response.data);
      setError(null);
    } catch (error) {
      console.error('Failed to load subscription:', error);
      // Don't set error if it's just a 404 (no subscription yet)
      if (error.response?.status !== 404) {
        setError('Unable to load subscription information');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await billingAPI.createPortalSession();
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to create portal session:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  };

  const handleSubscribe = async () => {
    try {
      const response = await billingAPI.createCheckoutSession();
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
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
        <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">Subscription & Billing</h2>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {subscription?.status === 'active' ? (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4">
              <p className="text-green-600 dark:text-green-400 font-medium uppercase tracking-wider">Active Subscription</p>
              <p className="text-sm text-green-600 dark:text-green-500/80 mt-1">
                Your subscription is active and in good standing
              </p>
            </div>

            <div>
              <label className="section-title">Plan</label>
              <p className="text-gray-900 dark:text-white font-light">Professional Plan - $29/month</p>
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
              <p className="text-yellow-600 dark:text-yellow-400 font-medium uppercase tracking-wider">No Active Subscription</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500/80 mt-1">
                Subscribe to unlock unlimited reports and AI insights
              </p>
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
