import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Users, Plug, FileText, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      // Show onboarding after a short delay
      setTimeout(() => {
        setIsOpen(true);
      }, 500);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    {
      title: 'Welcome to Reporta',
      description: 'Your AI-powered marketing reporting platform. Let\'s take a quick tour to get you started.',
      icon: <Sparkles className="h-12 w-12 text-blue-600 dark:text-blue-400" />,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              What You Can Do with Reporta
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 text-left max-w-md mx-auto">
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Generate AI-powered marketing reports in minutes</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Connect Google Analytics, Google Ads, and Meta</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Customize reports with your branding</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Email professional PDFs directly to clients</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: 'Step 1: Add Your Clients',
      description: 'Create profiles for each client you want to generate reports for',
      icon: <Users className="h-12 w-12 text-blue-600 dark:text-blue-400" />,
      content: (
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Client Profiles</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Each client gets their own dashboard where you can manage their integrations and reports.
                </p>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <p>• Store client name and contact information</p>
                  <p>• Organize all client data in one place</p>
                  <p>• Track report history per client</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 rounded p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              <strong>Tip:</strong> Start with 1-2 clients to get familiar with the platform
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'Step 2: Connect Data Sources',
      description: 'Link your clients\' marketing accounts to pull in real data',
      icon: <Plug className="h-12 w-12 text-purple-600 dark:text-purple-400" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                  <span className="text-xl">🔍</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Google Analytics 4</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Website traffic and user behavior</p>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Google Ads</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Campaign performance and ROI</p>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center">
                  <span className="text-xl">📱</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Meta Ads</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Facebook & Instagram advertising</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900 rounded p-4">
            <p className="text-sm text-purple-600 dark:text-purple-400">
              <strong>Secure:</strong> We use OAuth 2.0 - we never see your passwords
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'Step 3: Generate Reports',
      description: 'AI analyzes the data and creates beautiful, branded reports',
      icon: <FileText className="h-12 w-12 text-green-600 dark:text-green-400" />,
      content: (
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI-Powered Insights</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  AI analyzes your data and generates insights automatically
                </p>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <p>• Performance summaries</p>
                  <p>• Trend analysis and recommendations</p>
                  <p>• Custom branding with your logo</p>
                  <p>• Professional PDF output</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="border border-gray-200 dark:border-gray-800 rounded p-4">
              <p className="text-2xl font-light text-gray-900 dark:text-white mb-1">2-5 min</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider">Generation Time</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded p-4">
              <p className="text-2xl font-light text-gray-900 dark:text-white mb-1">Unlimited</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider">Reports</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'You\'re All Set!',
      description: 'Ready to create your first report?',
      icon: <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Quick Start Checklist
            </h3>
            <div className="space-y-2 text-left max-w-md mx-auto">
              <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 rounded"></div>
                <span className="text-sm">Add your first client</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 rounded"></div>
                <span className="text-sm">Connect at least one data source</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 rounded"></div>
                <span className="text-sm">Customize your template (optional)</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 rounded"></div>
                <span className="text-sm">Generate your first report</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Link 
              to="/clients/new" 
              className="btn btn-primary flex-1 justify-center"
              onClick={handleClose}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add First Client
            </Link>
            <Link 
              to="/settings" 
              className="btn btn-secondary flex-1 justify-center"
              onClick={handleClose}
            >
              Customize Template
            </Link>
          </div>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] animate-fade-in">
      <div className="bg-white dark:bg-dark border border-gray-200 dark:border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {step.icon}
              <div>
                <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-1 uppercase">
                  {step.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step.content}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            {/* Progress Dots */}
            <div className="flex items-center space-x-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-blue-600 dark:bg-blue-400 w-8'
                      : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-light uppercase tracking-wider transition-colors"
                >
                  Previous
                </button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <>
                  <button
                    onClick={handleSkip}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-light uppercase tracking-wider transition-colors"
                  >
                    Skip Tour
                  </button>
                  <button
                    onClick={handleNext}
                    className="btn btn-primary text-sm py-2 px-6"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleClose}
                  className="btn btn-primary text-sm py-2 px-6"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
