import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Settings, Sun, Moon, Menu, X, Receipt } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const confirmLogout = () => {
    setShowLogoutModal(true);
    setShowDropdown(false);
    setShowMobileMenu(false);
  };

  const isActive = (path) => location.pathname === path;

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
    setShowDropdown(false);
  };

  return (
    <>
      <nav className="bg-white dark:bg-dark border-b border-gray-200 dark:border-gray-900 fixed top-0 left-0 right-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-4 sm:space-x-12">
            <Link to="/dashboard" className="flex items-center space-x-2 sm:space-x-3">
              <img src="/reporta.png" alt="Reporta" className="h-6 w-6 sm:h-7 sm:w-7 opacity-90" />
              <span className="text-base sm:text-lg font-light tracking-widest text-gray-900 dark:text-white uppercase">Reporta</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-8">
              <Link
                to="/dashboard"
                className={`text-xs uppercase tracking-widest transition-colors ${
                  isActive('/dashboard')
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/clients"
                className={`text-xs uppercase tracking-widest transition-colors ${
                  isActive('/clients') || location.pathname.startsWith('/clients/')
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Clients
              </Link>
              <Link
                to="/settings?tab=billing"
                className={`text-xs uppercase tracking-widest transition-colors ${
                  isActive('/settings') && location.search.includes('tab=billing')
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Billing
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-6">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {/* Desktop User Menu */}
            <div className="hidden sm:block relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-900 hover:border-gray-400 dark:hover:border-gray-700 transition-colors rounded"
              >
                <div className="h-6 w-6 sm:h-7 sm:w-7 border border-gray-400 dark:border-gray-700 flex items-center justify-center text-gray-900 dark:text-white text-xs sm:text-sm font-light rounded">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="hidden lg:block text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">
                  {user?.email}
                </span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-900 shadow-2xl transition-colors rounded">
                  <Link
                    to="/settings"
                    className="flex items-center space-x-3 px-6 py-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-100 transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="uppercase tracking-wider text-xs">Settings</span>
                  </Link>
                  <button
                    onClick={confirmLogout}
                    className="w-full flex items-center space-x-3 px-6 py-4 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-dark-100 transition-colors border-t border-gray-200 dark:border-gray-900"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="uppercase tracking-wider text-xs">Logout</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="sm:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {showMobileMenu ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="sm:hidden border-t border-gray-200 dark:border-gray-900 py-4">
            {/* User Info */}
            <div className="flex items-center space-x-3 px-4 py-3 border-b border-gray-200 dark:border-gray-900 mb-2">
              <div className="h-10 w-10 border border-gray-400 dark:border-gray-700 flex items-center justify-center text-gray-900 dark:text-white text-sm font-light rounded">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">{user?.email}</p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              <Link
                to="/dashboard"
                className={`block px-4 py-3 text-sm uppercase tracking-wider transition-colors ${
                  isActive('/dashboard')
                    ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
                onClick={closeMobileMenu}
              >
                Dashboard
              </Link>
              <Link
                to="/clients"
                className={`block px-4 py-3 text-sm uppercase tracking-wider transition-colors ${
                  isActive('/clients') || location.pathname.startsWith('/clients/')
                    ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
                onClick={closeMobileMenu}
              >
                Clients
              </Link>
              <Link
                to="/settings?tab=billing"
                className={`flex items-center space-x-3 px-4 py-3 text-sm uppercase tracking-wider transition-colors ${
                  isActive('/settings') && location.search.includes('tab=billing')
                    ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
                onClick={closeMobileMenu}
              >
                <Receipt className="h-4 w-4" />
                <span>Billing</span>
              </Link>
              <Link
                to="/settings"
                className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                onClick={closeMobileMenu}
              >
                <Settings className="h-4 w-4" />
                <span className="uppercase tracking-wider text-xs">Settings</span>
              </Link>
              <button
                onClick={() => {
                  confirmLogout();
                  closeMobileMenu();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors border-t border-gray-200 dark:border-gray-900"
              >
                <LogOut className="h-4 w-4" />
                <span className="uppercase tracking-wider text-xs">Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>

    {/* Logout Confirmation Modal */}
    {showLogoutModal && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded max-w-md w-full p-6 animate-slide-up">
          <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-2 uppercase">
            Confirm Logout
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to log out? You'll need to sign in again to access your account.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowLogoutModal(false);
                handleLogout();
              }}
              className="btn border border-red-600 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-1"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
