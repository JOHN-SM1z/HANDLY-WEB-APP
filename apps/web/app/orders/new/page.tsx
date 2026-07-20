'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { categoriesApi } from '@/lib/categories';
import { ordersApi } from '@/lib/orders';
import { useOrderWizard } from '@/lib/wizard-store';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Logo } from '@/components/ui/logo';
import { StepDescription } from '@/components/order/step-description';
import { StepSchedule } from '@/components/order/step-schedule';
import { StepQuote } from '@/components/order/step-quote';
import { WizardHeader } from '@/components/order/wizard-header';
import { WizardStepper } from '@/components/order/wizard-stepper';

function Splash() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center">
      <div className="animate-pulse">
        <Logo size={44} />
      </div>
    </main>
  );
}

function NewOrderWizard() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategorySlug = searchParams.get('category') ?? undefined;
  const resumeId = searchParams.get('resume') ?? undefined;

  const { orderId, step, setOrderId, setStep, reset } = useOrderWizard();
  const startedFresh = useRef(false);

  // Arriving from Home with an explicit category always starts a new order;
  // arriving from an order's "Davom ettirish" button resumes that draft.
  useEffect(() => {
    if (!startedFresh.current) {
      if (resumeId) {
        reset();
        setOrderId(resumeId);
        setStep(1);
      } else if (initialCategorySlug) {
        reset();
      }
    }
    startedFresh.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    enabled: Boolean(user),
  });
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId!),
    enabled: Boolean(user) && Boolean(orderId),
    retry: false,
  });

  useEffect(() => {
    if (orderQuery.isError) reset();
  }, [orderQuery.isError, reset]);

  if (!ready || !user || !categories) return <Splash />;

  const order = orderQuery.data ?? null;
  const title = step === 1 ? 'Buyurtma yaratish' : step === 2 ? 'Vaqt tanlash' : 'Tasdiqlash';

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <WizardHeader
        title={title}
        onBack={() => {
          if (step === 1) router.push('/home');
          else setStep((step - 1) as 1 | 2);
        }}
      />
      <WizardStepper current={step} />

      {step === 1 && (
        <StepDescription
          categories={categories}
          initialCategorySlug={orderId ? undefined : initialCategorySlug}
          order={order}
          onNext={(id) => {
            setOrderId(id);
            setStep(2);
            void orderQuery.refetch();
          }}
        />
      )}
      {step === 2 && (
        <StepSchedule
          order={order}
          onBack={() => setStep(1)}
          onNext={() => {
            setStep(3);
            void orderQuery.refetch();
          }}
        />
      )}
      {step === 3 && (
        <StepQuote
          order={order}
          categories={categories}
          onBack={() => setStep(2)}
          onSubmitted={() => {
            const id = orderId;
            reset();
            if (id) router.replace(`/orders/${id}`);
          }}
        />
      )}
    </main>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<Splash />}>
      <NewOrderWizard />
    </Suspense>
  );
}
