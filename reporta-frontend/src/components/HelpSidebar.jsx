import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  X, 
  HelpCircle, 
  MessageSquare, 
  Book, 
  ChevronDown, 
  ChevronUp,
  ExternalLink
} from 'lucide-react';

export default function HelpSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    {
      id: 1,
      question: 'How do I connect my Google Analytics account?',
      answer: 'Go to the Clients page, select a client, and click the "Connect" button on the Google Analytics 4 card. You\'ll be redirected to Google to authorize access.'
    },
    {
      id: 2,
      question: 'How long does it take to generate a report?',
      answer: 'Report generation typically takes 2-5 minutes depending on the amount of data being analyzed. You\'ll receive a notification when your report is ready.'
    },
    {
      id: 3,
      question: 'Can I customize the report branding?',
      answer: 'Yes! Go to Settings → Template to upload your logo and set your brand colors. All reports will automatically include your branding.'
    },
    {
      id: 4,
      question: 'How do I cancel my subscription?',
      answer: 'You can cancel anytime from Settings → Billing. Click "Manage Subscription" to access cancellation options. Your access continues until the end of your billing period.'
    },
    {
      id: 5,
      question: 'What integrations are supported?',
      answer: 'Currently we support Google Analytics 4, Google Ads, and Meta (Facebook/Instagram) Ads. More integrations are coming soon!'
    },
    {
      id: 6,
      question: 'How does the AI analysis work?',
      answer: 'We use large language models (such as Google Gemini) to analyze your marketing data and generate insights, summaries, and recommendations based on performance trends.'
    },
    {
      id: 7,
      question: 'Can I send reports directly to clients?',
      answer: 'Yes! When generating a report, you can enter client email addresses to have the PDF automatically delivered to them.'
    },
    {
      id: 8,
      question: 'Is my data secure?',
      answer: 'Absolutely. We use industry-standard encryption for data in transit and at rest. We never share your data with third parties except as required to provide our service.'
    },
    {
      id: 9,
      question: 'What happens during the free trial?',
      answer: 'You get full access to all features for 14 days. No credit card required. You can cancel anytime before the trial ends at no charge.'
    },
    {
      id: 10,
      question: 'Can I export reports as PDF?',
      answer: 'All reports are automatically generated as professional PDFs with your branding. You can download them anytime from the Reports section.'
    }
  ];

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
        aria-label="Help & Support"
      >
        <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white dark:bg-dark border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white uppercase">
              Help & Support
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Find answers to common questions or get in touch
          </p>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-88px)] overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Quick Actions */}
          <div className="space-y-3">
            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Contact Support
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Send us a message
                  </p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </Link>

            <a
              href="mailto:support@reporta.com"
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Book className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Email Support
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    support@reporta.com
                  </p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </a>
          </div>

          {/* FAQ Section */}
          <div>
            <h3 className="text-lg font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
              Frequently Asked Questions
            </h3>
            <div className="space-y-2">
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden"
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white pr-4">
                      {faq.question}
                    </span>
                    {expandedFaq === faq.id ? (
                      <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Additional Help */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 rounded p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Still need help?
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Our support team is here for you. We typically respond within 24 hours.
            </p>
            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Contact Support →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
