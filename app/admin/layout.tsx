import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { Logo } from "@/components/marketing/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requirePlatformAdmin();

  return (
    <div className="min-h-full bg-cream-50">
      <header className="border-b border-ink-900/8 bg-cream-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-gold-200 px-2.5 py-0.5 text-xs font-semibold text-gold-700">
              Back office
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-ink-500">
            <span className="hidden sm:inline">{email}</span>
            <Link href="/dashboard" className="font-medium text-teal-700 hover:text-teal-900">
              Back to the app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
