import { useState } from 'react';
import { CheckCircle, Mail, MessageCircle, X } from 'lucide-react';
import { reportsAPI } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { formatSafeDate } from '../lib/formatDate';

/**
 * Builds the default WhatsApp message (editable by the user before sharing).
 */
function defaultWhatsAppMessage(clientName, report) {
  return [
    'Hi!',
    '',
    `Here's your report${clientName ? ` for ${clientName}` : ''} covering`,
    `${formatSafeDate(report.period_start)} to ${formatSafeDate(report.period_end)}.`,
    '',
    'Let me know if you have any questions.',
  ].join('\n');
}

/**
 * "Share Report" modal with two delivery channels:
 *
 *  - Email:    sends the PDF as an attachment through the backend's
 *              `POST /reports/:id/send` endpoint (branded, recorded in the
 *              activity log, marks the report as sent).
 *  - WhatsApp: opens `wa.me` with a pre-filled — and editable — message so
 *              the user just picks the recipient chat. The PDF itself can't
 *              be attached via a deep link, so the message describes the
 *              report (client + period).
 */
export default function ShareReportModal({
  report,
  clientName = '',
  initialEmail = '',
  onClose,
}) {
  const toast = useToast();
  const [channel, setChannel] = useState('email');
  const [email, setEmail] = useState(initialEmail || '');
  const [message, setMessage] = useState(() => defaultWhatsAppMessage(clientName, report));
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setIsSending(true);
    try {
      // Backend contract: `SendReportRequest` requires `to_email` + `to_name`.
      await reportsAPI.send(report.id, {
        to_email: email,
        to_name: email.split('@')[0] || clientName || 'Client',
      });
      setSent(true);
      toast.success('Report sent by email successfully!');
      setTimeout(onClose, 1500);
    } catch (error) {
      console.error('Failed to send report:', error);
      toast.error(error.response?.data?.error || 'Failed to send email');
      setIsSending(false);
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const channelButtonClass = (active) =>
    `flex-1 inline-flex items-center justify-center py-2.5 px-4 rounded border text-sm uppercase tracking-wider transition-colors ${
      active
        ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white bg-gray-100 dark:bg-white/5'
        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
    }`;
return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded max-w-lg w-full p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">
            Share Report
          </h3>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={channelButtonClass(channel === 'email')}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={channelButtonClass(channel === 'whatsapp')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp
          </button>
        </div>

        {sent ? (
<div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <p className="text-green-600 dark:text-green-400 font-medium">
              Report sent successfully!
            </p>
          </div>
        ) : channel === 'email' ? (
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div>
              <label htmlFor="share-email" className="section-title">
                Recipient Email *
              </label>
              <input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="client@example.com"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                The report PDF is attached and sent with your agency branding.
              </p>
            </div>

            <div className="flex space-x-3">
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
        ) : (
<div className="space-y-4">
            <div>
              <label htmlFor="share-whatsapp" className="section-title">
                Message
              </label>
              <textarea
                id="share-whatsapp"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="input w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Opens WhatsApp with this message — just pick the contact to
                send it to.
              </p>
            </div>

            <button
              onClick={handleWhatsApp}
              className="btn w-full inline-flex items-center justify-center"
              style={{
                backgroundColor: '#25D366',
                borderColor: '#25D366',
                color: '#fff',
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Share on WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}