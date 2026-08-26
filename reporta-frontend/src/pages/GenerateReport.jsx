import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, AlertCircle } from 'lucide-react';
import { clientsAPI, reportsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card text-center py-12">
            <p className="text-gray-600 mb-4">Client not found</p>
            <Link to="/clients" className="btn btn-primary">
              Back to Clients
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to={`/clients/${clientId}`} className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {client.name}
        </Link>

        <div className="card">
          <div className="flex items-start space-x-4 mb-6">
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Generate Report</h1>
              <p className="text-gray-600">for {client.name}</p>
            </div>
          </div>

          {/* Connected Sources */}
          {connections.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-green-900 mb-2">Connected Data Sources</p>
              <div className="flex flex-wrap gap-2">
                {connections.map((conn) => (
                  <span key={conn.id} className="badge badge-success">
                    {conn.provider === 'ga4' && '📊 Google Analytics 4'}
                    {conn.provider === 'google_ads' && '🎯 Google Ads'}
                    {conn.provider === 'meta' && '📱 Meta Ads'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No Connections Warning */}
          {connections.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 mb-1">No data sources connected</p>
                  <p className="text-sm text-yellow-700 mb-3">
                    You need to connect at least one data source before generating a report.
                  </p>
                  <Link
                    to={`/clients/${clientId}`}
                    className="btn btn-sm bg-yellow-600 text-white hover:bg-yellow-700"
                  >
                    Connect Data Sources
                  </Link>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="start_date" className="label">
                  <Calendar className="h-4 w-4 mr-2 inline" />
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
                <label htmlFor="end_date" className="label">
                  <Calendar className="h-4 w-4 mr-2 inline" />
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

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Report will include:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Performance metrics from all connected data sources</li>
                <li>• AI-generated insights and recommendations</li>
                <li>• Visual charts and trend analysis</li>
                <li>• Executive summary</li>
              </ul>
            </div>

            <div className="flex space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => navigate(`/clients/${clientId}`)}
                className="btn btn-outline flex-1"
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
    </>
  );
}
