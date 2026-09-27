"use client";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language";
import { PageHeading } from "@/components/page-heading";
import { groups, services, groupLabel } from "@/lib/services";
export default function Services() {
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState("");
  const results = services.filter((s) =>
    (s.title[locale] + " " + s.description[locale])
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={["City services", "Servicios municipales"]}
        description={[
          "Find the right place to report a problem. Hartford 311 connects you with the department that can help.",
          "Encuentre dónde reportar un problema. Hartford 311 le conecta con el departamento que puede ayudar.",
        ]}
      />
      <div className="container page-body">
        <div className="field search-field">
          <label htmlFor="service-search">
            {t("Search services", "Buscar servicios")}
          </label>
          <input
            id="service-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              "Try “pothole,” “trash,” or “tree”",
              "Pruebe “bache”, “basura” o “árbol”",
            )}
          />
        </div>
        <nav
          className="directory-nav"
          aria-label={t("Service categories", "Categorías de servicios")}
        >
          {Object.keys(groups).map((g) => (
            <a key={g} href={"#" + g}>
              {groupLabel(g as keyof typeof groups, locale)}
            </a>
          ))}
        </nav>
        <p className="small muted" role="status">
          {results.length} {t("services", "servicios")}
        </p>
        {Object.keys(groups).map((group) => {
          const items = results.filter((s) => s.group === group);
          if (!items.length) return null;
          return (
            <section className="directory-group" id={group} key={group}>
              <h2>{groupLabel(group as keyof typeof groups, locale)}</h2>
              {items.map((s) => (
                <div className="directory-row" key={s.id}>
                  <div>
                    <h3>{s.title[locale]}</h3>
                    <p>{s.description[locale]}</p>
                    {s.urgent && (
                      <p>
                        <strong>
                          {t(
                            "Urgent concern: contact the city directly. This demo is not monitored.",
                            "Asunto urgente: contacte directamente a la ciudad. Esta demostración no se supervisa.",
                          )}
                        </strong>
                      </p>
                    )}
                  </div>
                  <Link href={"/report?service=" + s.id}>
                    {t("Start a test report", "Iniciar reporte de prueba")} →
                  </Link>
                </div>
              ))}
            </section>
          );
        })}
        {!results.length && (
          <div className="empty-state">
            <h2>{t("No matching services", "No se encontraron servicios")}</h2>
            <p>
              {t(
                "Try another word or call Hartford 311 at 860-757-9311.",
                "Pruebe otra palabra o llame a Hartford 311 al 860-757-9311.",
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
