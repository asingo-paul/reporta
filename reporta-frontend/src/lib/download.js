import { reportsAPI } from './api';

/**
 * Fetches a report's PDF from the backend (blob response) and triggers a
 * browser save. Shared by the list views (Dashboard, ClientDetail) and the
 * report detail page so download behavior stays identical everywhere:
 * same filename, same MIME type, object URL always cleaned up.
 *
 * Throws on failure — callers are responsible for toast/error handling.
 */
export async function downloadReportPdf(reportId) {
  const response = await reportsAPI.downloadPDF(reportId);
  const url = window.URL.createObjectURL(
    new Blob([response.data], { type: 'application/pdf' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `report-${reportId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}