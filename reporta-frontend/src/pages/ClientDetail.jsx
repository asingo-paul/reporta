import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Plus, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { clientsAPI, reportsAPI, integrationsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import { format } from 'date-fns';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [connections, setConnections] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      const [clientRes, connectionsRes, reportsRes] = await Promise.all([
        clientsAPI.get(clientId),
        clientsAPI.listConnections(clientId),
        reportsAPI.list(clientId),
      ]);

      setClient(clientRes.data);
      setConnections(connectionsRes.data);
      setReports(reportsRes.data);
    } catch (error) {
      console.error('Failed to load client data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (provider) => {
    try {
      const response = await integrationsAPI.authorize(provider, clientId);
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
    }
  };

  const handleRevokeConnection = async (connectionId) => {
    if (!confirm('Are you sure you want to revoke this connection?')) return;

    try {
      await clientsAPI.revokeConnection(clientId, connectionId);
      setConnections(connections.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Failed to revoke connection:', error);
    }
  };

  if (isLoading) {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card text-center py-12">
            <p className="text-gray-600">Client not found</p>
            <Link to="/clients" className="btn btn-primary mt-4">
              Back to Clients
            </Link>
          </div>
        </div>
      </>
    );
  }

  const providers = [
    { id: 'ga4', name: 'Google Analytics 4', logo: '📊' },
    { id: 'google_ads', name: 'Google Ads', logo: '🎯' },
    { id: 'meta', name: 'Meta (Facebook/Instagram)', logo: '📱' },
  ];

  const connectedProviders = connections.map(c => c.provider);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/clients" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{client.name}</h1>
              {client.email && <p className="text-gray-600">{client.email}</p>}
            </div>
            <Link to={`/clients/${clientId}/edit`} className="btn btn-outline">
              Edit Client
            </Link>
          </div>
        </div>

        {/* Integrations */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Data Integrations</h2>
          <p className="text-gray-600 mb-6">
            Connect data sources to generate comprehensive reports
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map((provider) => {
              const isConnected = connectedProviders.includes(provider.id);
              const connection = connections.find(c => c.provider === provider.id);

              return (
                <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{provider.logo}</span>
                      <div>
                        <p className="font-medium text-gray-900">{provider.name}</p>
                        {isConnected && (
                          <span className="badge badge-success text-xs mt-1">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isConnected ? (
                    <button
                      onClick={() => handleRevokeConnection(connection.id)}
                      className="btn btn-outline w-full text-sm text-red-600 hover:bg-red-50 border-red-200"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(provider.id)}
                      className="btn btn-primary w-full text-sm"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reports */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Reports</h2>
            <Link 
              to={`/clients/${clientId}/reports/new`} 
              className="btn btn-primary inline-flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Link>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No reports yet</p>
              <Link to={`/clients/${clientId}/reports/new`} className="btn btn-primary">
                Generate First Report
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReportRow({ report }) {
  const getStatusBadge = (status) => {
    const badges = {
      completed: { class: 'badge-success', icon: CheckCircle, text: 'Completed' },
      processing: { class: 'badge-warning', icon: Clock, text: 'Processing' },
      pending: { class: 'badge-warning', icon: Clock, text: 'Pending' },
      failed: { class: 'badge-error', icon: AlertCircle, text: 'Failed' },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`badge ${badge.class}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  return (
    <Link
      to={`/reports/${report.id}`}
      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div>
        <p className="font-medium text-gray-900">
          {format(new Date(report.start_date), 'MMM d, yyyy')} - {format(new Date(report.end_date), 'MMM d, yyyy')}
        </p>
        <p className="text-sm text-gray-600">
          Created {format(new Date(report.created_at), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="flex items-center space-x-3">
        {getStatusBadge(report.status)}
        <ExternalLink className="h-4 w-4 text-gray-400" />
      </div>
    </Link>
  );
}
