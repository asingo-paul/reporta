import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { clientsAPI } from '../lib/api';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';

export default function ClientForm() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const isEditing = clientId && clientId !== 'new';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      loadClient();
    }
  }, [clientId]);

  const loadClient = async () => {
    try {
      const response = await clientsAPI.get(clientId);
      setFormData({
        name: response.data.name,
        email: response.data.email || '',
      });
    } catch (error) {
      console.error('Failed to load client:', error);
      setError('Failed to load client data');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isEditing) {
        await clientsAPI.update(clientId, formData);
      } else {
        await clientsAPI.create(formData);
      }
      navigate('/clients');
    } catch (error) {
      console.error('Failed to save client:', error);
      setError(error.response?.data?.error || 'Failed to save client');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (isFetching) {
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

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/clients" className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-xs uppercase tracking-wider">Back to Clients</span>
          </Link>

          <div className="card">
            <h1 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">
              {isEditing ? 'Edit Client' : 'Add New Client'}
            </h1>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="section-title">
                Client Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="Acme Corporation"
                required
              />
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                The name of your client or organization
              </p>
            </div>

            <div>
              <label htmlFor="email" className="section-title">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
                placeholder="contact@acme.com"
              />
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Optional: Contact email for this client
              </p>
            </div>

            <div className="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="btn btn-secondary flex-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1 inline-flex items-center justify-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? 'Update Client' : 'Create Client'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      </PageWrapper>
    </>
  );
}
