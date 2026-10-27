"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/form";
import { APPT_TYPE_LABEL } from "@/lib/labels";
import { Alert, Field, LinkButton, cx, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

type PatientOpt = { id: string; name: string; doc: string; phone?: string | null };

export type AppointmentDefaults = {
  date: string;
  time: string;
  duration: number;
  professionalId?: string | null;
  patient?: PatientOpt | null;
  contactName?: string | null;
  contactPhone?: string | null;
  type?: string;
  notes?: string | null;
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

export function AppointmentForm({
  action,
  defaults,
  professionals,
  slots,
  cancelHref,
  submitLabel = "Agendar",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults: AppointmentDefaults;
  professionals: { id: string; name: string }[];
  slots: string[];
  cancelHref: string;
  submitLabel?: string;
}) {
  const { state, pending, formProps } = useServerForm(action);
  const fe = state.fieldErrors ?? {};
  const [patient, setPatient] = useState<PatientOpt | null>(defaults.patient ?? null);
  const [quick, setQuick] = useState(!defaults.patient && !!defaults.contactName);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientOpt[]>([]);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/pacientes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setResults)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const newPatientHref = `/pacientes/nuevo?returnTo=${encodeURIComponent(`/agenda/nueva?fecha=${date}&hora=${time}`)}`;
  const timeOptions = slots.includes(time) ? slots : [...slots, time].sort();

  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-500">Paciente</legend>
        <div className="mb-3 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={!quick} onChange={() => setQuick(false)} /> Paciente registrado
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={quick} onChange={() => setQuick(true)} /> Reserva rápida (sin ficha)
          </label>
        </div>

        {!quick ? (
          patient ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
              <div>
                <div className="font-medium">{patient.name}</div>
                <div className="text-xs text-slate-500">{patient.doc}{patient.phone ? ` · ${patient.phone}` : ""}</div>
              </div>
              <input type="hidden" name="patientId" value={patient.id} />
              <button type="button" onClick={() => setPatient(null)} className="text-sm text-brand-600 hover:underline">Cambiar</button>
            </div>
          ) : (
            <div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busca por RUT o nombre…"
                className={inputCls}
                aria-invalid={!!fe.patientId}
              />
              {fe.patientId && <p className="mt-1 text-xs text-rose-600">{fe.patientId}</p>}
              {results.length > 0 && (
                <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setPatient(r)}
                        className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium">{r.name}</span>
                        <span className="font-mono text-xs text-slate-500">{r.doc}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 2 && results.length === 0 && (
                <p className="mt-2 text-sm text-slate-500">Sin coincidencias.</p>
              )}
              <Link href={newPatientHref} className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                + Registrar paciente nuevo
              </Link>
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de contacto *" error={fe.patientId ?? fe.contactName}>
              <input name="contactName" defaultValue={defaults.contactName ?? ""} className={inputCls} />
            </Field>
            <Field label="Teléfono" error={fe.contactPhone}>
              <input name="contactPhone" type="tel" defaultValue={defaults.contactPhone ?? ""} className={inputCls} />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 text-sm font-semibold text-slate-500">Cita</legend>
        <Field label="Fecha" error={fe.date}>
          <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Hora" error={fe.time}>
          <select name="time" value={time} onChange={(e) => setTime(e.target.value)} className={cx(inputCls)} aria-invalid={!!fe.time}>
            {timeOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Duración" error={fe.duration}>
          <select name="duration" defaultValue={defaults.duration} className={inputCls}>
            {[...new Set([...DURATIONS, defaults.duration])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </Field>
        <Field label="Profesional" error={fe.professionalId}>
          <select name="professionalId" defaultValue={defaults.professionalId ?? ""} className={inputCls}>
            <option value="">Sin asignar</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Motivo" error={fe.type} className="sm:col-span-2">
          <select name="type" defaultValue={defaults.type ?? "CONTROL_VISUAL"} className={inputCls}>
            {Object.entries(APPT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Notas" error={fe.notes} className="sm:col-span-2">
          <input name="notes" defaultValue={defaults.notes ?? ""} className={inputCls} />
        </Field>
      </fieldset>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">Cancelar</LinkButton>
      </div>
    </form>
  );
}
