import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, Mail, MessageSquare, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Contact() {
  const user = useAuthStore((state) => state.user);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Simulate API call - replace with actual endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      console.log('Contact form submitted:', formData);
      setSubmitted(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          name: user?.name || '',
          email: user?.email || '',
          subject: '',
          message: ''
        });
        setSubmitted(false);
      }, 3000);
    } catch (err) {
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark transition-colors">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-900">
        <nav className="max-w-7xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-xs uppercase tracking-wider">Back to Home</span>
          </Link>
        </nav>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
            Contact Us
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Have questions? We're here to help.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="card">
            <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-6 uppercase">
              Send us a Message
            </h2>

            {submitted ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-6 text-center">
                <div className="w-12 h-12 bg-green-600 dark:bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-2">
                  Message Sent!
                </h3>
                <p className="text-green-700 dark:text-green-300">
                  We'll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>Name</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </div>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    readOnly={!!user?.email}
                    className="input"
                    placeholder="your@email.com"
                  />
                  {user?.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Email from your account
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>Subject</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="How can we help?"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="input"
                    placeholder="Tell us more about your question or issue..."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary w-full justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Contact Info & FAQ */}
          <div className="space-y-8">
            {/* Contact Information */}
            <div className="card">
              <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                Other Ways to Reach Us
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Email Support
                  </p>
                  <a
                    href="mailto:support@reporta.com"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    support@reporta.com
                  </a>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Response Time
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We typically respond within 24 hours
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Business Hours
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Monday - Friday, 9 AM - 6 PM EST
                  </p>
                </div>
              </div>
            </div>

            {/* Quick FAQ */}
            <div className="card">
              <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                Common Questions
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    How do I connect my accounts?
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Go to Clients, select a client, and click "Connect" on any integration card.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Can I cancel my subscription anytime?
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Yes! Cancel from Settings → Billing. No questions asked.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    How long do reports take to generate?
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Usually 2-5 minutes depending on data volume.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-900 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-600">
            © 2026 Reporta. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
