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

export const SALE_STATUS_LABEL: Record<import("@prisma/client").SaleStatus, string> = {
  ABIERTA: "Con saldo",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

export const SALE_STATUS_STYLE: Record<import("@prisma/client").SaleStatus, string> = {
  ABIERTA: "border-amber-300 bg-amber-50 text-amber-800",
  PAGADA: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ANULADA: "border-slate-300 bg-slate-50 text-slate-500 line-through",
};

export const PAYMENT_METHOD_LABEL: Record<import("@prisma/client").PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Tarjeta crédito",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  CREDITO_INSTITUCION: "Crédito institución",
  CONVENIO: "Convenio salud visual",
  GARANTIA: "Garantía",
  OTRO: "Otro",
};

export const WORK_STATUS_LABEL: Record<import("@prisma/client").WorkStatus, string> = {
  PENDIENTE: "Pendiente",
  LABORATORIO: "En laboratorio",
  MONTAJE: "En montaje",
  DISPONIBLE: "Disponible para retiro",
  ENTREGADO: "Entregado",
};

export const WORK_STATUS_STYLE: Record<import("@prisma/client").WorkStatus, string> = {
  PENDIENTE: "border-slate-300 bg-slate-50 text-slate-700",
  LABORATORIO: "border-violet-300 bg-violet-50 text-violet-800",
  MONTAJE: "border-sky-300 bg-sky-50 text-sky-800",
  DISPONIBLE: "border-emerald-400 bg-emerald-50 text-emerald-800",
  ENTREGADO: "border-slate-200 bg-white text-slate-500",
};

export const WORK_STATUS_FLOW: import("@prisma/client").WorkStatus[] = ["PENDIENTE", "LABORATORIO", "MONTAJE", "DISPONIBLE", "ENTREGADO"];

export const PRODUCT_TYPE_LABEL: Record<import("@prisma/client").ProductType, string> = {
  ARMAZON: "Armazón",
  CRISTAL: "Cristal",
  LENTE_CONTACTO: "Lente de contacto",
  LIQUIDO: "Líquido",
  ACCESORIO: "Accesorio",
  LENTE_SOL: "Lente de sol",
  SERVICIO: "Servicio",
};
