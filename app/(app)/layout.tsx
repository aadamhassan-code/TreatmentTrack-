import { Sidebar } from "@/components/layout/sidebar";
import { requireCurrentPractice } from "@/lib/practice";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { practice } = await requireCurrentPractice();

  return (
    <div className="flex min-h-full">
      <Sidebar practiceName={practice.name} />
      <div className="flex-1 bg-cream-50">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </div>
    </div>
  );
}
