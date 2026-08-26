import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, User, Trash2, Edit } from 'lucide-react';
import { clientsAPI } from '../lib/api';
import Navbar from '../components/Navbar';

export default function Clients() {
  const navigate = useNavigate();
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
    } catch (error) {
      console.error('Failed to delete client:', error);
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Clients</h1>
            <p className="text-gray-600">Manage your clients and their integrations</p>
          </div>
          <Link to="/clients/new" className="btn btn-primary mt-4 md:mt-0 inline-flex items-center">
            <Plus className="h-5 w-5 mr-2" />
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
          <div className="card text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {searchQuery ? 'No clients found' : 'No clients yet'}
            </p>
            {!searchQuery && (
              <Link to="/clients/new" className="btn btn-primary">
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Client
              </Link>
            )}
          </div>
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
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-xl font-bold text-primary-600">
            {client.name[0].toUpperCase()}
          </span>
        </div>
        <div className="flex space-x-2">
          <Link
            to={`/clients/${client.id}/edit`}
            className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Link to={`/clients/${client.id}`}>
        <h3 className="text-lg font-bold text-gray-900 mb-1 hover:text-primary-600">
          {client.name}
        </h3>
      </Link>
      
      {client.email && (
        <p className="text-sm text-gray-600 mb-4">{client.email}</p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Link
          to={`/clients/${client.id}`}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Client</h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <strong>{client.name}</strong>? This will also delete all
          their reports and integrations. This action cannot be undone.
        </p>
        <div className="flex space-x-3">
          <button onClick={onCancel} className="btn btn-outline flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn bg-red-600 text-white hover:bg-red-700 flex-1">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
