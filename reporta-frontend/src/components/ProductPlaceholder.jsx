import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

/**
 * Reusable placeholder landing page for Reporta's upcoming products
 * (Report Generator, Bank Reconciliations, ...). Keeps a single source of
 * truth for the shared marketing layout so each product page stays small
 * and consistent with the rest of the app.
 *
 * Matches the app's established visual language — uppercase tracking-widest
 * labels, `heading-xl`/`section-title` typography, bordered icon squares,
 * `card` panels, dark-mode aware, and the de-facto page shell (Header with
 * "Back to Home", content, footer) used across the marketing pages.
 */
export default function ProductPlaceholder({
  icon: Icon,
  eyebrow,
  title,
  description,
  features,
  ctaLabel = 'Get Started',
  ctaTo = '/signup',
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-dark transition-colors">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-900">
        <nav className="max-w-7xl mx-auto px-6 py-6">
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-xs uppercase tracking-wider">Back to Home</span>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 border border-gray-300 dark:border-gray-800 flex items-center justify-center mx-auto mb-8">
            <Icon className="h-8 w-8 text-gray-900 dark:text-white" />
          </div>
          <p className="section-title">{eyebrow}</p>
          <h1 className="heading-xl mb-8">{title}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-light leading-relaxed max-w-2xl mx-auto mb-10">
            {description}
          </p>
          <Link to={ctaTo} className="btn btn-primary group">
            <span>{ctaLabel}</span>
            <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-gray-200 dark:border-gray-900 py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <p className="section-title text-center">Product Capabilities</p>
          <div className="card">
            <ul className="space-y-5">
              {features.map((feature) => (
                <li key={feature} className="flex items-start space-x-4">
                  <div className="w-6 h-6 border border-gray-300 dark:border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5 text-gray-900 dark:text-white" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-light leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-600">
            © 2026 Reporta. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}