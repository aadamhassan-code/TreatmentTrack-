import { AddTreatmentForm } from "@/components/forms/add-treatment-form";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";

export default async function NewTreatmentPage() {
  const { practice, role, userId, treatsPatients } = await requireCurrentPractice();
  const dentists = role === "dentist" ? [] : await listTreatingDentists(practice.id);
  return (
    <AddTreatmentForm
      dentists={dentists}
      lockedToSelf={role === "dentist"}
      defaultDentistId={treatsPatients ? userId : ""}
    />
  );
}
