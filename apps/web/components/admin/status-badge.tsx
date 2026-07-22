import { Badge } from '@/components/ui/badge';

const GREEN = new Set(['ACTIVE', 'VERIFIED', 'CLOSED', 'COMPLETED', 'APPROVED', 'SUCCEEDED', 'REWARDED', 'PREMIUM']);
const AMBER = new Set(['PENDING', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'UNDER_REVIEW', 'TRIAL', 'PROCESSING', 'OPEN']);
const RED = new Set([
  'SUSPENDED',
  'BANNED',
  'REJECTED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_MASTER',
  'EXPIRED',
  'FAILED',
  'DISPUTED',
]);

/** Generic status -> color mapping reused across admin lists (orders/users/verification/guarantee). */
export function StatusBadge({ status }: { status: string }) {
  const variant = GREEN.has(status) ? 'green' : RED.has(status) ? 'red' : AMBER.has(status) ? 'amber' : 'gray';
  return <Badge variant={variant}>{status}</Badge>;
}
