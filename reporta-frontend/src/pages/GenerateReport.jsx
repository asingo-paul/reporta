import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, AlertCircle, CheckCircle, BarChart2, Target, Share2 } from 'lucide-react';
import { clientsAPI, reportsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import { format, subDays } from 'date-fns';

export default function GenerateReport() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  
  const [client, setClient] = useState(null);
  const [connections, setConnections] = useState([]);
  const [formData, setFormData] = useState({
    start_date: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      const [clientRes, connectionsRes] = await Promise.all([
        clientsAPI.get(clientId),
        clientsAPI.listConnections(clientId),
      ]);

      setClient(clientRes.data);
      setConnections(connectionsRes.data);
    } catch (error) {
      console.error('Failed to load client data:', error);
      setError('Failed to load client data');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (connections.length === 0) {
      setError('Please connect at least one data source before generating a report');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await reportsAPI.generate(clientId, formData);
      navigate(`/reports/${response.data.id}`);
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError(error.response?.data?.error || 'Failed to generate report');
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (isFetching) {
    return (
      <>
        <Navbar />
        <PageWrapper>
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        </PageWrapper>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Navbar />
        <PageWrapper>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="card text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Client not found</p>
              <Link to="/clients" className="btn btn-primary">
                Back to Clients
              </Link>
            </div>
          </div>
        </PageWrapper>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to={`/clients/${clientId}`} className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-xs uppercase tracking-wider">Back to {client.name}</span>
          </Link>

          <div className="card">
            <div className="flex items-start space-x-4 mb-6">
              <div className="h-12 w-12 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center flex-shrink-0">
                <FileText className="h-6 w-6 text-gray-900 dark:text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-1 uppercase">Generate Report</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">for {client.name}</p>
              </div>
            </div>

            {/* Connected Sources */}
            {connections.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4 mb-6">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-2 flex items-center uppercase tracking-wider">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Connected Data Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {connections.map((conn) => (
                    <span key={conn.id} className="inline-flex items-center px-3 py-1 border border-green-600 dark:border-green-700 rounded-full text-sm text-green-600 dark:text-green-400">
                      {conn.provider === 'ga4' && (
                        <>
                          <BarChart2 className="h-4 w-4 mr-1" />
                          Google Analytics 4
                        </>
                      )}
                      {conn.provider === 'google_ads' && (
                        <>
                          <Target className="h-4 w-4 mr-1" />
                          Google Ads
                        </>
                      )}
                      {conn.provider === 'meta' && (
                        <>
                          <Share2 className="h-4 w-4 mr-1" />
                          Meta Ads
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* No Connections Warning */}
            {connections.length === 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1 uppercase tracking-wider">No data sources connected</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500/80 mb-3">
                      You need to connect at least one data source before generating a report.
                    </p>
                    <Link
                      to={`/clients/${clientId}`}
                      className="btn btn-primary text-xs py-2 px-6"
                    >
                      Connect Data Sources
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="start_date" className="section-title flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Start Date *
                </label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="input"
                  max={formData.end_date}
                  required
                />
              </div>

              <div>
                <label htmlFor="end_date" className="section-title flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  End Date *
                </label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="input"
                  min={formData.start_date}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Report will include:</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Performance metrics from all connected data sources</li>
                <li>• AI-generated insights and recommendations</li>
                <li>• Visual charts and trend analysis</li>
                <li>• Executive summary</li>
              </ul>
            </div>

            <div className="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => navigate(`/clients/${clientId}`)}
                className="btn btn-secondary flex-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={isLoading || connections.length === 0}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      </PageWrapper>
    </>
  );
}
