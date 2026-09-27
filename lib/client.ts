import type { Locale } from "./domain";
const messages: Record<string, [string, string]> = {
  SETUP_REQUIRED: [
    "Online reporting is not configured yet. This demo cannot accept a report.",
    "Los reportes en línea aún no están configurados. Esta demostración no puede recibir reportes.",
  ],
  SESSION_EXPIRED: [
    "Your secure session expired. Verify again to continue.",
    "Su sesión segura venció. Verifique de nuevo para continuar.",
  ],
  VERIFICATION_FAILED: [
    "Please complete the security check again.",
    "Complete nuevamente la verificación de seguridad.",
  ],
  RATE_LIMITED: [
    "Too many requests. Wait a minute and try again.",
    "Demasiadas solicitudes. Espere un minuto e intente de nuevo.",
  ],
  INVALID_FILE: [
    "This photo could not be read. Choose a JPEG, PNG, or WebP image under 10 MB.",
    "No se pudo leer la foto. Elija una imagen JPEG, PNG o WebP de menos de 10 MB.",
  ],
  UPLOAD_LIMIT: [
    "The photo limit has been reached. Remove a photo or start a new session.",
    "Se alcanzó el límite de fotos. Quite una foto o inicie una nueva sesión.",
  ],
  UPLOAD_IN_PROGRESS: [
    "This photo is still processing. Try again shortly.",
    "Esta foto aún se está procesando. Intente de nuevo pronto.",
  ],
  PHOTOS_PENDING: [
    "Wait for all photos to finish, or remove unsuccessful uploads.",
    "Espere a que terminen todas las fotos o quite las que fallaron.",
  ],
  CONFLICT: [
    "Another staff member changed this report. Refresh the form before saving.",
    "Otro miembro del personal cambió el reporte. Actualice el formulario.",
  ],
};
export const errorMessage = (code: string, locale: Locale) =>
  (messages[Object.keys(messages).find((k) => code.includes(k)) || ""] || [
    "We could not complete that request. Your form is still here; please try again.",
    "No se pudo completar la solicitud. Su formulario se conserva; intente de nuevo.",
  ])[locale === "en" ? 0 : 1];
export async function request<T>(operation: string, body: unknown): Promise<T> {
  const res = await fetch("/api/public/" + operation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "REQUEST_FAILED");
  return data;
}
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_CONVEX_URL &&
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL &&
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
