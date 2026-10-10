import { Card, CardBody } from "@/components/ui/card";
import { requireOwner } from "@/lib/practice";
import { formatDate } from "@/lib/utils";
import { ApprovalRequestForm } from "@/components/approval/approval-forms";
import { redirect } from "next/navigation";

export default async function ApprovalPage() {
  const { practice } = await requireOwner();
  if (!practice.requires_owner_approval) redirect("/dashboard");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink-900">Practice owner approval</h1>
        <p className="mt-2 text-sm text-ink-500">
          Follow-up messages go out in {practice.name}&rsquo;s name, and the patients&rsquo; details belong to the
          practice. So before anything is sent, the practice owner (or a manager who can agree on their behalf) needs
          to approve this account. You can add quotes and get everything ready in the meantime.
        </p>
      </div>
      <Card>
        <CardBody>
          {practice.owner_approved_at ? (
            <p className="text-sm text-teal-800">
              Approved by {practice.owner_approved_by_name ?? "the practice owner"} on{" "}
              {formatDate(practice.owner_approved_at)}. Follow-up messages are being sent.
            </p>
          ) : (
            <ApprovalRequestForm />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
