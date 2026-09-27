"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language";
import { ContactAside } from "@/components/shell";
import { getService } from "@/lib/services";
export default function Home() {
  const { t, locale } = useLanguage();
  return (
    <>
      <section className="home-intro container">
        <div className="intro-main">
          <p className="section-kicker">
            {t("YOUR NEIGHBORHOOD. YOUR CITY.", "SU VECINDARIO. SU CIUDAD.")}
          </p>
          <h1>
            {t(
              "A pothole. A missed pickup.\nA place to start.",
              "Un bache. Basura sin recoger.\nUn lugar para empezar.",
            )}
          </h1>
          <p className="lead">
            {t(
              "Tell us what needs attention in Hartford. Find the right service, report an issue, and follow its progress.",
              "Cuéntenos qué necesita atención en Hartford. Encuentre el servicio adecuado, reporte un problema y consulte su progreso.",
            )}
          </p>
          <div className="actions">
            <Link className="button" href="/report">
              {t("Report an issue", "Reportar un problema")} <span>→</span>
            </Link>
            <Link className="button secondary" href="/status">
              {t("Check a report", "Consultar un reporte")}
            </Link>
          </div>
          <p className="form-hint">
            {t(
              "No account needed. Add a location and photos if you have them.",
              "No necesita cuenta. Agregue una ubicación y fotos si las tiene.",
            )}
          </p>
        </div>
        <div className="intro-side">
          <span className="large-311" aria-hidden="true">
            311<span>HARTFORD</span>
          </span>
          <div className="intro-note">
            <strong>
              {t(
                "Local issues. One starting point.",
                "Problemas locales. Un punto de partida.",
              )}
            </strong>
            <p>
              {t(
                "For non-emergency city services and information.",
                "Para servicios e información municipal no urgentes.",
              )}
            </p>
          </div>
        </div>
      </section>
      <section className="service-section container two-column">
        <div>
          <div className="section-title">
            <h2>{t("What needs attention?", "¿Qué necesita atención?")}</h2>
            <Link href="/services">
              {t("All services", "Todos los servicios")} →
            </Link>
          </div>
          <div className="service-list">
            {[
              "pothole",
              "missed-collection",
              "illegal-dumping",
              "streetlight",
              "snow",
              "tree",
            ].map((id, i) => {
              const s = getService(id)!;
              return (
                <Link
                  href={"/report?service=" + id}
                  className="service-row"
                  key={id}
                >
                  <span className="row-number">0{i + 1}</span>
                  <span>
                    <strong>{s.title[locale]}</strong>
                    <small>{s.description[locale]}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Link>
              );
            })}
          </div>
          <p className="subtle-note">
            {t(
              "Not sure where your issue belongs?",
              "¿No sabe qué servicio elegir?",
            )}{" "}
            <Link href="/services">
              {t(
                "Browse the service directory.",
                "Consulte el directorio de servicios.",
              )}
            </Link>
          </p>
        </div>
        <ContactAside />
      </section>
      <section className="how-section">
        <div className="container">
          <div className="section-title">
            <h2>
              {t("From report to resolution", "Del reporte a la resolución")}
            </h2>
            <span className="muted">
              {t("Know what happens next.", "Sepa qué sigue.")}
            </span>
          </div>
          <ol className="how-steps">
            {[
              [
                t("Tell us about the issue", "Describa el problema"),
                t(
                  "Choose a service, mark the location, and share what you noticed.",
                  "Elija un servicio, marque la ubicación y describa lo que observó.",
                ),
              ],
              [
                t("Save your report number", "Guarde su número de reporte"),
                t(
                  "Your receipt includes the number you’ll use to check progress.",
                  "Su recibo incluye el número para consultar el progreso.",
                ),
              ],
              [
                t("Follow the next steps", "Consulte los próximos pasos"),
                t(
                  "See when your report is reviewed, assigned, and resolved.",
                  "Vea cuándo su reporte se revisa, se asigna y se resuelve.",
                ),
              ],
            ].map(([title, body], i) => (
              <li key={i}>
                <span className="step-number">{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
