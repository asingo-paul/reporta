import { BarChart2 } from 'lucide-react';
import ProductPlaceholder from '../components/ProductPlaceholder';

export default function ReportGenerator() {
  return (
    <ProductPlaceholder
      icon={BarChart2}
      eyebrow="Reporta Products"
      title={<>REPORT<br />GENERATOR</>}
      description="Generate polished, branded performance reports for your clients. Connect their ad accounts, let AI craft the executive summary, and deliver a professional PDF in minutes."
      features={[
        'Connect Meta, GA4 and Google Ads accounts per client',
        'AI-powered executive summary with built-in accuracy guardrails',
        'Fully customizable template with your agency branding',
        'Live progress tracking while reports generate',
        'One-click PDF download and email delivery to clients',
      ]}
    />
  );
}