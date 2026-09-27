"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./language";
import { officialUrl } from "@/lib/domain";
export function Shell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useLanguage();
  const path = usePathname();
  return (
    <>
      <a className="skip-link" href="#main">
        {t("Skip to content", "Saltar al contenido")}
      </a>
      <div className="demo-bar">
        <div className="container">
          <span>
            <strong>{t("PROPOSAL DEMO", "DEMOSTRACIÓN")}</strong>
            <span className="demo-message">
              {t(
                "Test reports only. Not connected to the City of Hartford.",
                "Solo reportes de prueba. Sin conexión con la Ciudad de Hartford.",
              )}
            </span>
          </span>
          <a href={officialUrl}>
            {t("Official city services", "Servicios municipales oficiales")} ↗
          </a>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="wordmark" href="/" aria-label="Hartford 311 home">
            <span className="wordmark-number">311</span>
            <span>
              HARTFORD
              <small>{t("SERVICE REQUESTS", "SOLICITUDES DE SERVICIO")}</small>
            </span>
          </Link>
          <div className="header-tools">
            <a className="header-phone" href="tel:8607579311">
              860-757-9311
            </a>
            <button
              className="language-switch"
              onClick={() => setLocale(locale === "en" ? "es" : "en")}
              lang={locale === "en" ? "es" : "en"}
            >
              {locale === "en" ? "Español" : "English"}
            </button>
          </div>
        </div>
        <nav
          className="main-nav container"
          aria-label={t("Main navigation", "Navegación principal")}
        >
          {[
            ["/", "Home", "Inicio"],
            ["/services", "Services", "Servicios"],
            ["/report", "Report an issue", "Reportar un problema"],
            ["/status", "Check a report", "Consultar un reporte"],
            ["/contact", "Contact & help", "Contacto y ayuda"],
          ].map(([url, en, es]) => (
            <Link
              key={url}
              href={url}
              aria-current={path === url ? "page" : undefined}
            >
              {t(en, es)}
            </Link>
          ))}
          <Link
            href="/admin"
            className="staff-link"
            aria-current={path.startsWith("/admin") ? "page" : undefined}
          >
            {t("Staff sign in", "Acceso del personal")} ↗
          </Link>
        </nav>
      </header>
      <div className="emergency-strip container">
        <span className="emergency-label">
          {t("NON-EMERGENCY SERVICES", "SERVICIOS NO URGENTES")}
        </span>
        <span>
          {t(
            "Immediate danger or a medical emergency?",
            "¿Peligro inmediato o emergencia médica?",
          )}{" "}
          <a href="tel:911">{t("Call 911.", "Llame al 911.")}</a>
        </span>
      </div>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="footer-brand">Hartford 311</div>
            <p>
              {t(
                "A clearer way to report a local issue.",
                "Una forma más clara de reportar un problema local.",
              )}
            </p>
            <p className="small">
              {t(
                "City-proposal demonstration. Use test information only.",
                "Demostración de propuesta municipal. Use solo datos de prueba.",
              )}
            </p>
          </div>
          <div>
            <h2>{t("Reach Hartford 311", "Contacte a Hartford 311")}</h2>
            <a href="tel:8607579311">860-757-9311</a>
            <p>
              {t(
                "Monday–Friday, 8 a.m.–5 p.m.",
                "Lunes a viernes, 8 a. m.–5 p. m.",
              )}
              <br />
              550 Main Street, Suite 001
              <br />
              Hartford, CT 06103
            </p>
          </div>
          <div className="footer-links">
            <Link href="/privacy">{t("Privacy", "Privacidad")}</Link>
            <Link href="/accessibility">
              {t("Accessibility", "Accesibilidad")}
            </Link>
            <a href={officialUrl}>
              {t("Official Hartford 311", "Hartford 311 oficial")} ↗
            </a>
            <Link href="/admin">
              {t("Staff portal", "Portal del personal")}
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          {t(
            "Hartford 311 · Service portal demonstration",
            "Hartford 311 · Demostración del portal de servicios",
          )}
          <span>CONNECTICUT</span>
        </div>
      </footer>
    </>
  );
}
export function ContactAside() {
  const { t } = useLanguage();
  return (
    <aside className="contact-aside">
      <h2>
        {t("Prefer to talk to someone?", "¿Prefiere hablar con alguien?")}
      </h2>
      <p>
        {t(
          "Hartford 311 connects residents, businesses, and visitors with city services.",
          "Hartford 311 conecta a residentes, negocios y visitantes con servicios municipales.",
        )}
      </p>
      <a className="contact-number" href="tel:8607579311">
        860-757-9311
      </a>
      <p>
        {t("Monday–Friday", "Lunes a viernes")}
        <br />
        {t("8 a.m.–5 p.m.", "8 a. m.–5 p. m.")}
      </p>
      <hr />
      <h3>{t("Visit City Hall", "Visite el Ayuntamiento")}</h3>
      <p>
        550 Main Street, Suite 001
        <br />
        Hartford, CT 06103
      </p>
      <Link href="/contact">
        {t("Contact information & help", "Información de contacto y ayuda")} →
      </Link>
    </aside>
  );
}
