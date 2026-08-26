import { Landmark } from 'lucide-react';
import ProductPlaceholder from '../components/ProductPlaceholder';

export default function BankReconciliations() {
  return (
    <ProductPlaceholder
      icon={Landmark}
      eyebrow="Reporta Products"
      title={<>BANK<br />RECONCILIATIONS</>}
      description="Reconcile client accounts with confidence. Splitting financial data automated into a clear, branded overview that keeps every transaction accounted for."
      features={[
        'Automated account matching across sources',
        'Clear, dispositioned view of outstanding items',
        'Period-locked reconciliation reports for audit-ready history',
        'Branded, client-ready export in one click',
        'Secure handling of financial data end to end',
      ]}
    />
  );
}