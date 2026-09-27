"use client";
import { PageHeading } from "@/components/page-heading";
import { useLanguage } from "@/components/language";
export default function Accessibility() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeading title={["Accessibility", "Accesibilidad"]} />
      <article className="container page-body">
        <div className="article">
          <p>
            {t(
              "This portal is designed for keyboard use, screen readers, enlarged text, and mobile devices, with WCAG 2.2 AA as the testing target. This statement is not a certification.",
              "Este portal está diseñado para teclado, lectores de pantalla, texto ampliado y dispositivos móviles, con WCAG 2.2 AA como objetivo de pruebas. Esta declaración no es una certificación.",
            )}
          </p>
          <h2>{t("Ways to report", "Formas de reportar")}</h2>
          <ul>
            <li>
              {t(
                "Enter a street address, intersection, or landmark instead of moving a map pin.",
                "Escriba una dirección, intersección o punto de referencia en lugar de mover un marcador.",
              )}
            </li>
            <li>
              {t(
                "Photos are optional. A written description is enough to continue.",
                "Las fotos son opcionales. Basta una descripción escrita para continuar.",
              )}
            </li>
            <li>
              {t(
                "Use the English/Español control at any time; your current form stays in place.",
                "Use el control English/Español en cualquier momento; su formulario se conserva.",
              )}
            </li>
            <li>
              {t(
                "For real city assistance by phone, call Hartford 311 at 860-757-9311, weekdays from 8 a.m. to 5 p.m.",
                "Para asistencia municipal real por teléfono, llame al 860-757-9311, de lunes a viernes de 8 a. m. a 5 p. m.",
              )}
            </li>
          </ul>
          <h2>
            {t(
              "Report an accessibility problem",
              "Reporte un problema de accesibilidad",
            )}
          </h2>
          <p>
            {t(
              "Tell the demonstration organizer which page or step was difficult, your device/browser, and your preferred way to be contacted. Avoid including private complaint details.",
              "Indique al organizador qué página o paso fue difícil, su dispositivo y navegador, y su medio de contacto preferido. Evite incluir detalles privados del reporte.",
            )}
          </p>
        </div>
      </article>
    </>
  );
}
