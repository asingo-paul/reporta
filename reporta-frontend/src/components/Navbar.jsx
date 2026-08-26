import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useState } from 'react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-dark border-b border-gray-900 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-12">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <img src="/reporta.png" alt="Reporta" className="h-7 w-7 opacity-90" />
              <span className="text-lg font-light tracking-widest text-white uppercase">Reporta</span>
            </Link>
            
            <div className="hidden md:flex space-x-8">
              <Link
                to="/dashboard"
                className={`text-xs uppercase tracking-widest transition-colors ${
                  isActive('/dashboard')
                    ? 'text-white'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/clients"
                className={`text-xs uppercase tracking-widest transition-colors ${
                  isActive('/clients') || location.pathname.startsWith('/clients/')
                    ? 'text-white'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                Clients
              </Link>
              <Link
                to="/template"
                className={`text-xs uppercase tracking-widest transition-colors ${
                  isActive('/template')
                    ? 'text-white'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                Template
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-3 px-4 py-2 border border-gray-900 hover:border-gray-700 transition-colors"
              >
                <div className="h-7 w-7 border border-gray-700 flex items-center justify-center text-white text-sm font-light">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="hidden md:block text-xs text-gray-400 uppercase tracking-wider">
                  {user?.email}
                </span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-dark-50 border border-gray-900 shadow-2xl">
                  <Link
                    to="/settings"
                    className="flex items-center space-x-3 px-6 py-4 text-sm text-gray-400 hover:text-white hover:bg-dark-100 transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="uppercase tracking-wider text-xs">Settings</span>
                  </Link>
                  <Link
                    to="/billing"
                    className="flex items-center space-x-3 px-6 py-4 text-sm text-gray-400 hover:text-white hover:bg-dark-100 transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    <User className="h-4 w-4" />
                    <span className="uppercase tracking-wider text-xs">Billing</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-6 py-4 text-sm text-gray-400 hover:text-red-400 hover:bg-dark-100 transition-colors border-t border-gray-900"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="uppercase tracking-wider text-xs">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
