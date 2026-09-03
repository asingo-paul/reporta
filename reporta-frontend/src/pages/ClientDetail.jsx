import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Trash2,
  BarChart2,
  Target,
  Share2
} from 'lucide-react';
import { clientsAPI, reportsAPI, integrationsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import ConfirmModal from '../components/ConfirmModal';
import ShareReportModal from '../components/ShareReportModal';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { formatSafeDate } from '../lib/formatDate';
import { downloadReportPdf } from '../lib/download';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [client, setClient] = useState(null);
  const [connections, setConnections] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // `revokeTarget` holds the connection pending confirmation — mirrors the
  // delete-confirmation pattern used on the Clients page.
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [isRevoking, setIsRevoking] = useState(false);
  // `deleteTarget` holds the report pending deletion — same confirmation
  // pattern as revoking a connection below.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  // `shareTarget` holds the report being shared (Email / WhatsApp).
  const [shareTarget, setShareTarget] = useState(null);

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
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      // Surface the backend's actual message (e.g. "this integration is not
      // configured on the server yet") so the user knows what to fix instead
      // of guessing.
      const reason = error.response?.data?.error;
      toast.error(
        reason
          ? `Unable to start ${provider.toUpperCase()} connection: ${reason}`
          : 'Failed to start connection. Please try again.'
      );
    }
  };

  // Opens the confirmation modal; the actual disconnect happens in
  // `confirmRevoke` once the user confirms.
  const handleRevokeConnection = (connection) => setRevokeTarget(connection);

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      await clientsAPI.revokeConnection(clientId, revokeTarget.id);
      setConnections(connections.filter(c => c.id !== revokeTarget.id));
      toast.success(`${revokeTarget.provider?.toUpperCase() || 'Connection'} disconnected successfully`);
      setRevokeTarget(null);
    } catch (error) {
      console.error('Failed to revoke connection:', error);
      toast.error('Failed to disconnect the integration. Please try again.');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDownload = async (report) => {
    try {
      await downloadReportPdf(report.id);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Permanent delete — confirmed via ConfirmModal before it runs, and logged
  // server-side so the removal shows up in the activity log.
  const confirmDeleteReport = async () => {
    if (!deleteTarget) return;
    setIsDeletingReport(true);
    try {
      await reportsAPI.delete(deleteTarget.id);
      setReports(reports.filter((r) => r.id !== deleteTarget.id));
      toast.success('Report deleted successfully');
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
      setDeleteTarget(null);
    } finally {
      setIsDeletingReport(false);
    }
  };

  if (isLoading) {
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="card text-center py-12">
              <p className="text-gray-600 dark:text-gray-600">Client not found</p>
              <Link to="/clients" className="btn btn-primary mt-4">
                Back to Clients
              </Link>
            </div>
          </div>
        </PageWrapper>
      </>
    );
  }

  const providers = [
    { id: 'ga4', name: 'Google Analytics 4', icon: BarChart2 },
    { id: 'google_ads', name: 'Google Ads', icon: Target },
    { id: 'meta', name: 'Meta (Facebook/Instagram)', icon: Share2 },
  ];

  const connectedProviders = connections.map(c => c.provider);

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link to="/clients" className="inline-flex items-center text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-900 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Link>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">{client.name}</h1>
                {client.email && <p className="text-gray-600 dark:text-gray-400">{client.email}</p>}
              </div>
              <Link to={`/clients/${clientId}/edit`} className="btn btn-secondary">
                Edit Client
              </Link>
            </div>
          </div>

          {/* Integrations */}
          <div className="card mb-8">
            <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">Data Integrations</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect data sources to generate comprehensive reports
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {providers.map((provider) => {
                const isConnected = connectedProviders.includes(provider.id);
                const connection = connections.find(c => c.provider === provider.id);
                const Icon = provider.icon;

                return (
                  <div key={provider.id} className="border border-gray-200 dark:border-gray-800 rounded p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                          <p className="font-light text-gray-900 dark:text-white uppercase tracking-wide text-sm">{provider.name}</p>
                          {isConnected && (
                            <span className="inline-flex items-center px-2 py-1 border border-green-600 dark:border-green-700 rounded-full text-xs text-green-600 dark:text-green-400 mt-1">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Connected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isConnected ? (
                      <button
                        onClick={() => handleRevokeConnection(connection)}
                        className="btn btn-secondary w-full text-sm border-red-600 text-red-600 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
              <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">Reports</h2>
              <Link 
                to={`/clients/${clientId}/reports/new`} 
                className="btn btn-primary inline-flex items-center"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Generate Report
              </Link>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">No reports yet</p>
                <Link to={`/clients/${clientId}/reports/new`} className="btn btn-primary">
                  Generate First Report
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    onDownload={() => handleDownload(report)}
                    onShare={() => setShareTarget(report)}
                    onDelete={() => setDeleteTarget(report)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageWrapper>

      {/* Disconnect confirmation — destructive, so it always asks first */}
      {revokeTarget && (
        <ConfirmModal
          title="Disconnect Integration"
          message={
            <p>
              Are you sure you want to disconnect{' '}
              <strong className="text-gray-900 dark:text-white">
                {revokeTarget.provider?.toUpperCase() || 'this provider'}
              </strong>{' '}
              from <strong className="text-gray-900 dark:text-white">{client.name}</strong>? New
              reports won't be able to pull data until it's reconnected.
            </p>
          }
          confirmLabel="Disconnect"
          onConfirm={confirmRevoke}
          onCancel={() => setRevokeTarget(null)}
          busy={isRevoking}
        />
      )}

      {/* Share via Email / WhatsApp */}
      {shareTarget && (
        <ShareReportModal
          report={shareTarget}
          clientName={client.name}
          initialEmail={client.email}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* Delete confirmation — permanent, so it always asks first */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Report"
          message={
            <p>
              Are you sure you want to permanently delete the report for{' '}
              <strong className="text-gray-900 dark:text-white">
                {formatSafeDate(deleteTarget.period_start)} - {formatSafeDate(deleteTarget.period_end)}
              </strong>{' '}
              on <strong className="text-gray-900 dark:text-white">{client.name}</strong>? This
              cannot be undone.
            </p>
          }
          confirmLabel="Delete Report"
          onConfirm={confirmDeleteReport}
          onCancel={() => setDeleteTarget(null)}
          busy={isDeletingReport}
        />
      )}
    </>
  );
}

function ReportRow({ report, onDownload, onShare, onDelete }) {
  const getStatusBadge = (status) => {
    const badges = {
      completed: { class: 'border-green-600 text-green-600 dark:border-green-700 dark:text-green-400', icon: CheckCircle, text: 'Completed' },
      pulling_data: { class: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400', icon: Clock, text: 'Pulling Data' },
      analyzing: { class: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400', icon: Clock, text: 'Analyzing' },
      rendering: { class: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400', icon: Clock, text: 'Building PDF' },
      processing: { class: 'border-yellow-600 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400', icon: Clock, text: 'Processing' },
      pending: { class: 'border-yellow-600 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400', icon: Clock, text: 'Pending' },
      failed: { class: 'border-red-600 text-red-600 dark:border-red-700 dark:text-red-400', icon: AlertCircle, text: 'Failed' },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 border rounded-full text-sm ${badge.class}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  // Download & share need the generated PDF, so they stay visible but are
  // disabled (with an explanatory tooltip) until the report is completed.
  const isReady = report.status === 'completed';
  const readyButtonClass = 'p-2 border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors';
  const disabledButtonClass = 'p-2 border border-gray-200 dark:border-gray-800 rounded text-gray-300 dark:text-gray-600 cursor-not-allowed';

  // The info area is the link; the action buttons sit outside it so we never
  // nest interactive elements inside an anchor.
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded hover:bg-gray-100 dark:hover:bg-dark-50 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      <Link to={`/reports/${report.id}`} className="flex-1 min-w-0">
        <p className="font-light text-gray-900 dark:text-white uppercase tracking-wide">
          {formatSafeDate(report.period_start)} - {formatSafeDate(report.period_end)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Created {format(new Date(report.created_at), 'MMM d, yyyy')}
        </p>
      </Link>
      <div className="flex items-center space-x-3 flex-shrink-0">
        {getStatusBadge(report.status)}
        <button
          onClick={onDownload}
          disabled={!isReady}
          aria-label="Download PDF"
          title={isReady ? 'Download PDF' : 'Report not ready yet'}
          className={isReady ? readyButtonClass : disabledButtonClass}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={onShare}
          disabled={!isReady}
          aria-label="Share report"
          title={isReady ? 'Share via Email or WhatsApp' : 'Report not ready yet'}
          className={isReady ? readyButtonClass : disabledButtonClass}
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete report"
          title="Delete report"
          className="p-2 border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-600 dark:hover:border-red-700 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
