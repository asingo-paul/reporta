import { useEffect, useState } from 'react';
import { Save, Upload, CreditCard, User, Palette } from 'lucide-react';
import { templateAPI, billingAPI, authAPI } from '../lib/api';
import Navbar from '../components/Navbar';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('template');
  
  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('template')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'template'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Palette className="h-4 w-4 inline mr-2" />
              Report Template
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'account'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Account
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'billing'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Report Template Customization</h2>
        <p className="text-gray-600 mb-6">
          Customize how your reports look when sent to clients
        </p>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="company_name" className="label">
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
            <p className="text-sm text-gray-500 mt-1">
              This will appear on all generated reports
            </p>
          </div>

          {/* Logo */}
          <div>
            <label className="label">Company Logo</label>
            <div className="flex items-center space-x-4">
              {logoPreview && (
                <div className="h-20 w-20 border border-gray-300 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div className="flex-1">
                <label className="btn btn-outline cursor-pointer inline-flex items-center">
                  <Upload className="h-4 w-4 mr-2" />
                  {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  PNG or JPG, max 2MB. Recommended size: 400x400px
                </p>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="primary_color" className="label">
                Primary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="primary_color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#6366F1"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">Main brand color</p>
            </div>

            <div>
              <label htmlFor="secondary_color" className="label">
                Secondary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="secondary_color"
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#F59E0B"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">Accent color for charts</p>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <p className="text-sm font-medium text-gray-900 mb-4">Preview</p>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center space-x-4 mb-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-12 w-auto" />
                )}
                <h3 className="text-xl font-bold" style={{ color: formData.primary_color }}>
                  {formData.company_name || 'Your Company Name'}
                </h3>
              </div>
              <div className="h-2 rounded" style={{ backgroundColor: formData.primary_color }}></div>
              <div className="mt-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              className="btn btn-primary inline-flex items-center"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Account Information</h2>
        
        <div className="space-y-6">
          <div>
            <label className="label">Name</label>
            <p className="text-gray-900 font-medium">{user?.name}</p>
          </div>

          <div>
            <label className="label">Email</label>
            <p className="text-gray-900 font-medium">{user?.email}</p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500">
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

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await billingAPI.getSubscription();
      setSubscription(response.data);
    } catch (error) {
      console.error('Failed to load subscription:', error);
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
      alert('Failed to open billing portal');
    }
  };

  const handleSubscribe = async () => {
    try {
      const response = await billingAPI.createCheckoutSession();
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Subscription & Billing</h2>

        {subscription?.status === 'active' ? (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-900 font-medium">Active Subscription</p>
              <p className="text-sm text-green-700 mt-1">
                Your subscription is active and in good standing
              </p>
            </div>

            <div>
              <label className="label">Plan</label>
              <p className="text-gray-900 font-medium">Professional Plan - $29/month</p>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={handleManageSubscription}
                className="btn btn-primary inline-flex items-center"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Subscription
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Update payment method, view invoices, or cancel your subscription
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-900 font-medium">No Active Subscription</p>
              <p className="text-sm text-yellow-700 mt-1">
                Subscribe to unlock unlimited reports and AI insights
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Professional Plan</h3>
              <p className="text-3xl font-bold text-gray-900 mb-4">
                $29<span className="text-lg font-normal text-gray-600">/month</span>
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-700">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Unlimited clients
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Unlimited reports
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  AI-powered insights
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  All integrations
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Custom branding
                </li>
              </ul>
              <button onClick={handleSubscribe} className="btn btn-primary w-full">
                Subscribe Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
