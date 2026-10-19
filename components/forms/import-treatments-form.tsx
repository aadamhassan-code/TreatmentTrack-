"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { formatDate, formatGBP, ukDate } from "@/lib/utils";
import { MAX_IMPORT_ROWS, MAX_QUOTE_AGE_MONTHS, TEMPLATE_CSV, parseImport } from "@/lib/import";
import { importTreatments, type ImportResult } from "@/lib/actions/import";

export function ImportTreatmentsForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => (csvText == null ? null : parseImport(csvText, ukDate())), [csvText]);
  const ready = preview?.rows.filter((r) => r.errors.length === 0) ?? [];
  const problems = preview?.rows.filter((r) => r.errors.length > 0) ?? [];
  const readyValue = ready.reduce((sum, r) => sum + r.valuePence, 0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setConfirmed(false);
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  }

  function onImport() {
    if (csvText == null) return;
    startTransition(async () => {
      const res = await importTreatments(csvText, confirmed);
      setResult(res);
      if (!res.error) {
        setCsvText(null);
        setFileName(null);
        setConfirmed(false);
      }
    });
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Import quotes from a spreadsheet</h1>
        <p className="mt-2 text-sm text-ink-500">
          Upload a CSV of declined quotes — for example an export from your practice
          management software — and TreatmentTrack will start following each one up.
        </p>
      </div>

      {result && !result.error && (
        <div className="flex items-start gap-3 rounded-lg border border-teal-700/20 bg-teal-50 px-4 py-3 text-teal-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">
              {result.imported
                ? `Imported ${result.imported} quote${result.imported === 1 ? "" : "s"} worth ${formatGBP(result.importedValuePence ?? 0)}.`
                : "Nothing new to import."}
            </p>
            {(result.skipped?.length ?? 0) > 0 && (
              <>
                <p className="mt-1">{result.skipped!.length} row{result.skipped!.length === 1 ? " was" : "s were"} not imported:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {result.skipped!.map((s) => (
                    <li key={s.line}>
                      Row {s.line}{s.patientName ? ` (${s.patientName})` : ""}: {s.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-2">
              <Link href="/dashboard" className="font-medium underline">
                Go to the dashboard
              </Link>
            </p>
          </div>
        </div>
      )}
      {result?.error && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{result.error}</p>
      )}

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm font-semibold text-ink-900">1. Choose your file</p>
          <p className="text-sm text-ink-500">
            The first row must be column headings. Needed: <strong>patient name</strong>,{" "}
            <strong>phone</strong>, <strong>treatment type</strong> and <strong>value</strong>.
            Optional: <strong>email</strong>, <strong>quote date</strong> (DD/MM/YYYY — today if
            blank) and <strong>opt-out offered</strong> (if included, every row must say yes).
            Up to {MAX_IMPORT_ROWS} quotes per file; quotes older than {MAX_QUOTE_AGE_MONTHS} months
            aren&rsquo;t imported. In Excel, use <em>File → Save As → CSV</em>.
          </p>
          <a
            href={templateHref}
            download="treatmenttrack-import-template.csv"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 underline"
          >
            <Download className="h-4 w-4" />
            Download a template
          </a>
          <PmsExportHelp />
          <div>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream-50"
            />
            {fileName && <p className="mt-1 text-xs text-ink-500">{fileName}</p>}
          </div>
        </CardBody>
      </Card>

      {preview && (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm font-semibold text-ink-900">2. Check the quotes</p>
            {preview.fileErrors.length > 0 ? (
              <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{preview.fileErrors[0]}</p>
            ) : (
              <>
                <p className="text-sm text-ink-700">
                  <strong>{ready.length}</strong> quote{ready.length === 1 ? "" : "s"} ready to import (
                  {formatGBP(readyValue)})
                  {problems.length > 0 && (
                    <>
                      {" "}· <strong className="text-clay-700">{problems.length}</strong> with problems will be
                      skipped — fix them in the spreadsheet and re-upload if you want them included
                    </>
                  )}
                  . Patients who previously opted out, and quotes already on your dashboard, are also skipped.
                </p>
                <div className="max-h-96 overflow-auto rounded-lg border border-ink-900/8">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 bg-cream-50">
                      <tr className="border-b border-ink-900/8 text-[13px] text-ink-500">
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Patient</th>
                        <th className="px-3 py-2 font-medium">Phone</th>
                        <th className="px-3 py-2 font-medium">Treatment</th>
                        <th className="px-3 py-2 text-right font-medium">Value</th>
                        <th className="px-3 py-2 font-medium">Quoted</th>
                        <th className="px-3 py-2 font-medium">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.line} className="border-b border-ink-900/6 last:border-0 align-top">
                          <td className="px-3 py-2 font-mono text-xs text-ink-500">
                            {[r.line, ...r.mergedLines].join(", ")}
                          </td>
                          <td className="px-3 py-2">{r.patientName || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.phone || "—"}</td>
                          <td className="px-3 py-2">{r.treatmentType || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {r.valuePence ? formatGBP(r.valuePence) : "—"}
                          </td>
                          <td className="px-3 py-2">{formatDate(r.quotedOn)}</td>
                          <td className="px-3 py-2">
                            {r.errors.length === 0 ? (
                              <span className="text-teal-700">
                                {r.mergedLines.length ? `Ready · ${r.mergedLines.length + 1} items combined` : "Ready"}
                              </span>
                            ) : (
                              <span className="flex items-start gap-1 text-clay-700">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {r.errors.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {preview && preview.fileErrors.length === 0 && ready.length > 0 && (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm font-semibold text-ink-900">3. Confirm consent and import</p>
            <Toggle
              checked={confirmed}
              onChange={setConfirmed}
              required
              label="Every patient in this file was offered an opt-out for follow-up on their quote"
              description="Required — the same PECR soft opt-in as Add Treatment. It's recorded against each quote with your name and today's date. Remove anyone who wasn't offered an opt-out before importing."
            />
            <Button size="lg" onClick={onImport} disabled={pending || !confirmed}>
              {pending ? "Importing…" : `Import ${ready.length} quote${ready.length === 1 ? "" : "s"}`}
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

const step = "list-decimal space-y-1.5 pl-5 text-sm text-ink-700";

/** Step-by-step: getting quotes out of the practice software as a CSV. */
function PmsExportHelp() {
  return (
    <div className="space-y-2">
      <details className="rounded-lg border border-ink-900/10 bg-cream-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-900">How to find these quotes in Dentally</summary>
        <ol className={`${step} mt-3`}>
          <li>
            In Dentally, open <strong>Reports</strong> and choose <strong>Treatment Plans</strong>.
          </li>
          <li>
            Set the filters on the left:
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <strong>Started on or after</strong>: a date in the last few months (quotes older than{" "}
                {MAX_QUOTE_AGE_MONTHS} months can&rsquo;t be followed up).
              </li>
              <li>
                <strong>Payment Plan</strong>: your <strong>Private</strong> plan.
              </li>
              <li>
                <strong>Items Ticked</strong>: <strong>None ticked</strong> — quoted, but no treatment started.
              </li>
              <li>
                <strong>Complete</strong>: <strong>Not complete</strong>.
              </li>
              <li>
                <strong>Practitioner</strong>: one dentist, or leave it as everyone.
              </li>
            </ul>
          </li>
          <li>
            That&rsquo;s your list of patients quoted for private treatment who haven&rsquo;t started. This report
            can&rsquo;t be downloaded and doesn&rsquo;t show mobile numbers, so add each patient who was offered an
            opt-out with <strong>Add a quote</strong> (click their name in Dentally to see their mobile), or type
            them into the template above and import it.
          </li>
        </ol>
        <p className="mt-3 text-xs text-ink-500">
          Patients already part-way through treatment with appointments still to book show up when you set{" "}
          <strong>Appointment status</strong> to <strong>Has unbooked treatment</strong> (Dentally&rsquo;s Unbooked
          Treatment report). They&rsquo;ve said yes, so add them to the Cases board rather than following them up here.
        </p>
      </details>
      <details className="rounded-lg border border-ink-900/10 bg-cream-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-900">How to get this list from CareStack</summary>
        <ol className={`${step} mt-3`}>
          <li>
            In CareStack, open the <strong>System Menu</strong> and choose <strong>Operational Reports</strong> (under{" "}
            <strong>Insights</strong>), then open the <strong>Treatment Tracker</strong> report.
          </li>
          <li>
            Set the filters:
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <strong>Appt. Date</strong>: the last 3 months (longer ranges go to Scheduled Downloads instead of
                appearing straight away).
              </li>
              <li>
                <strong>Appt. Location</strong>: your practice.
              </li>
              <li>
                <strong>Scheduled Status</strong>: <strong>Unscheduled</strong> — treatment not yet booked in.
              </li>
              <li>
                <strong>Code Status</strong>: accepted or proposed codes, leaving out completed and rejected ones.
              </li>
              <li>
                <strong>Treatment Provider</strong>: one dentist, or leave it as everyone.
              </li>
            </ul>
          </li>
          <li>
            Click <strong>Download Report As</strong> and choose <strong>CSV</strong>.
          </li>
          <li>
            Open it and delete anyone who wasn&rsquo;t offered an opt-out, then choose the file below — no need to
            rename any columns. CareStack lists each treatment item on its own row; TreatmentTrack combines items for
            the same patient and date into one quote, and skips anything already scheduled, completed or rejected.
          </li>
        </ol>
      </details>
      <details className="rounded-lg border border-ink-900/10 bg-cream-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-900">
          How to get this list from Software of Excellence (Exact / R4)
        </summary>
        <ol className={`${step} mt-3`}>
          <li>Run your outstanding (uncompleted) treatment plans report for private plans.</li>
          <li>Export it to Excel.</li>
          <li>
            Delete anyone who has since booked or wasn&rsquo;t offered an opt-out, check the name, mobile, treatment
            and value columns, then <em>File → Save As → CSV</em> and choose the file below.
          </li>
        </ol>
      </details>
      <details className="rounded-lg border border-ink-900/10 bg-cream-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-900">
          Using other software? (Sensei Cloud, Aerona, iSmile, Pearl…)
        </summary>
        <div className="mt-3 space-y-2 text-sm text-ink-700">
          <p>
            Any export works as long as it has a column for the patient&rsquo;s name, their mobile number, the
            treatment, and the price — most &ldquo;outstanding treatment&rdquo; or &ldquo;unscheduled treatment
            plan&rdquo; reports do. Export it as CSV (or open in Excel and <em>Save As → CSV</em>) and choose the
            file below; common column headings are recognised automatically.
          </p>
          <p>
            If your software&rsquo;s report isn&rsquo;t recognised, copy the columns into the template above — or
            tell us which software you use via the{" "}
            <Link href="/request-callback" className="font-medium text-teal-700 underline">
              contact form
            </Link>{" "}
            (send a heading row only, never patient data) and we&rsquo;ll add it.
          </p>
        </div>
      </details>
    </div>
  );
}
