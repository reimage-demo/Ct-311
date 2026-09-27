"use client";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language";
import { PageHeading } from "@/components/page-heading";
import { ContactAside } from "@/components/shell";
import { Turnstile } from "@/components/turnstile";
import { configured, request, errorMessage } from "@/lib/client";
import { statusLabels, statusHelp, type PublicStatus } from "@/lib/domain";
export default function Status() {
  const { t, locale } = useLanguage();
  const [number, setNumber] = useState(""),
    [verification, setVerification] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<PublicStatus | null | undefined>();
  const index = locale === "en" ? 0 : 1;
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      setResult(
        await request<PublicStatus | null>("lookup", { number, verification }),
      );
    } catch (e) {
      setError(errorMessage(String(e), locale));
    } finally {
      setBusy(false);
      setReset((v) => v + 1);
    }
  }
  return (
    <>
      <PageHeading
        title={["Check a report", "Consultar un reporte"]}
        description={[
          "Enter the number from your receipt to see the latest progress.",
          "Ingrese el número de su recibo para ver el progreso más reciente.",
        ]}
      />
      <div className="container page-body two-column">
        <div>
          <div className="notice">
            {t(
              "This page tracks demo reports only. For an existing city request,",
              "Esta página solo consulta reportes de demostración. Para una solicitud municipal,",
            )}{" "}
            <a href="https://aca-prod.accela.com/HARTFORD/Default.aspx">
              {t(
                "use Hartford’s official record lookup.",
                "use la consulta oficial de Hartford.",
              )}
            </a>
          </div>
          {!configured() && (
            <div className="notice warning">
              {t(
                "Status lookup is not connected yet. No report records are available in this preview.",
                "La consulta de estado aún no está conectada. No hay registros disponibles en esta vista previa.",
              )}
            </div>
          )}
          <form onSubmit={lookup}>
            <div className="field">
              <label htmlFor="report-number">
                {t("Report number", "Número de reporte")}
              </label>
              <input
                id="report-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={80}
                required
                placeholder="HFD-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              />
              <small>
                {t(
                  "Use the complete number, including all eight groups.",
                  "Use el número completo, incluidos los ocho grupos.",
                )}
              </small>
            </div>
            <Turnstile
              action="lookup"
              onToken={setVerification}
              reset={reset}
            />
            <div className="actions">
              <button
                className="button"
                disabled={!configured() || !verification || busy}
              >
                {busy
                  ? t("Checking…", "Consultando…")
                  : t("Check progress", "Consultar progreso")}{" "}
                →
              </button>
            </div>
          </form>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {result === null && (
            <div className="notice" role="status">
              <strong>
                {t("No matching report", "No se encontró un reporte")}
              </strong>
              <p>
                {t(
                  "Check the complete number on your receipt and try again.",
                  "Revise el número completo de su recibo e intente de nuevo.",
                )}
              </p>
            </div>
          )}
          {result && (
            <section className="status-result" aria-live="polite">
              <p className="section-kicker">
                {t("CURRENT STATUS", "ESTADO ACTUAL")}
              </p>
              <h2>{statusLabels[result.status][index]}</h2>
              <p>{statusHelp[result.status][index]}</p>
              <ol className="timeline">
                {result.history.map((event, i) => (
                  <li key={i}>
                    <strong>{statusLabels[event.status][index]}</strong>
                    <time>
                      {new Date(event.at).toLocaleString(
                        locale === "en" ? "en-US" : "es-US",
                        { timeZone: "America/New_York" },
                      )}
                    </time>
                  </li>
                ))}
              </ol>
              <p className="small muted">
                {t(
                  "All times shown in Eastern Time.",
                  "Todas las horas se muestran en la hora del este.",
                )}
              </p>
            </section>
          )}
          <p className="small">
            <Link href="/contact">
              {t(
                "Lost your number? Read our help page.",
                "¿Perdió su número? Consulte la página de ayuda.",
              )}
            </Link>
          </p>
        </div>
        <ContactAside />
      </div>
    </>
  );
}
