import { Link } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Plug, 
  Search,
  Package,
  BarChart2
} from 'lucide-react';

export function EmptyClients() {
  return (
    <div className="card text-center py-16">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <Users className="h-10 w-10 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-3 uppercase">
          No Clients Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          Get started by adding your first client. You'll be able to connect their marketing accounts 
          and generate beautiful AI-powered reports.
        </p>
        <Link to="/clients/new" className="btn btn-primary inline-flex items-center">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Your First Client
        </Link>
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 uppercase tracking-wider">
            What happens next?
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Add Client</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Create a client profile</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Connect Accounts</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Link GA4, Ads, Meta</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Generate Reports</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">AI creates insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyReports({ clientName, clientId }) {
  return (
    <div className="card text-center py-12">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
          No Reports Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {clientName ? `Generate your first report for ${clientName}` : 'Create your first report'}
        </p>
        <Link 
          to={clientId ? `/clients/${clientId}/reports/new` : '/clients'} 
          className="btn btn-primary inline-flex items-center"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate Report
        </Link>
      </div>
    </div>
  );
}

export function EmptyConnections() {
  return (
    <div className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900 text-center py-12">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Plug className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
          No Integrations Connected
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Connect Google Analytics, Google Ads, or Meta to start generating reports with real data
        </p>
        <div className="inline-flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
          <Plug className="h-4 w-4" />
          <span>Click "Connect" on any integration above to get started</span>
        </div>
      </div>
    </div>
  );
}

export function EmptySearch({ query }) {
  return (
    <div className="card text-center py-12">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="h-8 w-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
          No Results Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          No clients match "<strong>{query}</strong>". Try a different search term.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Clear search
        </button>
      </div>
    </div>
  );
}

export function EmptyDashboard() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card text-center py-16">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <BarChart2 className="h-12 w-12 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
          Welcome to Reporta
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
          Your AI-powered marketing reporting platform. Let's get you set up in just a few minutes.
        </p>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2 uppercase tracking-wide">1. Add Clients</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create profiles for each client you want to generate reports for
            </p>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
              <Plug className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2 uppercase tracking-wide">2. Connect Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Link Google Analytics, Google Ads, and Meta advertising accounts
            </p>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2 uppercase tracking-wide">3. Generate Reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI analyzes the data and creates beautiful branded reports
            </p>
          </div>
        </div>

        <Link to="/clients/new" className="btn btn-primary inline-flex items-center text-lg px-10 py-4">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Get Started - Add Your First Client
        </Link>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Need help?{' '}
            <Link to="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">
              Contact support
            </Link>
            {' '}or{' '}
            <button className="text-blue-600 dark:text-blue-400 hover:underline">
              watch tutorial
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyTemplates() {
  return (
    <div className="card text-center py-12">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="h-8 w-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
          Customize Your Brand
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Add your company logo and brand colors to personalize all reports
        </p>
        <Link to="/settings" className="btn btn-primary inline-flex items-center">
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Configure Template
        </Link>
      </div>
    </div>
  );
}
