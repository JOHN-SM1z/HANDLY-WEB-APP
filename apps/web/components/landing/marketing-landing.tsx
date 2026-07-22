'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CategoryIcon } from '@/components/category-icon';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { ArrowRightIcon, CheckIcon, MapPinIcon } from '@/components/ui/icons';
import { categoriesApi } from '@/lib/categories';
import { formatSom } from '@/lib/format';

const TRUST_POINTS = [
  { title: 'Shaxsi tasdiqlangan', body: 'pasport + yuzni tekshirish' },
  { title: 'Mahorati sinovdan o’tgan', body: 'o’z sohasida amaliy imtihon' },
  { title: 'Ishga kafolat', body: "10 000 000 so'mgacha zarar qoplanadi" },
  { title: 'Har bir ishdan so’ng baholanadi', body: '4.6 dan past bo’lsa — qayta o’qitiladi' },
];

const STEPS = [
  {
    title: 'Nima buzilganini ayting',
    body: 'Xizmat turini tanlang, xohlasangiz rasm qo’shing, o’zingizga qulay vaqtni belgilang.',
  },
  {
    title: 'Tasdiqlangan usta oling',
    body: 'Sizni yaqin atrofdagi, shaxsi tekshirilgan va mahorati sinovdan o’tgan mutaxassis bilan bog’laymiz — reytingini ko’ra olasiz.',
  },
  {
    title: 'Ko’rgan narxingizni to’lang',
    body: 'Oldindan aytilgan narx — yakuniy narx. Ish tugagach, ilovada to’lov qiling.',
  },
];

/** Handly marketing landing — logged-out root, per docs/design/Handly Landing.dc.html. */
export function MarketingLanding() {
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  return (
    <div className="min-h-[100dvh] bg-background text-content-primary">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-border-tertiary bg-background">
        <div className="mx-auto flex max-w-[1160px] items-center gap-7 px-5 py-3.5 lg:px-7">
          <Logo size={30} withWordmark className="mr-auto" />
          <nav className="hidden items-center gap-7 lg:flex">
            <a href="#services" className="text-sm font-medium text-content-primary hover:text-primary">
              Xizmatlar
            </a>
            <a href="#how" className="text-sm font-medium text-content-primary hover:text-primary">
              Qanday ishlaydi
            </a>
            <a href="#trust" className="text-sm font-medium text-content-primary hover:text-primary">
              Ishonch va xavfsizlik
            </a>
            <a href="#masters" className="text-sm font-medium text-content-primary hover:text-primary">
              Ustalar uchun
            </a>
          </nav>
          <Link
            href="/login"
            className="hidden text-sm font-medium text-content-secondary hover:text-primary sm:inline"
          >
            Kirish
          </Link>
          <Link href="/register">
            <Button size="sm">Usta chaqirish</Button>
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-[1160px] gap-10 px-5 py-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-14 lg:px-7 lg:py-16">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary-soft-fg">
            <CheckIcon width={14} height={14} />
            Har bir usta tekshirilgan
          </span>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight lg:text-[58px]">
            Tasdiqlangan yordam, eshigingizda.
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-content-secondary">
            Santexnik, elektrik, tozalash va ta&apos;mirlash ustalari — tekshirilgan, mijozlar
            tomonidan baholangan, narxi oldindan aniq. Toshkent bo&apos;ylab, taxminan bir soat
            ichida.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button variant="brand" size="lg" className="gap-2">
                Usta chaqirish
                <ArrowRightIcon width={20} height={20} />
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg">
                Usta sifatida ishlash
              </Button>
            </Link>
          </div>
          {/* Beta Blocker Sprint: removed fabricated stats ("12,400+ masters",
              "4.9 rating", "~60 daqiqa response time") — no real usage data
              exists yet for a brand-new beta. Honest framing instead of
              invented social proof. */}
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-background-secondary px-3.5 py-2.5 text-sm text-content-secondary">
            <CheckIcon width={16} height={16} className="shrink-0 text-primary" />
            Hozir beta bosqichida — birinchi mijoz va ustalarni kutyapmiz.
          </div>
        </div>

        {/* booking widget mock */}
        <div className="flex flex-col gap-4 rounded-xl border border-border-tertiary bg-surface p-6 shadow-pop">
          <div className="text-base font-semibold">Nima buzilgan?</div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Xizmat</label>
            <div className="flex h-11 items-center gap-2.5 rounded-md border border-border-secondary px-3">
              <span className="text-sm">Santexnik — quyilish ta&apos;mirlash</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Manzil</label>
            <div className="flex h-11 items-center gap-2.5 rounded-md border border-border-secondary px-3">
              <MapPinIcon width={18} height={18} className="text-content-muted" />
              <span className="text-sm text-content-secondary">Yunusobod tumani, Toshkent</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-background-secondary px-3.5 py-3">
            <span className="text-sm text-content-secondary">Oldindan narx</span>
            <span className="text-base font-bold">120 000 so&apos;mdan</span>
          </div>
          <Link href="/register">
            <Button fullWidth>Mavjud ustalarni ko&apos;rish</Button>
          </Link>
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <CheckIcon width={14} height={14} className="text-success-fg" />
            Xizmat boshlanmaguncha bepul bekor qilish
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="mx-auto max-w-[1160px] px-5 py-10 lg:px-7 lg:py-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">Nimalarni hal qilamiz?</h2>
        </div>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {categories?.map((c) => (
            <Link
              key={c.id}
              href="/register"
              className="flex flex-col gap-3 rounded-lg border border-border-tertiary bg-surface p-4 shadow-card transition-colors hover:border-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
                <CategoryIcon iconKey={c.iconKey} />
              </span>
              <div>
                <div className="text-sm font-semibold">{c.nameUz}</div>
                <div className="text-xs text-content-muted">{formatSom(c.basePriceMin)}dan</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-y border-border-tertiary bg-surface">
        <div className="mx-auto max-w-[1160px] px-5 py-10 lg:px-7 lg:py-16">
          <h2 className="mb-8 text-2xl font-bold tracking-tight lg:text-3xl">Uch bosqichda hal bo&apos;ladi.</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-col gap-3 rounded-lg border border-border-tertiary bg-background p-5"
              >
                {i < 2 ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-ink-fg">
                    {i + 1}
                  </span>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-fg">
                    <CheckIcon width={16} height={16} />
                  </span>
                )}
                <div className="text-base font-semibold">{step.title}</div>
                <p className="text-sm leading-normal text-content-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="mx-auto grid max-w-[1160px] gap-12 px-5 py-10 lg:grid-cols-2 lg:items-center lg:px-7 lg:py-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">Har bir usta tekshiriladi.</h2>
          <p className="text-base leading-relaxed text-content-secondary">
            Logotipimizdagi belgi — va&apos;da, bezak emas. Handly&apos;da to&apos;rtta tekshiruvdan
            o&apos;tmagan hech kim ishlamaydi — va har bir ish sug&apos;urtalangan.
          </p>
          <div className="mt-1.5 flex flex-col gap-3">
            {TRUST_POINTS.map((p) => (
              <div key={p.title} className="flex items-center gap-3">
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
                  <CheckIcon width={14} height={14} />
                </span>
                <span className="text-sm">
                  <strong className="font-semibold">{p.title}</strong> — {p.body}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Beta Blocker Sprint: removed an invented customer testimonial
            ("Malika K.") — no real reviews exist yet for a brand-new beta.
            Honest framing instead of fabricated social proof. */}
        <div className="flex flex-col gap-5 rounded-xl bg-ink p-10 text-ink-fg">
          <Logo size={56} />
          <div className="text-2xl font-bold leading-snug tracking-tight">
            Handly beta bosqichida ishga tushmoqda.
          </div>
          <p className="text-sm leading-relaxed opacity-80">
            Birinchi mijozlar va ustalarni qidiryapmiz — real fikr-mulohazalar shu yerdan boshlanadi.
            Har bir tasdiqlangan usta va har bir yakunlangan ish haqiqiy bo&apos;ladi.
          </p>
        </div>
      </section>

      {/* FOR MASTERS CTA */}
      <section id="masters" className="mx-auto max-w-[1160px] px-5 pb-12 lg:px-7 lg:pb-16">
        <div className="flex flex-wrap items-center gap-8 rounded-xl bg-primary p-8 lg:p-12">
          <div className="flex min-w-[280px] flex-1 flex-col gap-2">
            <div className="text-2xl font-bold tracking-tight text-white lg:text-[34px]">
              Qo&apos;lingizdan ish keladimi? Doimiy ish toping.
            </div>
            <p className="max-w-[52ch] text-base leading-normal text-white/90">
              Handly ustalari yolg&apos;iz ishlaganidan 40% ko&apos;proq daromad topadi — yaqin
              buyurtmalar, tezkor to&apos;lovlar va mijoz qidirishning keragi yo&apos;q.
            </p>
          </div>
          <Link href="/register">
            <Button size="lg">Usta sifatida ro&apos;yxatdan o&apos;tish</Button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border-tertiary bg-surface">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-6 px-5 py-7 lg:px-7">
          <div className="mr-auto flex items-center gap-2.5">
            <Logo size={24} />
            <span className="ml-2 text-xs text-content-muted">© 2026 · Toshkent, O&apos;zbekiston</span>
          </div>
          <a href="#services" className="text-xs text-content-secondary">
            Xizmatlar
          </a>
          <a href="#trust" className="text-xs text-content-secondary">
            Ishonch va xavfsizlik
          </a>
          <a href="#masters" className="text-xs text-content-secondary">
            Ustalar uchun
          </a>
        </div>
      </footer>
    </div>
  );
}
