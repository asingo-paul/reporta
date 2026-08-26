import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark flex items-center justify-center px-6 transition-colors">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center space-x-3 mb-8">
            <img src="/reporta.png" alt="Reporta" className="h-10 w-10 opacity-90" />
            <span className="text-2xl font-light tracking-widest text-gray-900 dark:text-white uppercase">Reporta</span>
          </Link>
          <p className="section-title mb-4">Welcome Back</p>
          <h1 className="text-3xl font-light tracking-wide text-gray-900 dark:text-white">SIGN IN</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="email" className="block text-xs uppercase tracking-widest text-gray-500 mb-3">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input"
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-widest text-gray-500 mb-3">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full justify-center group"
          >
            {isLoading ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-3"></div>
                <span>Signing in...</span>
              </span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Create one
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
