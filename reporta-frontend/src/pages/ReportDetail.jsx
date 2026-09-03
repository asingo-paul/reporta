import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Edit2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Share2,
  Trash2
} from 'lucide-react';
import { reportsAPI, clientsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import ConfirmModal from '../components/ConfirmModal';
import ShareReportModal from '../components/ShareReportModal';
import ProgressSteps from '../components/ProgressSteps';
import { ReportDetailSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { formatSafeDate } from '../lib/formatDate';
import { downloadReportPdf } from '../lib/download';

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [report, setReport] = useState(null);
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      await downloadReportPdf(reportId);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Permanent delete — confirmed via ConfirmModal before it runs, and logged
  // server-side so the removal shows up in the activity log.
  const handleDeleteReport = async () => {
    setIsDeleting(true);
    try {
      await reportsAPI.delete(reportId);
      toast.success('Report deleted successfully');
      navigate(client ? `/clients/${client.id}` : '/dashboard');
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
      setIsDeleting(false);
      setShowDeleteModal(false);
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

  // Download & share need the generated PDF, so they stay visible but are
  // disabled (with an explanatory tooltip) until the report is completed.
  const isReady = report.status === 'completed';
  // The computed metric table the PDF was rendered from (single source of truth).
  const metrics = Array.isArray(report.metrics_json) ? report.metrics_json : [];
  const aiRecommendations = Array.isArray(report.ai_recommendations) ? report.ai_recommendations : [];
  const breakdowns = Array.isArray(report.breakdowns_json) ? report.breakdowns_json : [];

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
                    {formatSafeDate(report.period_start)} - {formatSafeDate(report.period_end)}
                  </span>
                  <span>Created {format(new Date(report.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                <button
                  onClick={handleDownloadPDF}
                  disabled={!isReady}
                  className="btn btn-secondary inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  disabled={!isReady}
                  className="btn btn-primary inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  aria-label="Delete report"
                  title="Delete report"
                  className="btn btn-secondary inline-flex items-center border-red-600 text-red-600 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics — built from the exact table the PDF was rendered from */}
          {report.status === 'completed' && (
            <div className="card mb-8">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">Key Metrics</h2>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {formatSafeDate(report.period_start)} – {formatSafeDate(report.period_end)} vs. prior period
                </span>
              </div>

              {metrics.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-500 italic">
                  No metrics were returned by the connected sources for this period.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {metrics.slice(0, 4).map((m) => (
                      <MetricCard
                        key={m.key}
                        label={m.label}
                        value={m.current}
                        change={m.change}
                        trend={m.delta_pct == null ? 'flat' : m.delta_pct > 0 ? 'up' : m.delta_pct < 0 ? 'down' : 'flat'}
                      />
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500">
                          <th className="py-2 pr-4 font-medium">Metric</th>
                          <th className="py-2 px-4 font-medium text-right">This period</th>
                          <th className="py-2 px-4 font-medium text-right">Previous</th>
                          <th className="py-2 pl-4 font-medium text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((m) => {
                          const dir = m.delta_pct == null ? 'flat' : m.delta_pct > 0 ? 'up' : m.delta_pct < 0 ? 'down' : 'flat';
                          const color =
                            dir === 'up'
                              ? 'text-green-600 dark:text-green-400'
                              : dir === 'down'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500 dark:text-gray-500';
                          return (
                            <tr key={m.key} className="border-b border-gray-100 dark:border-gray-900">
                              <td className="py-2.5 pr-4 text-gray-900 dark:text-white">{m.label}</td>
                              <td className="py-2.5 px-4 text-right tabular-nums text-gray-900 dark:text-white">{m.current}</td>
                              <td className="py-2.5 px-4 text-right tabular-nums text-gray-600 dark:text-gray-400">{m.previous}</td>
                              <td className={`py-2.5 pl-4 text-right tabular-nums font-medium ${color}`}>
                                {dir === 'up' ? '▲ ' : dir === 'down' ? '▼ ' : ''}
                                {m.change}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {metrics.every((m) => m.delta_pct == null) && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                      No prior-period data was available for comparison.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Segment breakdowns */}
          {report.status === 'completed' && breakdowns.length > 0 && (
            <div className="card mb-8">
              <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">Breakdowns</h2>
              <div className="space-y-8">
                {breakdowns.map((section, si) => (
                  <div key={si}>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{section.title}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500">
                            {section.columns.map((c, ci) => (
                              <th key={ci} className={`py-2 font-medium ${ci === 0 ? 'pr-4' : 'px-4 text-right'}`}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row, ri) => (
                            <tr key={ri} className="border-b border-gray-100 dark:border-gray-900">
                              {row.map((cell, ci) => (
                                <td key={ci} className={`py-2 ${ci === 0 ? 'pr-4 text-gray-900 dark:text-white' : 'px-4 text-right tabular-nums text-gray-600 dark:text-gray-400'}`}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
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

            {report.status === 'completed' && report.ai_summary_is_fallback && (
              <div className="mb-4 flex items-start space-x-2 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>AI summary was unavailable — this is a template-generated summary. Review and edit it before sending.</span>
              </div>
            )}

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
              <div className="space-y-6">
                {report.ai_summary ? (
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{report.ai_summary}</p>
                ) : report.status === 'completed' ? (
                  <p className="text-gray-500 dark:text-gray-500 italic">No summary available</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-500 italic">Summary will be generated when the report is complete</p>
                )}

                {aiRecommendations.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">Recommendations</h3>
                    <ol className="list-decimal pl-5 space-y-1.5 text-gray-700 dark:text-gray-300 leading-relaxed">
                      {aiRecommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {report.ai_conclusion && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">Conclusion</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{report.ai_conclusion}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Processing Status - interactive stepper driven by the live SSE feed */}
          {(report.status === 'pending' || report.status === 'pulling_data' || report.status === 'analyzing' || report.status === 'rendering') && (
            <div className="mb-8">
              <ProgressSteps
                status={report.status}
                progressMessage={report.progress_message}
                createdAt={report.created_at}
              />
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

      {/* Share via Email / WhatsApp */}
      {showShareModal && (
        <ShareReportModal
          report={report}
          clientName={client?.name}
          initialEmail={client?.email}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Delete confirmation — permanent, so it always asks first */}
      {showDeleteModal && (
        <ConfirmModal
          title="Delete Report"
          message={
            <p>
              Are you sure you want to permanently delete the report for{' '}
              <strong className="text-gray-900 dark:text-white">
                {formatSafeDate(report.period_start)} - {formatSafeDate(report.period_end)}
              </strong>
              {report.sent_at ? ' (this report was already sent to the client)' : ''}? Its PDF and
              data will be removed. This action cannot be undone.
            </p>
          }
          confirmLabel="Delete Report"
          onConfirm={handleDeleteReport}
          onCancel={() => setShowDeleteModal(false)}
          busy={isDeleting}
        />
      )}
    </>
  );
}

function MetricCard({ label, value, change, trend }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const tone =
    trend === 'up'
      ? 'text-green-600 dark:text-green-400'
      : trend === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-500';

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <TrendIcon className={`h-4 w-4 flex-shrink-0 ${tone}`} />
      </div>
      <p className="text-2xl font-light text-gray-900 dark:text-white mb-1 tabular-nums">{value}</p>
      <p className={`text-xs font-medium tabular-nums ${tone}`}>{change}</p>
    </div>
  );
}
