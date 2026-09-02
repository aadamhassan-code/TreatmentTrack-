import { Suspense } from "react";
import { SignupForm } from "@/components/forms/signup-form";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
