import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [stats, setStats] = useState({
    clients: 1247,
    reports: 3892,
    templates: 156
  });

  // Simulate real-time counting animation
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        clients: prev.clients + Math.floor(Math.random() * 3),
        reports: prev.reports + Math.floor(Math.random() * 5),
        templates: prev.templates + Math.floor(Math.random() * 2)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-dark transition-colors duration-300">
      {/* Luxury Header */}
      <header className="border-b border-gray-200 dark:border-gray-900 transition-colors fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark">
        <nav className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/reporta.png" alt="Reporta" className="h-8 w-8 opacity-90" />
              <span className="text-xl font-light tracking-widest text-gray-900 dark:text-white uppercase">Reporta</span>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#vision" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Vision
              </a>
              <a href="#portfolio" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Features
              </a>
              <a href="#contact" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Pricing
              </a>
            </div>
            <div className="flex items-center space-x-6">
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
              
              <Link 
                to="/login" 
                className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link 
                to="/signup" 
                className="btn btn-primary"
              >
                <span>Get Started</span>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section - Luxury Style */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-dark/50 dark:to-dark z-10 transition-colors"></div>
          <div className="absolute inset-0 bg-white/60 dark:bg-dark/60 z-10 transition-colors"></div>
          <img 
            src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=1920&q=80" 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-30"
          />
        </div>

        <div className="relative z-20 max-w-6xl mx-auto px-6 text-center">
          {/* Real-time Stats */}
          <div className="flex justify-center items-center space-x-8 mb-6 animate-fade-in">
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-light tracking-wider">
                <span className="text-gray-900 dark:text-white font-medium">{stats.clients.toLocaleString()}</span> Clients
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-light tracking-wider">
                <span className="text-gray-900 dark:text-white font-medium">{stats.reports.toLocaleString()}</span> Reports
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-light tracking-wider">
                <span className="text-gray-900 dark:text-white font-medium">{stats.templates.toLocaleString()}</span> Templates
              </span>
            </div>
          </div>

          <p className="section-title mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>Intelligent Reporting</p>
          
          <h1 className="heading-xl mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            MARKETING REPORTS
            <br />
            REDEFINED
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed animate-fade-in" style={{ animationDelay: '0.4s' }}>
            Transform complex data into elegant insights. AI-powered analysis meets 
            sophisticated design to deliver reports that command attention.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Link 
              to="/signup" 
              className="btn btn-primary group"
            >
              <span>Begin Your Journey</span>
              <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#vision" 
              className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Discover More
            </a>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-600 mt-8 tracking-wider">14-DAY COMPLIMENTARY TRIAL</p>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="w-px h-16 bg-gradient-to-b from-gray-400 dark:from-gray-600 to-transparent"></div>
        </div>
      </section>

      {/* Vision Section */}
      <section id="vision" className="py-32 border-t border-gray-200 dark:border-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-16">
            <div>
              <h2 className="heading-md mb-6">THE VISION</h2>
              <p className="text-gray-400 font-light leading-relaxed">
                Every report begins with sophisticated analysis. AI-powered insights, 
                meticulously crafted. Every detail is deliberate. Everything is intentional.
              </p>
            </div>
            
            <div>
              <h2 className="heading-md mb-6">EVERY DETAIL</h2>
              <p className="text-gray-400 font-light leading-relaxed">
                From data to design, each element is carefully selected. Our AI analyzes, 
                our system creates — ensuring elegance and distinction.
              </p>
            </div>
            
            <div>
              <h2 className="heading-md mb-6">OUR APPROACH</h2>
              <p className="text-gray-400 font-light leading-relaxed">
                Every project is an exercise in precision. Defined, delivered and 
                wrapped with immediate alignment between vision and execution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features/Portfolio Section */}
      <section id="portfolio" className="py-32 border-t border-gray-200 dark:border-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="section-title mb-4">Our Capabilities</p>
            <h2 className="heading-lg">What We Offer</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-gray-200 dark:bg-gray-900">
            {/* Feature 1 */}
            <div className="bg-gray-50 dark:bg-dark p-12 group hover:bg-gray-100 dark:hover:bg-dark-50 transition-colors duration-500">
              <div className="mb-8">
                <div className="w-12 h-12 border border-gray-300 dark:border-gray-800 flex items-center justify-center group-hover:border-gray-900 dark:group-hover:border-white transition-colors">
                  <span className="text-xl text-gray-900 dark:text-white">01</span>
                </div>
              </div>
              <h3 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4">AI-Powered Insights</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed mb-6">
                Claude analyzes your marketing data with precision, delivering insights that 
                transform numbers into strategic narratives.
              </p>
              <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-600">
                Intelligent Analysis
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-50 dark:bg-dark p-12 group hover:bg-gray-100 dark:hover:bg-dark-50 transition-colors duration-500">
              <div className="mb-8">
                <div className="w-12 h-12 border border-gray-300 dark:border-gray-800 flex items-center justify-center group-hover:border-gray-900 dark:group-hover:border-white transition-colors">
                  <span className="text-xl text-gray-900 dark:text-white">02</span>
                </div>
              </div>
              <h3 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4">Unified Data Sources</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed mb-6">
                Google Analytics, Google Ads, Meta. All your platforms converge into a 
                single, comprehensive view of performance.
              </p>
              <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-600">
                Complete Integration
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-50 dark:bg-dark p-12 group hover:bg-gray-100 dark:hover:bg-dark-50 transition-colors duration-500">
              <div className="mb-8">
                <div className="w-12 h-12 border border-gray-300 dark:border-gray-800 flex items-center justify-center group-hover:border-gray-900 dark:group-hover:border-white transition-colors">
                  <span className="text-xl text-gray-900 dark:text-white">03</span>
                </div>
              </div>
              <h3 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4">Exquisite Design</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed mb-6">
                Custom branding, sophisticated layouts. Your reports become a reflection 
                of your commitment to excellence.
              </p>
              <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-600">
                Refined Aesthetics
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-gray-50 dark:bg-dark p-12 group hover:bg-gray-100 dark:hover:bg-dark-50 transition-colors duration-500">
              <div className="mb-8">
                <div className="w-12 h-12 border border-gray-300 dark:border-gray-800 flex items-center justify-center group-hover:border-gray-900 dark:group-hover:border-white transition-colors">
                  <span className="text-xl text-gray-900 dark:text-white">04</span>
                </div>
              </div>
              <h3 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4">Instant Delivery</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed mb-6">
                Minutes, not hours. Generate comprehensive reports and deliver them 
                directly to your clients with effortless precision.
              </p>
              <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-600">
                Seamless Distribution
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="contact" className="py-32 border-t border-gray-200 dark:border-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-title mb-8">Investment</p>
              <h2 className="heading-lg mb-8">
                TRANSPARENT
                <br />
                PRICING
              </h2>
              <p className="text-gray-400 font-light leading-relaxed text-lg mb-8">
                A singular offering, complete in every aspect. No tiers, no compromises. 
                Everything you need to deliver exceptional reporting.
              </p>
              
              <div className="space-y-4 mb-12">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-1 bg-gray-900 dark:bg-white"></div>
                  <span className="text-gray-700 dark:text-gray-300 font-light">Unlimited clients and reports</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-1 bg-gray-900 dark:bg-white"></div>
                  <span className="text-gray-700 dark:text-gray-300 font-light">AI-powered insights</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-1 bg-gray-900 dark:bg-white"></div>
                  <span className="text-gray-700 dark:text-gray-300 font-light">All platform integrations</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-1 bg-gray-900 dark:bg-white"></div>
                  <span className="text-gray-700 dark:text-gray-300 font-light">Custom branding</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-1 bg-gray-900 dark:bg-white"></div>
                  <span className="text-gray-700 dark:text-gray-300 font-light">Priority support</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-900 p-12 transition-colors">
              <div className="mb-12">
                <p className="text-xs uppercase tracking-ultra-wide text-gray-500 dark:text-gray-500 mb-4">Monthly Investment</p>
                <div className="flex items-baseline">
                  <span className="text-6xl font-light text-gray-900 dark:text-white">$29</span>
                  <span className="text-gray-500 dark:text-gray-500 ml-3">/month</span>
                </div>
              </div>

              <Link 
                to="/signup" 
                className="btn btn-primary w-full justify-center mb-6"
              >
                <span>Begin Trial</span>
              </Link>

              <p className="text-xs text-gray-600 dark:text-gray-600 text-center tracking-wider">
                14 DAYS COMPLIMENTARY
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 border-t border-gray-200 dark:border-gray-900 transition-colors">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="section-title mb-8">Express Your Interest</p>
          <h2 className="heading-lg mb-8">
            EXPERIENCE
            <br />
            REPORTA
          </h2>
          <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed text-lg mb-12 max-w-2xl mx-auto">
            Discover how sophisticated reporting transforms client relationships. 
            Begin your complimentary trial today.
          </p>
          
          <Link 
            to="/signup" 
            className="btn btn-primary group"
          >
            <span>Get Started</span>
            <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-900 py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            <div className="flex items-center space-x-3">
              <img src="/reporta.png" alt="Reporta" className="h-6 w-6 opacity-70" />
              <span className="text-sm font-light tracking-widest text-gray-600 dark:text-gray-600 uppercase">Reporta</span>
            </div>
            
            <div className="flex items-center space-x-8">
              <Link to="/terms" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors">
                Privacy
              </Link>
              <a href="#" className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors">
                Contact
              </a>
            </div>

            <p className="text-xs text-gray-700 dark:text-gray-700 tracking-wider">© 2026 REPORTA</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
