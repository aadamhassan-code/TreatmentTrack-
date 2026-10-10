import { Sidebar } from "@/components/layout/sidebar";
import { listMyPractices, requireCurrentPractice } from "@/lib/practice";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ practice, role }, practices] = await Promise.all([requireCurrentPractice(), listMyPractices()]);

  return (
    <div className="flex min-h-full">
      <Sidebar practiceId={practice.id} practiceName={practice.name} practices={practices} role={role} />
      <div className="flex-1 bg-cream-50">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </div>
    </div>
  );
}
