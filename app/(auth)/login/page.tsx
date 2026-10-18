import { LoginForm } from "@/components/forms/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const step = (await searchParams).step === "verify" ? "verify" : undefined;
  return <LoginForm initialStep={step} />;
}
