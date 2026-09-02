"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-teal-100/80 hover:bg-cream-50/5 hover:text-cream-50"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
