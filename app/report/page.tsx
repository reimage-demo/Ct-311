import { Suspense } from "react";
import { ReportForm } from "@/components/report-form";
export default function Report() {
  return (
    <Suspense
      fallback={
        <div className="container loading">
          Loading form / Cargando formulario…
        </div>
      }
    >
      <ReportForm />
    </Suspense>
  );
}
