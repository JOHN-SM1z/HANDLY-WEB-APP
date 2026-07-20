import type { OrderStatus } from '@handly/contracts';
import { Badge } from '@/components/ui/badge';

/** Mapping per docs/DESIGN_SYSTEM.md §2 — status colors are reserved for status only. */
const STATUS_INFO: Record<OrderStatus, { labelUz: string; variant: 'gray' | 'blue' | 'green' | 'amber' | 'red' }> = {
  DRAFT: { labelUz: 'Qoralama', variant: 'gray' },
  PRICED: { labelUz: 'Narxlangan', variant: 'blue' },
  SEARCHING: { labelUz: 'Usta izlanmoqda', variant: 'blue' },
  ASSIGNED: { labelUz: 'Tayinlandi', variant: 'blue' },
  EN_ROUTE: { labelUz: "Yo'lda", variant: 'blue' },
  IN_PROGRESS: { labelUz: 'Bajarilmoqda', variant: 'blue' },
  COMPLETED: { labelUz: 'Yakunlandi', variant: 'green' },
  CLOSED: { labelUz: 'Yopilgan', variant: 'gray' },
  CANCELLED_BY_CUSTOMER: { labelUz: 'Bekor qilindi', variant: 'red' },
  CANCELLED_BY_MASTER: { labelUz: 'Bekor qilindi', variant: 'red' },
  EXPIRED: { labelUz: 'Muddati tugadi', variant: 'gray' },
  DISPUTED: { labelUz: 'Nizoli', variant: 'amber' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const info = STATUS_INFO[status];
  return <Badge variant={info.variant}>{info.labelUz}</Badge>;
}
