import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
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
        <h1 className="text-4xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
          Privacy Policy
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-12">
          Last Updated: January 1, 2026
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Introduction */}
            <section>
              <p className="mb-4">
                Reporta ("we," "our," or "us") respects your privacy and is committed to protecting your personal data. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
              </p>
              <p>
                Please read this Privacy Policy carefully. By using Reporta, you agree to the collection and use of information 
                in accordance with this policy.
              </p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                1. Information We Collect
              </h2>
              
              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3 mt-6">
                1.1 Information You Provide
              </h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Account Information:</strong> Email address, password, and name</li>
                <li><strong>Payment Information:</strong> Billing details processed through Stripe (we do not store credit card numbers)</li>
                <li><strong>Client Information:</strong> Names and email addresses of your clients</li>
                <li><strong>Branding Information:</strong> Company name, logo, and brand colors for report customization</li>
              </ul>

              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3 mt-6">
                1.2 Information from Third-Party Services
              </h3>
              <p className="mb-4">
                When you connect third-party services, we collect:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Google Analytics 4:</strong> Website traffic data, user behavior, conversion metrics</li>
                <li><strong>Google Ads:</strong> Campaign performance, ad spend, click-through rates, conversions</li>
                <li><strong>Meta (Facebook/Instagram):</strong> Ad performance, reach, engagement, conversions</li>
              </ul>

              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3 mt-6">
                1.3 Automatically Collected Information
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Usage data and analytics (pages visited, features used, time spent)</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                2. How We Use Your Information
              </h2>
              <p className="mb-4">We use collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our Service</li>
                <li>Generate marketing reports with AI-powered insights</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send reports to your designated recipients</li>
                <li>Communicate with you about your account and Service updates</li>
                <li>Respond to customer support requests</li>
                <li>Monitor usage and detect technical issues</li>
                <li>Prevent fraud and ensure security</li>
                <li>Comply with legal obligations</li>
                <li>Improve our AI models and algorithms (using aggregated, anonymized data)</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                3. How We Share Your Information
              </h2>
              <p className="mb-4">We may share your information with:</p>
              
              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3 mt-6">
                3.1 Service Providers
              </h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Stripe:</strong> Payment processing</li>
                <li><strong>AI model providers (e.g., Google Gemini or OpenAI):</strong> AI-powered analysis and insight generation</li>
                <li><strong>Cloud Hosting:</strong> Infrastructure and data storage</li>
                <li><strong>Email Service:</strong> Transactional and report delivery emails</li>
              </ul>

              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3 mt-6">
                3.2 Legal Requirements
              </h3>
              <p className="mb-4">
                We may disclose your information if required by law, court order, or government request, or to protect 
                our rights, property, or safety.
              </p>

              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3 mt-6">
                3.3 Business Transfers
              </h3>
              <p>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred. 
                We will provide notice before your information is transferred.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                4. Data Security
              </h2>
              <p className="mb-4">We implement security measures including:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Encryption in transit (TLS/SSL) and at rest</li>
                <li>Secure authentication and password hashing</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and monitoring</li>
                <li>Secure data centers with physical security</li>
              </ul>
              <p>
                However, no method of transmission over the Internet or electronic storage is 100% secure. 
                While we strive to protect your data, we cannot guarantee absolute security.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                5. Data Retention
              </h2>
              <p className="mb-4">
                We retain your information for as long as necessary to provide the Service and fulfill the purposes outlined in this policy:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Data:</strong> Retained while your account is active, plus 90 days after cancellation</li>
                <li><strong>Marketing Data:</strong> Retained for report generation and historical analysis</li>
                <li><strong>Payment Records:</strong> Retained for 7 years for tax and accounting purposes</li>
                <li><strong>Usage Logs:</strong> Retained for 12 months for security and analytics</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                6. Your Rights and Choices
              </h2>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your data (subject to legal obligations)</li>
                <li><strong>Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails</li>
                <li><strong>Revoke Consent:</strong> Disconnect third-party integrations at any time</li>
              </ul>
              <p>
                To exercise these rights, contact us at privacy@reporta.com.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                7. Cookies and Tracking
              </h2>
              <p className="mb-4">We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Maintain your login session</li>
                <li>Remember your preferences</li>
                <li>Analyze usage patterns</li>
                <li>Improve Service performance</li>
              </ul>
              <p>
                You can control cookies through your browser settings. Disabling cookies may affect Service functionality.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                8. Third-Party Services
              </h2>
              <p className="mb-4">
                Our Service integrates with third-party platforms (Google, Meta). Their use of your data is governed by their 
                own privacy policies:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Google Privacy Policy: https://policies.google.com/privacy</li>
                <li>Meta Privacy Policy: https://www.facebook.com/privacy/policy</li>
                <li>Stripe Privacy Policy: https://stripe.com/privacy</li>
                <li>Google Privacy Policy: https://policies.google.com/privacy</li>
                <li>OpenAI Privacy Policy: https://openai.com/policies/row-privacy-policy/</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                9. International Data Transfers
              </h2>
              <p>
                Your information may be transferred to and processed in countries other than your own. 
                We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                10. Children's Privacy
              </h2>
              <p>
                Our Service is not directed to individuals under 18 years of age. We do not knowingly collect personal 
                information from children. If you believe we have collected information from a child, please contact us.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                11. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
                Privacy Policy on this page and updating the "Last Updated" date. Significant changes will be communicated via email.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                12. Contact Us
              </h2>
              <p className="mb-4">
                If you have questions or concerns about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Email:</strong> privacy@reporta.com</li>
                <li><strong>Address:</strong> Reporta Privacy Team</li>
                <li><strong>Website:</strong> https://reporta.com</li>
              </ul>
            </section>

            {/* GDPR & CCPA */}
            <section className="pt-8 border-t border-gray-200 dark:border-gray-800">
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                13. Region-Specific Rights
              </h2>
              
              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3">
                European Users (GDPR)
              </h3>
              <p className="mb-4">
                If you are in the European Economic Area, you have additional rights under GDPR, including the right to 
                object to processing and lodge a complaint with a supervisory authority.
              </p>

              <h3 className="text-xl font-light text-gray-900 dark:text-white mb-3">
                California Users (CCPA)
              </h3>
              <p>
                California residents have the right to know what personal information is collected, request deletion, 
                and opt-out of the sale of personal information. We do not sell personal information.
              </p>
            </section>
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
