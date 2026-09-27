"use client";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { ContactAside } from "@/components/shell";
import { useLanguage } from "@/components/language";
import { officialUrl } from "@/lib/domain";
export default function Contact() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeading
        title={["Contact & help", "Contacto y ayuda"]}
        description={[
          "A city service starts with the right contact.",
          "Un servicio municipal comienza con el contacto correcto.",
        ]}
      />
      <div className="container page-body two-column">
        <div className="article">
          <div className="notice warning">
            <h2>
              {t(
                "Need the City of Hartford to act?",
                "¿Necesita que actúe la Ciudad de Hartford?",
              )}
            </h2>
            <p>
              {t(
                "This is a proposal demonstration. Test reports stay in this portal and are not sent to the city.",
                "Esta es una demostración de propuesta. Los reportes de prueba permanecen en este portal y no se envían a la ciudad.",
              )}{" "}
              <a href={officialUrl}>
                {t("Use official Hartford 311.", "Use Hartford 311 oficial.")}
              </a>
            </p>
          </div>
          <h2>{t("What does 311 do?", "¿Qué hace el 311?")}</h2>
          <p>
            {t(
              "Hartford 311 is the city’s non-emergency contact center. It takes service requests and helps residents, businesses, and visitors find city services and information. Different departments carry out the work.",
              "Hartford 311 es el centro de contacto municipal para asuntos no urgentes. Recibe solicitudes y ayuda a residentes, negocios y visitantes a encontrar servicios e información. Distintos departamentos realizan el trabajo.",
            )}
          </p>
          <h2>{t("Common questions", "Preguntas frecuentes")}</h2>
          {[
            [
              t(
                "How do I schedule bulky-waste pickup?",
                "¿Cómo programo la recolección de objetos voluminosos?",
              ),
              t(
                "Call Hartford 311 at 860-757-9311 or Public Works at 860-757-9983. Reporting dumped items does not schedule a pickup.",
                "Llame a Hartford 311 al 860-757-9311 o a Obras Públicas al 860-757-9983. Reportar basura abandonada no programa una recolección.",
              ),
            ],
            [
              t(
                "Can I check an existing city report here?",
                "¿Puedo consultar aquí un reporte municipal existente?",
              ),
              t(
                "No. This portal only tracks test reports created here. Use the city’s official Accela record lookup for existing municipal records.",
                "No. Este portal solo rastrea reportes de prueba creados aquí. Use Accela, el sistema oficial de la ciudad, para registros municipales.",
              ),
            ],
            [
              t(
                "I lost my test report number. What can I do?",
                "Perdí mi número de reporte de prueba. ¿Qué puedo hacer?",
              ),
              t(
                "Check your saved or printed receipt. This demonstration does not send email or text messages and has no public search by name, email, or phone. Ask the person who invited you to the demonstration for help.",
                "Revise su recibo guardado o impreso. Esta demostración no envía correos ni mensajes de texto y no permite búsquedas públicas por nombre, correo o teléfono. Pida ayuda a quien le invitó a la demostración.",
              ),
            ],
            [
              t(
                "Do I need an account or photos?",
                "¿Necesito una cuenta o fotos?",
              ),
              t(
                "No account is required. Photos are optional. Provide a name and at least one way to contact you, using test information in this demonstration.",
                "No necesita cuenta. Las fotos son opcionales. Proporcione un nombre y al menos un medio de contacto, usando datos de prueba en esta demostración.",
              ),
            ],
          ].map(([q, a]) => (
            <details className="faq" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <p style={{ marginTop: 24 }}>
            <a href="https://aca-prod.accela.com/HARTFORD/Default.aspx">
              {t(
                "Official city record lookup",
                "Consulta oficial de registros municipales",
              )}{" "}
              ↗
            </a>
          </p>
          <Link href="/accessibility">
            {t(
              "Accessibility and reporting alternatives",
              "Accesibilidad y alternativas para reportar",
            )}
          </Link>
        </div>
        <ContactAside />
      </div>
    </>
  );
}
