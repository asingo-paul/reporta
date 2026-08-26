import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Edit2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Users,
  MousePointer,
  Eye,
  DollarSign
} from 'lucide-react';
import { reportsAPI, clientsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import { ReportDetailSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';

export default function ReportDetail() {
  const { reportId } = useParams();
  const toast = useToast();
  
  const [report, setReport] = useState(null);
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  useEffect(() => {
    loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const loadReportData = async () => {
    try {
      const reportRes = await reportsAPI.get(reportId);
      setReport(reportRes.data);
      setEditedSummary(reportRes.data.ai_summary || '');

      // Load client data
      const clientRes = await clientsAPI.get(reportRes.data.client_id);
      setClient(clientRes.data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to the backend's live SSE status feed while the report is not
  // yet in a terminal state, so the progress banner reflects *real* stages
  // ("Pulling data... Analyzing trends... Building PDF...") instead of a
  // static "queued/processing" snapshot.
  useEffect(() => {
    if (!report) return;
    const status = report.status;
    if (status === 'completed' || status === 'failed') return;

    const cancel = reportsAPI.streamStatus(
      reportId,
      {
        onEvent: (payload) => {
          setReport((prev) => ({
            ...prev,
            status: payload.status ?? prev.status,
            progress_message: payload.progress_message ?? prev.progress_message,
            error: payload.error ?? prev.error,
          }));
          // Reach a terminal state via the stream -> refresh the full record
          // so the details/PDF area unlocks.
          if (payload.status === 'completed' || payload.status === 'failed') {
            reportsAPI.get(reportId).then((res) => setReport(res.data)).catch(() => {});
          }
        },
        onError: (err) => console.error('Status stream error:', err),
      }
    );
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, report?.status]);

  const handleSaveSummary = async () => {
    setIsSaving(true);
    try {
      await reportsAPI.updateSummary(reportId, { ai_summary: editedSummary });
      setReport(prev => ({ ...prev, ai_summary: editedSummary }));
      setIsEditing(false);
      toast.success('Summary updated successfully!');
    } catch (error) {
      console.error('Failed to update summary:', error);
      toast.error('Failed to update summary');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await reportsAPI.downloadPDF(reportId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <PageWrapper>
          <ReportDetailSkeleton />
        </PageWrapper>
      </>
    );
  }

  if (!report) {
    return (
      <>
        <Navbar />
        <PageWrapper>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="card text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Report not found</p>
              <Link to="/dashboard" className="btn btn-primary">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </PageWrapper>
      </>
    );
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'border-yellow-600 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400', icon: Clock, text: 'Queued' },
      pulling_data: { class: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400', icon: Clock, text: 'Pulling Data' },
      analyzing: { class: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400', icon: Clock, text: 'Analyzing' },
      rendering: { class: 'border-blue-600 text-blue-600 dark:border-blue-700 dark:text-blue-400', icon: Clock, text: 'Building PDF' },
      completed: { class: 'border-green-600 text-green-600 dark:border-green-700 dark:text-green-400', icon: CheckCircle, text: 'Completed' },
      failed: { class: 'border-red-600 text-red-600 dark:border-red-700 dark:text-red-400', icon: AlertCircle, text: 'Failed' },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 border rounded-full text-sm ${badge.class}`}>
        <Icon className="h-4 w-4 mr-1" />
        {badge.text}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              to={client ? `/clients/${client.id}` : '/dashboard'}
              className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-xs uppercase tracking-wider">Back to {client ? client.name : 'Dashboard'}</span>
            </Link>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white uppercase">Report Details</h1>
                  {getStatusBadge(report.status)}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(report.start_date), 'MMM d, yyyy')} - {format(new Date(report.end_date), 'MMM d, yyyy')}
                  </span>
                  <span>Created {format(new Date(report.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>

              {report.status === 'completed' && (
                <div className="flex space-x-3 mt-4 md:mt-0">
                  <button onClick={handleDownloadPDF} className="btn btn-secondary inline-flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                  <button onClick={() => setShowSendModal(true)} className="btn btn-primary inline-flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Send to Client
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          {report.status === 'completed' && (
            <div className="card mb-8">
              <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">Key Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  icon={<Users className="h-6 w-6" />}
                  label="Total Users"
                  value="12,450"
                  change="+12.5%"
                  trend="up"
                />
                <MetricCard 
                  icon={<Eye className="h-6 w-6" />}
                  label="Page Views"
                  value="45,230"
                  change="+8.3%"
                  trend="up"
                />
                <MetricCard 
                  icon={<MousePointer className="h-6 w-6" />}
                  label="Click Rate"
                  value="3.2%"
                  change="-2.1%"
                  trend="down"
                />
                <MetricCard 
                  icon={<DollarSign className="h-6 w-6" />}
                  label="Revenue"
                  value="$8,420"
                  change="+15.8%"
                  trend="up"
                />
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">AI Summary</h2>
              {report.status === 'completed' && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-secondary text-xs py-2 px-6 inline-flex items-center"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-dark border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition-all rounded min-h-[200px]"
                  placeholder="Edit the AI-generated summary..."
                />
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedSummary(report.ai_summary || '');
                    }}
                    className="btn btn-secondary inline-flex items-center"
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSummary}
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
                        <Save className="h-4 w-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none">
                {report.ai_summary ? (
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{report.ai_summary}</p>
                ) : report.status === 'completed' ? (
                  <p className="text-gray-500 dark:text-gray-500 italic">No summary available</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-500 italic">Summary will be generated when the report is complete</p>
                )}
              </div>
            )}
          </div>

          {/* Processing Status - driven by the live SSE feed */}
          {(report.status === 'pending' || report.status === 'pulling_data' || report.status === 'analyzing' || report.status === 'rendering') && (
            <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider">
                    {report.progress_message || 'Report is being generated...'}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-500/80">
                    This may take a few minutes. You'll be notified when it's ready.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Failed Status */}
          {report.status === 'failed' && (
            <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400 mb-1 uppercase tracking-wider">
                    Report Failed
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500/80">
                    {report.error || 'There was an error generating this report. Please try again.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageWrapper>

      {/* Send Email Modal */}
      {showSendModal && (
        <SendEmailModal
          reportId={reportId}
          clientEmail={client?.email}
          clientName={client?.name}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </>
  );
}

function MetricCard({ icon, label, value, change, trend }) {
  const isPositive = trend === 'up';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="text-gray-600 dark:text-gray-400">{icon}</div>
        <TrendIcon className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-light text-gray-900 dark:text-white mb-1">{value}</p>
      <p className={`text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {change}
      </p>
    </div>
  );
}

function SendEmailModal({ reportId, clientEmail, clientName, onClose }) {
  const toast = useToast();
  const [email, setEmail] = useState(clientEmail || '');
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    setIsSending(true);

    try {
      // Backend contract: `SendReportRequest` requires `to_email` + `to_name`.
      await reportsAPI.send(reportId, {
        to_email: email,
        to_name: clientName || email.split('@')[0] || 'Client',
      });
      setSuccess(true);
      toast.success('Report sent successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      console.error('Failed to send report:', error);
      toast.error(error.response?.data?.error || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded max-w-lg w-full p-6 animate-slide-up">
        <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">Send Report via Email</h3>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <p className="text-green-600 dark:text-green-400 font-medium">Email sent successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label htmlFor="email" className="section-title">
                Recipient Email *
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="client@example.com"
                required
              />
            </div>

            <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary flex-1"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1 inline-flex items-center justify-center"
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
