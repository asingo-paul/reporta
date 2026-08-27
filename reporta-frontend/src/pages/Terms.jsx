import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
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
          Terms of Service
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-12">
          Last Updated: January 1, 2026
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                1. Agreement to Terms
              </h2>
              <p className="mb-4">
                By accessing or using Reporta ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
                If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p>
                Reporta is a marketing reporting automation platform that provides AI-powered report generation 
                services for marketing agencies and professionals.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                2. Description of Service
              </h2>
              <p className="mb-4">
                Reporta provides the following services:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Automated data collection from Google Analytics 4, Google Ads, and Meta advertising platforms</li>
                <li>AI-powered analysis and insight generation using third-party AI models</li>
                <li>Professional PDF report generation with custom branding</li>
                <li>Email delivery of reports to designated recipients</li>
                <li>Client management and reporting dashboard</li>
              </ul>
              <p>
                We reserve the right to modify or discontinue the Service at any time, with or without notice.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                3. Account Registration
              </h2>
              <p className="mb-4">
                To use Reporta, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Be at least 18 years of age</li>
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>
              <p>
                You are responsible for safeguarding your password. You agree not to disclose your password to any third party.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                4. Subscription and Payment
              </h2>
              <p className="mb-4">
                <strong>Free Trial:</strong> We offer a 14-day free trial for new users. No credit card is required for the trial period.
              </p>
              <p className="mb-4">
                <strong>Paid Subscription:</strong> After the trial period, continued use requires a paid subscription at $29 per month.
              </p>
              <p className="mb-4">
                <strong>Billing:</strong> You will be billed monthly in advance. All fees are in USD and non-refundable except as required by law.
              </p>
              <p className="mb-4">
                <strong>Cancellation:</strong> You may cancel your subscription at any time. Upon cancellation, your access will continue until the end of your current billing period.
              </p>
              <p>
                <strong>Price Changes:</strong> We reserve the right to change our pricing with 30 days' notice to existing subscribers.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                5. Data and Privacy
              </h2>
              <p className="mb-4">
                <strong>Your Data:</strong> You retain all rights to your data. We do not claim ownership of any data you provide or generate through the Service.
              </p>
              <p className="mb-4">
                <strong>Third-Party Access:</strong> By connecting third-party services (Google Analytics, Google Ads, Meta), you grant us permission to access and process data from these services on your behalf for the purpose of generating reports.
              </p>
              <p className="mb-4">
                <strong>Data Security:</strong> We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.
              </p>
              <p>
                <strong>Privacy Policy:</strong> Our collection and use of personal information is described in our Privacy Policy.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                6. Acceptable Use
              </h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Attempt to gain unauthorized access to the Service or related systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service to transmit malware, viruses, or harmful code</li>
                <li>Resell, duplicate, or exploit the Service without written permission</li>
                <li>Use automated systems to access the Service except as explicitly permitted</li>
                <li>Remove, alter, or obscure any proprietary notices on the Service</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                7. Intellectual Property
              </h2>
              <p className="mb-4">
                The Service and its original content, features, and functionality are owned by Reporta and are protected by 
                international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p>
                You may not copy, modify, distribute, sell, or lease any part of our Service without our prior written permission.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                8. AI-Generated Content
              </h2>
              <p className="mb-4">
                Our Service uses artificial intelligence provided by third-party model providers to analyze data and generate insights. While we strive for accuracy:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>AI-generated insights are provided "as is" and may not always be accurate or appropriate</li>
                <li>You are responsible for reviewing and verifying all AI-generated content before use</li>
                <li>We are not liable for decisions made based on AI-generated insights</li>
                <li>You should use professional judgment when interpreting and acting on AI recommendations</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                9. Disclaimer of Warranties
              </h2>
              <p className="mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
                INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                We do not warrant that the Service will be uninterrupted, secure, or error-free, or that defects will be corrected.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                10. Limitation of Liability
              </h2>
              <p className="mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, REPORTA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
                CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, 
                OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p>
                Our total liability to you for all claims arising from the use of the Service shall not exceed the amount you paid 
                to us in the 12 months preceding the claim.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                11. Indemnification
              </h2>
              <p>
                You agree to indemnify and hold harmless Reporta and its officers, directors, employees, and agents from any claims, 
                damages, losses, liabilities, and expenses (including attorneys' fees) arising out of your use of the Service or 
                violation of these Terms.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                12. Termination
              </h2>
              <p className="mb-4">
                We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, 
                for any reason, including breach of these Terms.
              </p>
              <p>
                Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which by their 
                nature should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.
              </p>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                13. Changes to Terms
              </h2>
              <p className="mb-4">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by email or 
                through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
              </p>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                14. Governing Law
              </h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Reporta operates, 
                without regard to its conflict of law provisions.
              </p>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="text-2xl font-light tracking-wide text-gray-900 dark:text-white mb-4 uppercase">
                15. Contact Information
              </h2>
              <p className="mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Email:</strong> legal@reporta.com</li>
                <li><strong>Website:</strong> https://reporta.com</li>
              </ul>
            </section>

            {/* Acceptance */}
            <section className="pt-8 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                By using Reporta, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
