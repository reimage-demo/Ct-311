"use client";
import { useLanguage } from "@/components/language";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="container page-body">
      <div className="page-heading">
        <h1>
          {t("This page could not load", "No se pudo cargar esta página")}
        </h1>
        <p>
          {t(
            "Please try again. If you need real city assistance, call 860-757-9311.",
            "Intente de nuevo. Para asistencia municipal real, llame al 860-757-9311.",
          )}
        </p>
      </div>
      <button className="button" onClick={reset}>
        {t("Try again", "Intentar de nuevo")}
      </button>
    </div>
  );
}
