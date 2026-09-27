"use client";
import Link from "next/link";
import { useLanguage } from "./language";
export function PageHeading({
  title,
  description,
}: {
  title: [string, string];
  description?: [string, string];
}) {
  const { t } = useLanguage();
  return (
    <div className="page-heading container">
      <div className="breadcrumb">
        <Link href="/">{t("Home", "Inicio")}</Link>
        <span>/</span>
        <span>{t(...title)}</span>
      </div>
      <h1>{t(...title)}</h1>
      {description && <p className="lead">{t(...description)}</p>}
    </div>
  );
}
