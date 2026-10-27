import type { AppointmentStatus, AppointmentType, Prevision, Role, Sexo } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  OPTOMETRA: "Optómetra / TM",
  VENDEDOR: "Vendedor",
  RECEPCION: "Recepción",
};

export const SEXO_LABEL: Record<Sexo, string> = {
  F: "Femenino",
  M: "Masculino",
  OTRO: "Otro",
  NO_INFORMA: "Prefiere no informar",
};

export const PREVISION_LABEL: Record<Prevision, string> = {
  FONASA: "Fonasa",
  ISAPRE: "Isapre",
  CAPREDENA: "Capredena",
  DIPRECA: "Dipreca",
  PARTICULAR: "Particular",
  OTRA: "Otra",
};

export const APPT_TYPE_LABEL: Record<AppointmentType, string> = {
  CONTROL_VISUAL: "Control visual",
  ADAPTACION_LC: "Adaptación lentes de contacto",
  ENTREGA_LENTES: "Entrega de lentes",
  AJUSTE_REPARACION: "Ajuste / reparación",
  OTRO: "Otro",
};

export const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  AGENDADA: "Agendada",
  CONFIRMADA: "Confirmada",
  EN_ATENCION: "En atención",
  ATENDIDA: "Atendida",
  NO_ASISTIO: "No asistió",
  CANCELADA: "Cancelada",
};

export const APPT_STATUS_STYLE: Record<AppointmentStatus, string> = {
  AGENDADA: "bg-sky-50 border-sky-300 text-sky-900",
  CONFIRMADA: "bg-emerald-50 border-emerald-400 text-emerald-900",
  EN_ATENCION: "bg-amber-50 border-amber-400 text-amber-900",
  ATENDIDA: "bg-slate-100 border-slate-300 text-slate-600",
  NO_ASISTIO: "bg-rose-50 border-rose-300 text-rose-800 line-through",
  CANCELADA: "bg-slate-50 border-slate-200 text-slate-400 line-through",
};

export const REGIONES = [
  "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso",
  "Metropolitana de Santiago", "Libertador General Bernardo O'Higgins", "Maule", "Ñuble",
  "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes y la Antártica Chilena",
];
