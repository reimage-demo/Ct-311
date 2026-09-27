"use client";
import { PageHeading } from "@/components/page-heading";
import { useLanguage } from "@/components/language";
export default function Privacy() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeading
        title={[
          "Privacy in this demonstration",
          "Privacidad en esta demostración",
        ]}
      />
      <article className="container page-body">
        <div className="article">
          <div className="notice warning">
            {t(
              "Use invented names, contact details, and non-sensitive photos. Do not submit real complaints or identifying information about other people.",
              "Use nombres y contactos ficticios y fotos no sensibles. No envíe quejas reales ni datos identificativos de otras personas.",
            )}
          </div>
          <h2>{t("Information stored", "Información almacenada")}</h2>
          <p>
            {t(
              "A report contains the issue, location, optional photos, your test name, and contact details. Authorized demonstration staff can review these records. Reports are stored in Convex; staff sign-in is handled by Clerk. Reports are not sent to the City of Hartford.",
              "Un reporte contiene el problema, la ubicación, fotos opcionales, nombre de prueba y datos de contacto. El personal autorizado puede revisar estos registros. Convex almacena los reportes y Clerk gestiona el acceso del personal. No se envían reportes a la Ciudad de Hartford.",
            )}
          </p>
          <h2>
            {t(
              "What a report number reveals",
              "Qué revela un número de reporte",
            )}
          </h2>
          <p>
            {t(
              "Anyone holding your report number can see its status and progress dates. They cannot use it to retrieve your name, contact information, address, description, photos, or staff notes. Keep the number with your receipt.",
              "Quien tenga su número puede ver el estado y las fechas de progreso. No puede usarlo para obtener su nombre, contacto, dirección, descripción, fotos o notas internas. Guarde el número con su recibo.",
            )}
          </p>
          <h2>
            {t(
              "Maps, photos, and security checks",
              "Mapas, fotos y verificaciones de seguridad",
            )}
          </h2>
          <p>
            {t(
              "Address searches and selected coordinates are processed by Geoapify. Device location is requested only when you choose “Use my location.” Cloudflare Turnstile checks for automated abuse. Uploaded images are re-encoded to remove embedded metadata before staff can view them.",
              "Geoapify procesa búsquedas de direcciones y coordenadas seleccionadas. Solo se solicita la ubicación del dispositivo al elegir “Usar mi ubicación”. Cloudflare Turnstile verifica el abuso automatizado. Se recodifican las imágenes para quitar metadatos antes de mostrarlas al personal.",
            )}
          </p>
          <h2>{t("Storage and retention", "Almacenamiento y conservación")}</h2>
          <p>
            {t(
              "Unfinished forms stay in browser memory. Uploaded photos and unfinished submission sessions expire after 24 hours and are removed by scheduled cleanup. Finalized demonstration reports remain until the demo operator removes them through a controlled maintenance process. A municipal retention policy must be established before any official use.",
              "Los formularios sin terminar permanecen en la memoria del navegador. Las fotos subidas y sesiones incompletas vencen a las 24 horas y se eliminan mediante limpieza programada. Los reportes finalizados permanecen hasta que el operador los elimine mediante mantenimiento controlado. Antes de cualquier uso oficial debe establecerse una política municipal de conservación.",
            )}
          </p>
          <p>
            {t(
              "We store your language preference on this device. No advertising analytics are included. Security rate limits use a keyed hash of the network address rather than retaining the raw address in the application database.",
              "Guardamos su preferencia de idioma en este dispositivo. No incluimos análisis publicitarios. Los límites de seguridad usan un hash de la dirección de red en lugar de guardar la dirección original en la base de datos.",
            )}
          </p>
          <h2>
            {t(
              "Questions or removal requests",
              "Preguntas o solicitudes de eliminación",
            )}
          </h2>
          <p>
            {t(
              "Contact the person who gave you access to this demonstration. City staff cannot access or remove records from this independent demo.",
              "Contacte a quien le dio acceso a esta demostración. El personal municipal no puede acceder ni eliminar registros de esta demostración independiente.",
            )}
          </p>
        </div>
      </article>
    </>
  );
}
