import { Logo } from "@/components/marketing/nav";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-teal-50">
      <header className="px-6 py-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-teal-100 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.18)]">
          {children}
        </div>
      </main>
    </div>
  );
}
