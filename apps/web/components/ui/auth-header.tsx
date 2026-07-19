import { Logo } from './logo';

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center">
      <Logo size={44} />
      <div>
        <h1 className="text-balance text-xl font-semibold tracking-tight text-content-primary">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-content-secondary">{subtitle}</p>}
      </div>
    </div>
  );
}
