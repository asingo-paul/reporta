import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Trash2, Edit } from 'lucide-react';
import { clientsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import { ClientsListSkeleton } from '../components/LoadingSkeleton';
import { EmptyClients, EmptySearch } from '../components/EmptyStates';
import { useToast } from '../contexts/ToastContext';

export default function Clients() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchQuery, clients]);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.list();
      setClients(response.data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (clientId) => {
    try {
      await clientsAPI.delete(clientId);
      setClients(clients.filter(c => c.id !== clientId));
      setShowDeleteModal(null);
      toast.success('Client deleted successfully');
    } catch (error) {
      console.error('Failed to delete client:', error);
      toast.error('Failed to delete client');
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <PageWrapper>
          <ClientsListSkeleton />
        </PageWrapper>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">Clients</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your clients and their integrations</p>
          </div>
          <Link to="/clients/new" className="btn btn-primary mt-4 md:mt-0 inline-flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Clients List */}
        {filteredClients.length === 0 ? (
          searchQuery ? (
            <EmptySearch query={searchQuery} />
          ) : (
            <EmptyClients />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onDelete={() => setShowDeleteModal(client)}
              />
            ))}
          </div>
        )}
        </div>
      </PageWrapper>

      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteModal
          client={showDeleteModal}
          onConfirm={() => handleDelete(showDeleteModal.id)}
          onCancel={() => setShowDeleteModal(null)}
        />
      )}
    </>
  );
}

function ClientCard({ client, onDelete }) {
  return (
    <div className="card hover:shadow-lg transition-shadow hover:border-gray-400 dark:hover:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className="h-12 w-12 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center">
          <span className="text-xl font-light text-gray-900 dark:text-white">
            {client.name[0].toUpperCase()}
          </span>
        </div>
        <div className="flex space-x-2">
          <Link
            to={`/clients/${client.id}/edit`}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Link to={`/clients/${client.id}`}>
        <h3 className="text-lg font-light text-gray-900 dark:text-white mb-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors uppercase tracking-wide">
          {client.name}
        </h3>
      </Link>
      
      {client.email && (
        <p className="text-sm text-gray-500 mb-4">{client.email}</p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
        <Link
          to={`/clients/${client.id}`}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-light transition-colors uppercase tracking-wider text-xs"
        >
          View Details →
        </Link>
        <Link
          to={`/clients/${client.id}/reports/new`}
          className="text-sm btn btn-secondary text-xs py-1 px-3"
        >
          Generate Report
        </Link>
      </div>
    </div>
  );
}

function DeleteModal({ client, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded max-w-md w-full p-6 animate-slide-up">
        <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">Delete Client</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{client.name}</strong>? This will also delete all
          their reports and integrations. This action cannot be undone.
        </p>
        <div className="flex space-x-3">
          <button onClick={onCancel} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn border border-red-600 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-1">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
