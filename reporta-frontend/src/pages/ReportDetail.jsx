import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { reportsAPI, clientsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import { format } from 'date-fns';

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  
  const [report, setReport] = useState(null);
  const [client, setClient] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  useEffect(() => {
    loadReportData();
  }, [reportId]);

  const loadReportData = async () => {
    try {
      const [reportRes, eventsRes] = await Promise.all([
        reportsAPI.get(reportId),
        reportsAPI.getEvents(reportId),
      ]);

      setReport(reportRes.data);
      setEvents(eventsRes.data);
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

  const handleSaveSummary = async () => {
    setIsSaving(true);
    try {
      await reportsAPI.updateSummary(reportId, { ai_summary: editedSummary });
      setReport(prev => ({ ...prev, ai_summary: editedSummary }));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update summary:', error);
      alert('Failed to update summary');
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
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF');
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

  if (!report) {
    return (
      <>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card text-center py-12">
            <p className="text-gray-600 mb-4">Report not found</p>
            <Link to="/dashboard" className="btn btn-primary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

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
        <Icon className="h-4 w-4 mr-1" />
        {badge.text}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={client ? `/clients/${client.id}` : '/dashboard'}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {client ? client.name : 'Dashboard'}
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">Report Details</h1>
                {getStatusBadge(report.status)}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {format(new Date(report.start_date), 'MMM d, yyyy')} - {format(new Date(report.end_date), 'MMM d, yyyy')}
                </span>
                <span>Created {format(new Date(report.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>

            {report.status === 'completed' && (
              <div className="flex space-x-3 mt-4 md:mt-0">
                <button onClick={handleDownloadPDF} className="btn btn-outline inline-flex items-center">
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

        {/* AI Summary */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">AI Summary</h2>
            {report.status === 'completed' && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-sm btn-outline inline-flex items-center"
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
                className="input min-h-[200px]"
                placeholder="Edit the AI-generated summary..."
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSummary(report.ai_summary || '');
                  }}
                  className="btn btn-outline inline-flex items-center"
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                <p className="text-gray-700 whitespace-pre-wrap">{report.ai_summary}</p>
              ) : report.status === 'completed' ? (
                <p className="text-gray-500 italic">No summary available</p>
              ) : (
                <p className="text-gray-500 italic">Summary will be generated when the report is complete</p>
              )}
            </div>
          )}
        </div>

        {/* Events/Metrics */}
        {events.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Report Data</h2>
            <div className="space-y-3">
              {events.map((event, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{event.metric_name || 'Metric'}</p>
                      <p className="text-sm text-gray-600 mt-1">{event.description || 'No description'}</p>
                    </div>
                    {event.value && (
                      <span className="text-2xl font-bold text-primary-600 ml-4">
                        {typeof event.value === 'number' ? event.value.toLocaleString() : event.value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Status */}
        {report.status !== 'completed' && (
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-start space-x-3">
              <Clock className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="font-medium text-blue-900 mb-1">
                  {report.status === 'processing' ? 'Report is being generated...' : 'Report is queued...'}
                </p>
                <p className="text-sm text-blue-700">
                  This may take a few minutes. You'll be notified when it's ready.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send Email Modal */}
      {showSendModal && (
        <SendEmailModal
          reportId={reportId}
          clientEmail={client?.email}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </>
  );
}

function SendEmailModal({ reportId, clientEmail, onClose }) {
  const [email, setEmail] = useState(clientEmail || '');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setError('');

    try {
      await reportsAPI.send(reportId, { recipient_email: email, message });
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      console.error('Failed to send report:', error);
      setError(error.response?.data?.error || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 animate-slide-up">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Send Report via Email</h3>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-green-700 font-medium">Email sent successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
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

            <div>
              <label htmlFor="message" className="label">
                Message (Optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input min-h-[100px]"
                placeholder="Add a personal message..."
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline flex-1"
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
