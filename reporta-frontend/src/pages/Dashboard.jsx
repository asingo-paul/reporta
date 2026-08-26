import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Plus,
  ArrowRight
} from 'lucide-react';
import { clientsAPI, reportsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your reports.</p>
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/clients/new"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Add New Client</p>
                <p className="text-sm text-gray-600">Create a client profile</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
            </Link>

            <Link
              to="/clients"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Generate Report</p>
                <p className="text-sm text-gray-600">Create a new report</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
            </Link>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="card" id="recent">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Reports</h2>
            <Link to="/clients" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View all →
            </Link>
          </div>

          {stats.recentReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No reports yet</p>
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
    </>
  );
}

function StatCard({ icon, title, value, link, linkText }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>{icon}</div>
        <TrendingUp className="h-5 w-5 text-green-500" />
      </div>
      <p className="text-gray-600 text-sm mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-3">{value}</p>
      <a href={link} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
        {linkText} →
      </a>
    </div>
  );
}

function ReportItem({ report }) {
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
      <span className={`badge ${badge.class} flex items-center space-x-1`}>
        <Icon className="h-3 w-3" />
        <span>{badge.text}</span>
      </span>
    );
  };

  return (
    <Link
      to={`/reports/${report.id}`}
      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center space-x-4 flex-1">
        <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{report.clientName}</p>
          <p className="text-sm text-gray-600">
            {format(new Date(report.start_date), 'MMM d')} - {format(new Date(report.end_date), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {getStatusBadge(report.status)}
        <ArrowRight className="h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}
