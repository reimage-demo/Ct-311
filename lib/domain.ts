export type Locale = "en" | "es";
export const statuses = [
  "received",
  "under_review",
  "assigned",
  "in_progress",
  "needs_information",
  "resolved",
  "closed",
] as const;
export type Status = (typeof statuses)[number];
export const statusLabels: Record<Status, [string, string]> = {
  received: ["Received", "Recibido"],
  under_review: ["Under review", "En revisión"],
  assigned: ["Assigned", "Asignado"],
  in_progress: ["In progress", "En proceso"],
  needs_information: ["Needs information", "Falta información"],
  resolved: ["Resolved", "Resuelto"],
  closed: ["Closed", "Cerrado"],
};
export const statusHelp: Record<Status, [string, string]> = {
  received: [
    "Your report has been received. Staff have not reviewed it yet.",
    "Su reporte fue recibido. El personal aún no lo ha revisado.",
  ],
  under_review: [
    "Staff are reviewing the report and the next steps.",
    "El personal está revisando el reporte y los próximos pasos.",
  ],
  assigned: [
    "The report has been assigned to a staff member.",
    "El reporte se asignó a un miembro del personal.",
  ],
  in_progress: [
    "Work on this report is in progress.",
    "Se está trabajando en este reporte.",
  ],
  needs_information: [
    "Staff need more information. They may use the contact details you provided.",
    "El personal necesita más información. Puede usar los datos de contacto que proporcionó.",
  ],
  resolved: [
    "Staff have marked the issue as resolved.",
    "El personal marcó el problema como resuelto.",
  ],
  closed: ["The report is closed.", "El reporte está cerrado."],
};
export const transitions: Record<Status, readonly Status[]> = {
  received: ["under_review", "needs_information", "closed"],
  under_review: [
    "assigned",
    "in_progress",
    "needs_information",
    "resolved",
    "closed",
  ],
  assigned: [
    "under_review",
    "in_progress",
    "needs_information",
    "resolved",
    "closed",
  ],
  in_progress: ["assigned", "needs_information", "resolved", "closed"],
  needs_information: ["under_review", "assigned", "in_progress", "closed"],
  resolved: ["closed", "under_review"],
  closed: ["under_review"],
};
export const MAX_PHOTOS = 6,
  MAX_PHOTO_BYTES = 10 * 1024 * 1024,
  MAX_PIXELS = 40_000_000;
export const officialUrl =
  "https://www.hartfordct.gov/Government/Departments/Public-Works/Hartford-311";
export function normalizeNumber(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^HFD/, "");
}
export function formatNumber(hex: string) {
  return (
    "HFD-" +
    hex
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join("-")
  );
}
export function withinHartford(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 41.7 &&
    lat <= 41.82 &&
    lng >= -72.76 &&
    lng <= -72.6
  );
}
export type Draft = {
  serviceId: string;
  description: string;
  address: string;
  landmark: string;
  latitude?: number;
  longitude?: number;
  locationMethod: "manual" | "search" | "pin" | "gps";
  name: string;
  email: string;
  phone: string;
  preferredContact: "email" | "phone";
  locale: Locale;
};
export function draftErrors(d: Draft) {
  const errors: string[] = [];
  if (!d.serviceId) errors.push("service");
  if (d.description.trim().length < 10 || d.description.length > 4000)
    errors.push("description");
  if (
    d.address.trim().length < 5 ||
    d.address.length > 300 ||
    d.landmark.length > 300
  )
    errors.push("address");
  if (
    (d.latitude === undefined) !== (d.longitude === undefined) ||
    (d.latitude !== undefined && !withinHartford(d.latitude, d.longitude!))
  )
    errors.push("coordinates");
  if (d.name.trim().length < 2 || d.name.length > 100) errors.push("name");
  if (!d.email.trim() && !d.phone.trim()) errors.push("contact");
  if (
    d.email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || d.email.length > 254)
  )
    errors.push("email");
  if (
    d.phone &&
    (d.phone.replace(/\D/g, "").length < 10 || d.phone.length > 30)
  )
    errors.push("phone");
  if (
    (d.preferredContact === "email" && !d.email) ||
    (d.preferredContact === "phone" && !d.phone)
  )
    errors.push("preferredContact");
  return errors;
}
export type PublicStatus = {
  status: Status;
  createdAt: number;
  updatedAt: number;
  history: { status: Status; at: number }[];
};
export function publicProjection(report: {
  status: Status;
  createdAt: number;
  updatedAt: number;
  history: { status: Status; at: number }[];
}): PublicStatus {
  return {
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    history: report.history.map(({ status, at }) => ({ status, at })),
  };
}
