import Link from 'next/link';
import type { Metadata } from 'next';
import { SupportContacts } from '@/components/support-contacts';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = { title: 'Yordam markazi' };

const faq = [
  {
    q: 'Handly qanday ishlaydi?',
    a: "Muammoingizni tasvirlab bering (rasm/video bilan) — AI bepul tashxis qo'yadi, narx oralig'ini ko'rsatadi va tizim sizga eng mos tasdiqlangan ustani topadi.",
  },
  {
    q: 'Narx qanday aniqlanadi?',
    a: "Har bir buyurtma uchun taxminiy narx oralig'i ko'rsatiladi. Yakuniy narx ish ko'lamiga qarab shu oraliq ichida kelishiladi — oraliqdan oshishi uchun sizning roziligingiz shart.",
  },
  {
    q: 'SMS kod kelmadi. Nima qilay?',
    a: "45 soniyadan so'ng \"Kodni qayta yuborish\" tugmasini bosing. Muammo davom etsa, quyidagi raqamlarga qo'ng'iroq qiling.",
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/home" aria-label="Bosh sahifa">
          <Logo size={30} withWordmark />
        </Link>
        <Link href="/home" className="text-sm font-medium text-primary hover:underline">
          Orqaga
        </Link>
      </header>

      <h1 className="text-balance text-xl font-semibold tracking-tight text-content-primary">
        Yordam markazi
      </h1>
      <p className="mt-1 text-sm text-content-secondary">
        Har kuni 09:00–21:00. Qo&apos;ng&apos;iroq qilish uchun raqamni bosing.
      </p>

      <section className="mt-5" aria-label="Biz bilan bog'lanish">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
          Biz bilan bog&apos;lanish
        </h2>
        <SupportContacts variant="card" />
      </section>

      <section className="mt-7" aria-label="Ko'p so'raladigan savollar">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
          Ko&apos;p so&apos;raladigan savollar
        </h2>
        <div className="flex flex-col gap-3">
          {faq.map((item) => (
            <div
              key={item.q}
              className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <p className="text-sm font-medium text-content-primary">{item.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto pt-8 text-center text-xs text-content-muted">
        © {new Date().getFullYear()} Handly · Toshkent
      </footer>
    </main>
  );
}
