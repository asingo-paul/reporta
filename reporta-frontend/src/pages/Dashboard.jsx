import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { clientsAPI, reportsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import { EmptyDashboard } from '../components/EmptyStates';
import OnboardingModal from '../components/OnboardingModal';
import { format } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    recentReports: [],
    pendingReports: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const clientsResponse = await clientsAPI.list();
      const clients = clientsResponse.data;

      // Fetch recent reports from all clients
      const reportsPromises = clients.slice(0, 5).map(client =>
        reportsAPI.list(client.id).catch(() => ({ data: [] }))
      );
      const reportsResponses = await Promise.all(reportsPromises);
      
      const allReports = reportsResponses.flatMap((res, idx) => 
        res.data.map(report => ({
          ...report,
          clientName: clients[idx]?.name || 'Unknown',
        }))
      );

      const sortedReports = allReports
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      const pendingCount = allReports.filter(r => r.status === 'pending' || r.status === 'processing').length;

      setStats({
        totalClients: clients.length,
        recentReports: sortedReports,
        pendingReports: pendingCount,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <PageWrapper>
          <DashboardSkeleton />
        </PageWrapper>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <PageWrapper>
        <OnboardingModal />
        {stats.totalClients === 0 ? (
          <EmptyDashboard />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening with your reports.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={<Users className="h-8 w-8 text-primary-600" />}
            title="Total Clients"
            value={stats.totalClients}
            link="/clients"
            linkText="Manage clients"
          />
          <StatCard
            icon={<FileText className="h-8 w-8 text-green-600" />}
            title="Recent Reports"
            value={stats.recentReports.length}
            link="#recent"
            linkText="View all"
          />
          <StatCard
            icon={<Clock className="h-8 w-8 text-yellow-600" />}
            title="Pending Reports"
            value={stats.pendingReports}
            link="#recent"
            linkText="View pending"
          />
        </div>

        {/* Quick Actions */}
        <div className="card mb-8">
          <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/clients/new"
              className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-800 rounded hover:bg-gray-100 dark:hover:bg-dark-50 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="h-10 w-10 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center">
                <svg className="h-5 w-5 text-gray-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="font-light text-gray-900 dark:text-white uppercase tracking-wider text-sm">Add New Client</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Create a client profile</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 ml-auto" />
            </Link>

            <Link
              to="/clients"
              className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-800 rounded hover:bg-gray-100 dark:hover:bg-dark-50 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="h-10 w-10 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center">
                <FileText className="h-5 w-5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <p className="font-light text-gray-900 dark:text-white uppercase tracking-wider text-sm">Generate Report</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Create a new report</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 ml-auto" />
            </Link>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="card" id="recent">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">Recent Reports</h2>
            <Link to="/clients" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-light uppercase tracking-wider text-xs transition-colors">
              View all →
            </Link>
          </div>

          {stats.recentReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">No reports yet</p>
              <Link to="/clients" className="btn btn-primary">
                Create Your First Report
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentReports.map((report) => (
                <ReportItem key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
        </div>
        )}
      </PageWrapper>
    </>
  );
}

function StatCard({ icon, title, value, link, linkText }) {
  return (
    <div className="card hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>{icon}</div>
        <TrendingUp className="h-5 w-5 text-green-500" />
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-1 uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-light text-gray-900 dark:text-white mb-3">{value}</p>
      <a href={link} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-light transition-colors uppercase tracking-wider text-xs">
        {linkText} →
      </a>
    </div>
  );
}

function ReportItem({ report }) {
  const getStatusBadge = (status) => {
    const badges = {
      completed: { class: 'border-green-600 text-green-600 dark:border-green-700 dark:text-green-400', icon: CheckCircle, text: 'Completed' },
      processing: { class: 'border-yellow-600 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400', icon: Clock, text: 'Processing' },
      pending: { class: 'border-yellow-600 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400', icon: Clock, text: 'Pending' },
      failed: { class: 'border-red-600 text-red-600 dark:border-red-700 dark:text-red-400', icon: AlertCircle, text: 'Failed' },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 border rounded-full text-sm ${badge.class}`}>
        <Icon className="h-3 w-3" />
        <span className="ml-1">{badge.text}</span>
      </span>
    );
  };

  return (
    <Link
      to={`/reports/${report.id}`}
      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded hover:bg-gray-100 dark:hover:bg-dark-50 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center space-x-4 flex-1">
        <div className="h-10 w-10 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-gray-900 dark:text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-light text-gray-900 dark:text-white truncate uppercase tracking-wide">{report.clientName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {format(new Date(report.start_date), 'MMM d')} - {format(new Date(report.end_date), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {getStatusBadge(report.status)}
        <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
      </div>
    </Link>
  );
}
