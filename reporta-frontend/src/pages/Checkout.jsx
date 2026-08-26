import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  ArrowLeft, 
  CreditCard,
  Shield,
  Zap,
  Users,
  FileText,
  Sparkles,
  BarChart2,
  Target,
  Share2,
  Palette
} from 'lucide-react';
import { billingAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';

export default function Checkout() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await billingAPI.createCheckoutSession();
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setError(error.response?.data?.error || 'Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="min-h-screen bg-white dark:bg-dark py-12 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Back Button */}
            <Link 
              to="/dashboard" 
              className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-xs uppercase tracking-wider">Back to Dashboard</span>
            </Link>

            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                Start Your Free Trial
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                14 days complimentary access. No credit card required for trial.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left Column - Plan Details */}
              <div className="space-y-8">
                {/* Main Plan Card */}
                <div className="card">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white uppercase">
                        Professional Plan
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        Everything you need to scale
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-light text-gray-900 dark:text-white">
                        $29
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        per month
                      </div>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-4 mb-8">
                    <FeatureItem 
                      icon={<Users className="h-5 w-5" />}
                      title="Unlimited Clients"
                      description="Manage as many clients as you need"
                    />
                    <FeatureItem 
                      icon={<FileText className="h-5 w-5" />}
                      title="Unlimited Reports"
                      description="Generate reports anytime, no limits"
                    />
                    <FeatureItem 
                      icon={<Sparkles className="h-5 w-5" />}
                      title="AI-Powered Insights"
                      description="Claude analyzes data and writes summaries"
                    />
                    <FeatureItem 
                      icon={<BarChart2 className="h-5 w-5" />}
                      title="Google Analytics 4"
                      description="Website traffic and user behavior"
                    />
                    <FeatureItem 
                      icon={<Target className="h-5 w-5" />}
                      title="Google Ads Integration"
                      description="Campaign performance and ROI tracking"
                    />
                    <FeatureItem 
                      icon={<Share2 className="h-5 w-5" />}
                      title="Meta Ads (Facebook/Instagram)"
                      description="Social media advertising metrics"
                    />
                    <FeatureItem 
                      icon={<Palette className="h-5 w-5" />}
                      title="Custom Branding"
                      description="Your logo and colors on all reports"
                    />
                    <FeatureItem 
                      icon={<Zap className="h-5 w-5" />}
                      title="Email Delivery"
                      description="Send reports directly to clients"
                    />
                  </div>

                  {/* Trust Badges */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-center space-x-6 text-gray-500 dark:text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5" />
                        <span className="text-sm">Secure Payment</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm">14-Day Trial</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* What Happens Next */}
                <div className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900">
                  <h3 className="text-lg font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                    What Happens Next?
                  </h3>
                  <ol className="space-y-3">
                    <li className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-sm flex items-center justify-center">
                        1
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium">Start your free trial</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          14 days of full access, no credit card required
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-sm flex items-center justify-center">
                        2
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium">Add your clients and connect accounts</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Set up integrations with Google and Meta
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-sm flex items-center justify-center">
                        3
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium">Generate your first report</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          See AI-powered insights in minutes
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-sm flex items-center justify-center">
                        4
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium">Decide before day 14</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Cancel anytime, or continue at $29/month
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>

              {/* Right Column - Checkout Action */}
              <div className="lg:sticky lg:top-24">
                <div className="card">
                  <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">
                    Complete Your Order
                  </h2>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded mb-6">
                      {error}
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="bg-gray-50 dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600 dark:text-gray-400">Plan</span>
                      <span className="text-gray-900 dark:text-white font-medium">Professional</span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600 dark:text-gray-400">Billing</span>
                      <span className="text-gray-900 dark:text-white font-medium">Monthly</span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600 dark:text-gray-400">Trial Period</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">14 Days Free</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-lg text-gray-900 dark:text-white font-medium">Today's Total</span>
                        <span className="text-2xl text-gray-900 dark:text-white font-light">$0</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Then $29/month after trial
                      </p>
                    </div>
                  </div>

                  {/* Terms Acceptance Checkbox */}
                  <div className="mb-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 rounded cursor-pointer"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        I agree to the{' '}
                        <Link to="/terms" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300" target="_blank">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300" target="_blank">
                          Privacy Policy
                        </Link>
                      </span>
                    </label>
                  </div>

                  {/* Subscribe Button */}
                  <button
                    onClick={handleSubscribe}
                    disabled={isLoading || !acceptedTerms}
                    className="btn btn-primary w-full justify-center mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Loading Checkout...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Start Free Trial
                      </>
                    )}
                  </button>

                  {/* Fine Print */}
                  <p className="text-xs text-center text-gray-500 dark:text-gray-500">
                    By starting your trial, you confirm that you have read and agree to our{' '}
                    <Link to="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300" target="_blank">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300" target="_blank">
                      Privacy Policy
                    </Link>
                  </p>
                </div>

                {/* FAQ Section */}
                <div className="mt-6 card">
                  <h3 className="text-lg font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                    Frequently Asked Questions
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        When will I be charged?
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Not until your 14-day trial ends. Cancel anytime before then for free.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Can I cancel anytime?
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Yes! Cancel from your account settings. No questions asked.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        What payment methods do you accept?
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        All major credit cards via Stripe. Secure and encrypted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 text-green-600 dark:text-green-500 mt-0.5">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-gray-900 dark:text-white font-medium text-sm">
          {title}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}
