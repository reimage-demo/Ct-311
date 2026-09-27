"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "./language";
import { PageHeading } from "./page-heading";
import { Turnstile } from "./turnstile";
import { services, getService } from "@/lib/services";
import {
  type Draft,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  draftErrors,
  withinHartford,
  officialUrl,
} from "@/lib/domain";
import { request, errorMessage, configured, randomToken } from "@/lib/client";
const Map = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => (
    <div className="map loading">Loading map / Cargando mapa…</div>
  ),
});
type Photo = {
  slot: string;
  file: File;
  preview: string;
  id?: string;
  progress: number;
  state: "waiting" | "uploading" | "ready" | "error";
  error?: string;
};
type Place = { address: string; latitude: number; longitude: number };
export function ReportForm() {
  const { t, locale } = useLanguage();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>({
    serviceId: getService(params.get("service") || "")?.id || "",
    description: "",
    address: "",
    landmark: "",
    locationMethod: "manual",
    name: "",
    email: "",
    phone: "",
    preferredContact: "email",
    locale,
  });
  const [photos, setPhotos] = useState<Photo[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(""),
    [copied, setCopied] = useState(false);
  const [verification, setVerification] = useState(""),
    [reset, setReset] = useState(0),
    [sessionReady, setSessionReady] = useState(false),
    [places, setPlaces] = useState<Place[]>([]),
    [mapMessage, setMapMessage] = useState(""),
    [searchBusy, setSearchBusy] = useState(false);
  const token = useRef(""),
    heading = useRef<HTMLHeadingElement>(null),
    photoRefs = useRef(photos);
  photoRefs.current = photos;
  const active = useRef(true);
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  const changed = !!(
    draft.description ||
    draft.address ||
    draft.name ||
    photos.length
  );
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (changed && !receipt) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [changed, receipt]);
  useEffect(() => {
    const leave = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (
        changed &&
        !receipt &&
        link?.href &&
        link.target !== "_blank" &&
        !event.metaKey && !event.ctrlKey && !event.shiftKey &&
        new URL(link.href).origin === location.origin &&
        !link.href.includes("#") &&
        !window.confirm(
          t(
            "Leave this form? Your unfinished report will be lost.",
            "¿Salir del formulario? Se perderá el reporte sin terminar.",
          ),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", leave, true);
    return () => document.removeEventListener("click", leave, true);
  }, [changed, receipt, t]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      for (const p of photoRefs.current) URL.revokeObjectURL(p.preview);
    };
  }, []);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const changeStep = (next: number) => {
    setError("");
    setStep(next);
    setTimeout(() => heading.current?.focus(), 0);
  };
  const selected = getService(draft.serviceId);
  const stepNames = [
    t("Issue", "Problema"),
    t("Location", "Ubicación"),
    t("Photos", "Fotos"),
    t("Contact", "Contacto"),
    t("Review", "Revisión"),
  ];
  function recoverExpiredSession(err: unknown) {
    if (!String(err).includes("SESSION_EXPIRED")) return;
    token.current = "";
    setSessionReady(false);
    setVerification("");
    setReset((value) => value + 1);
    setPhotos((items) => items.map((photo) => ({...photo, id: undefined, state: "waiting", progress: 0})));
    // Keep all entered details and local files, but require re-upload to a new session.
    if (photoRefs.current.length) setStep(2);
  }
  const ensureSession = async () => {
    if (sessionReady) return true;
    if (!verification) {
      setError(
        t(
          "Complete the security check to connect the map and photo uploads. You can still enter a location manually.",
          "Complete la verificación para conectar el mapa y las fotos. Puede ingresar una ubicación manualmente.",
        ),
      );
      return false;
    }
    if (!token.current) token.current = randomToken();
    setBusy(true);
    try {
      await request("start", { token: token.current, verification });
      setSessionReady(true);
      setError("");
      return true;
    } catch (e) {
      recoverExpiredSession(e);
      setError(errorMessage(String(e), locale));
      return false;
    } finally {
      setBusy(false);
      setReset((r) => r + 1);
    }
  };
  async function findAddress() {
    if (!(await ensureSession())) return;
    setSearchBusy(true);
    setMapMessage("");
    try {
      const result = await request<{ results: Place[] }>("geocode", {
        token: token.current,
        query: draft.address,
        locale,
      });
      setPlaces(result.results);
      if (!result.results.length)
        setMapMessage(
          t(
            "No matches. Enter an intersection or landmark instead.",
            "Sin coincidencias. Ingrese una intersección o punto de referencia.",
          ),
        );
    } catch (e) {
      recoverExpiredSession(e);
      setMapMessage(
        t(
          "Address search is unavailable. You can enter the location manually.",
          "La búsqueda no está disponible. Puede ingresar la ubicación manualmente.",
        ),
      );
    } finally {
      setSearchBusy(false);
    }
  }
  async function pin(lat: number, lng: number, method: "pin" | "gps" = "pin") {
    if (!withinHartford(lat, lng)) {
      setMapMessage(
        t(
          "Choose a location within Hartford. Enter the location manually if you are unsure.",
          "Elija una ubicación en Hartford. Ingrésela manualmente si no está seguro.",
        ),
      );
      return;
    }
    setDraft((d) => ({
      ...d,
      latitude: lat,
      longitude: lng,
      locationMethod: method,
    }));
    if (!sessionReady) return;
    try {
      const r = await request<{ results: Place[] }>("reverse", {
        token: token.current,
        latitude: lat,
        longitude: lng,
        locale,
      });
      if (r.results[0]) set("address", r.results[0].address);
      setMapMessage(
        t(
          "Pin set. Check the address and add any useful landmarks.",
          "Marcador colocado. Revise la dirección y agregue puntos de referencia.",
        ),
      );
    } catch (e) {
      recoverExpiredSession(e);
      setMapMessage(
        t(
          "Pin saved. Enter the address or intersection below.",
          "Marcador guardado. Ingrese la dirección o intersección.",
        ),
      );
    }
  }
  async function locate() {
    if (!(await ensureSession())) return;
    if (!navigator.geolocation) {
      setMapMessage(
        t(
          "Device location is unavailable. Enter the address manually.",
          "Ubicación del dispositivo no disponible. Ingrese la dirección manualmente.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => void pin(p.coords.latitude, p.coords.longitude, "gps"),
      () =>
        setMapMessage(
          t(
            "Location permission was denied or unavailable. You can still type an address or place a pin.",
            "No se pudo obtener permiso o ubicación. Puede escribir una dirección o colocar un marcador.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }
  function addFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    const incoming = Array.from(files);
    if (photos.length + incoming.length > MAX_PHOTOS) {
      setError(
        t("Choose no more than six photos.", "Elija un máximo de seis fotos."),
      );
      return;
    }
    if (
      incoming.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > MAX_PHOTO_BYTES ||
          f.size === 0,
      )
    ) {
      setError(
        t(
          "Use JPEG, PNG, or WebP images, up to 10 MB each. Convert HEIC photos to JPEG first.",
          "Use imágenes JPEG, PNG o WebP de hasta 10 MB cada una. Convierta fotos HEIC a JPEG primero.",
        ),
      );
      return;
    }
    setPhotos((p) => [
      ...p,
      ...incoming.map((file) => ({
        slot: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        state: "waiting" as const,
      })),
    ]);
  }
  function upload(p: Photo): Promise<void> {
    return new Promise((resolve, reject) => {
      setPhotos((all) =>
        all.map((f) =>
          f.slot === p.slot
            ? { ...f, state: "uploading", error: undefined }
            : f,
        ),
      );
      const xhr = new XMLHttpRequest();
      xhr.open("POST", process.env.NEXT_PUBLIC_CONVEX_SITE_URL + "/upload");
      xhr.setRequestHeader("Authorization", "Bearer " + token.current);
      xhr.setRequestHeader("X-Upload-Slot", p.slot);
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(p.file.name));
      xhr.setRequestHeader("Content-Type", p.file.type);
      xhr.timeout = 120000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && active.current)
          setPhotos((all) =>
            all.map((f) =>
              f.slot === p.slot
                ? {
                    ...f,
                    progress: Math.min(
                      95,
                      Math.round((e.loaded / e.total) * 95),
                    ),
                  }
                : f,
            ),
          );
      };
      const fail = (code: string) => {
        if (active.current)
          setPhotos((all) =>
            all.map((f) =>
              f.slot === p.slot
                ? { ...f, state: "error", error: errorMessage(code, locale) }
                : f,
            ),
          );
        recoverExpiredSession(code);
        reject(Error(code));
      };
      xhr.onerror = () => fail("REQUEST_FAILED");
      xhr.ontimeout = () => fail("REQUEST_FAILED");
      xhr.onload = () => {
        let result;
        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          fail("REQUEST_FAILED");
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          if (active.current)
            setPhotos((all) =>
              all.map((f) =>
                f.slot === p.slot
                  ? { ...f, id: result.id, progress: 100, state: "ready" }
                  : f,
              ),
            );
          resolve();
        } else fail(result.error || "REQUEST_FAILED");
      };
      xhr.send(p.file);
    });
  }
  async function uploadAll() {
    if (!(await ensureSession())) return false;
    setBusy(true);
    try {
      for (const p of photos.filter((p) => p.state !== "ready"))
        await upload(p);
      return true;
    } catch {
      setError(
        t(
          "A photo did not finish. Retry it or remove it to continue.",
          "Una foto no terminó. Reinténtela o quítela para continuar.",
        ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto(p: Photo) {
    if (p.state === "uploading") return;
    setBusy(true);
    try {
      if (sessionReady)
        await request("remove", { token: token.current, slot: p.slot });
      URL.revokeObjectURL(p.preview);
      setPhotos((all) => all.filter((f) => f.slot !== p.slot));
    } catch (e) {
      recoverExpiredSession(e);
      setError(errorMessage(String(e), locale));
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    const errors = draftErrors({ ...draft, locale });
    const invalid = (keys: string[]) => errors.some((e) => keys.includes(e));
    if (step === 0 && invalid(["service", "description"])) {
      setError(
        t(
          "Choose a service and describe the issue in 10–4,000 characters.",
          "Elija un servicio y describa el problema en 10 a 4.000 caracteres.",
        ),
      );
      return;
    }
    if (step === 1 && invalid(["address", "coordinates"])) {
      setError(
        t(
          "Enter a Hartford address, intersection, or landmark with at least 5 characters. Check any selected coordinates.",
          "Ingrese una dirección, intersección o referencia de Hartford con al menos 5 caracteres. Revise las coordenadas.",
        ),
      );
      return;
    }
    if (
      step === 2 &&
      photos.some((p) => p.state !== "ready") &&
      !(await uploadAll())
    )
      return;
    if (
      step === 3 &&
      invalid(["name", "contact", "email", "phone", "preferredContact"])
    ) {
      setError(
        t(
          "Enter your name and a valid email or phone number. Your preferred contact method must be provided.",
          "Ingrese su nombre y un correo o teléfono válido. Debe proporcionar su medio de contacto preferido.",
        ),
      );
      return;
    }
    changeStep(step + 1);
  }
  const [consent, setConsent] = useState(false);
  async function submit() {
    setError("");
    if (!consent) return;
    if (!(await ensureSession())) return;
    setBusy(true);
    try {
      const r = await request<{ number: string }>("submit", {
        token: token.current,
        draft: { ...draft, locale },
        acknowledged: consent,
      });
      setReceipt(r.number);
      setTimeout(() => heading.current?.focus(), 0);
    } catch (e) {
      recoverExpiredSession(e);
      setError(errorMessage(String(e), locale));
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <>
        <PageHeading
          title={[
            "Your test report is received",
            "Su reporte de prueba fue recibido",
          ]}
        />
        <section className="container page-body">
          <div className="article">
            <div className="notice success">
              <h2 ref={heading} tabIndex={-1}>
                {t("Save your report number", "Guarde su número de reporte")}
              </h2>
              <p>
                {t(
                  "You’ll need this number to check progress. No email or text message will be sent.",
                  "Necesitará este número para consultar el progreso. No se enviarán correos ni mensajes de texto.",
                )}
              </p>
            </div>
            <div className="receipt-number">{receipt}</div>
            <div className="actions">
              <button
                className="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(receipt);
                    setCopied(true);
                  } catch {
                    setError(
                      t(
                        "Select the number above to copy it.",
                        "Seleccione el número de arriba para copiarlo.",
                      ),
                    );
                  }
                }}
              >
                {copied
                  ? t("Copied", "Copiado")
                  : t("Copy number", "Copiar número")}
              </button>
              <button
                className="button secondary"
                onClick={() => window.print()}
              >
                {t("Print receipt", "Imprimir recibo")}
              </button>
              <Link href="/status">
                {t("Check progress", "Consultar progreso")} →
              </Link>
            </div>
            {error && <p role="alert">{error}</p>}
            <p>
              {selected?.title[locale]}
              <br />
              {draft.address}
            </p>
            <p className="notice warning">
              {t(
                "This is a test report. It has not been sent to the City of Hartford.",
                "Este es un reporte de prueba. No se envió a la Ciudad de Hartford.",
              )}
            </p>
          </div>
        </section>
      </>
    );
  return (
    <>
      <PageHeading
        title={["Report an issue", "Reportar un problema"]}
        description={[
          "Tell us what happened and where. We’ll guide you through each step.",
          "Cuéntenos qué ocurrió y dónde. Le guiaremos paso a paso.",
        ]}
      />
      <div className="container form-layout">
        <aside>
          <ol
            className="form-steps"
            aria-label={t("Report steps", "Pasos del reporte")}
          >
            {stepNames.map((name, i) => (
              <li
                key={i}
                className={i === step ? "active" : i < step ? "complete" : ""}
                aria-current={i === step ? "step" : undefined}
              >
                <span className="step-index">
                  {i < step ? "✓" : `0${i + 1}`}
                </span>
                {name}
              </li>
            ))}
          </ol>
        </aside>
        <div className="step-panel">
          {!configured() && (
            <div className="notice warning">
              <strong>
                {t(
                  "Preview — reporting is not connected",
                  "Vista previa: reportes sin conexión",
                )}
              </strong>
              <p>
                {t(
                  "You can explore the form. Saving reports and photos requires the secure backend to be configured.",
                  "Puede explorar el formulario. Para guardar reportes y fotos debe configurarse el sistema seguro.",
                )}
              </p>
            </div>
          )}
          <h2 ref={heading} tabIndex={-1}>
            {
              [
                t("What needs attention?", "¿Qué necesita atención?"),
                t("Where is the issue?", "¿Dónde está el problema?"),
                t(
                  "Add photos, if you have them",
                  "Agregue fotos, si las tiene",
                ),
                t(
                  "How can staff reach you?",
                  "¿Cómo puede contactarle el personal?",
                ),
                t("Review your test report", "Revise su reporte de prueba"),
              ][step]
            }
          </h2>
          <p>{t(`Step ${step + 1} of 5`, `Paso ${step + 1} de 5`)}</p>
          {step === 0 && (
            <>
              <div className="field">
                <label htmlFor="issue-search">
                  {t("Find a service", "Buscar un servicio")}
                </label>
                <input
                  id="issue-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(
                    "Search potholes, trash, trees…",
                    "Buscar baches, basura, árboles…",
                  )}
                />
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="sr-only">
                  {t("Choose a service", "Elija un servicio")}
                </legend>
                <div className="choice-list">
                  {services
                    .filter((s) =>
                      (s.title[locale] + " " + s.description[locale])
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((s) => (
                      <label className="choice" key={s.id}>
                        <input
                          type="radio"
                          aria-label={s.title[locale]}
                          name="service"
                          value={s.id}
                          checked={draft.serviceId === s.id}
                          onChange={() => set("serviceId", s.id)}
                        />
                        <span>
                          <strong>{s.title[locale]}</strong>
                          {draft.serviceId === s.id && (
                            <small>{s.description[locale]}</small>
                          )}
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
              {selected?.urgent && (
                <div className="notice warning">
                  <strong>
                    {t(
                      "Please contact the city directly for urgent help.",
                      "Contacte directamente a la ciudad para ayuda urgente.",
                    )}
                  </strong>
                  <p>
                    {t(
                      "This demonstration is not monitored. Call 911 for immediate danger.",
                      "Esta demostración no se supervisa. Llame al 911 si hay peligro inmediato.",
                    )}{" "}
                    <a
                      href={
                        selected.id === "tree-urgent"
                          ? "https://www.hartfordct.gov/Government/Departments/Public-Works/Forestry/Report-a-Tree-Emergency"
                          : officialUrl
                      }
                    >
                      {t("Official guidance", "Guía oficial")} ↗
                    </a>
                  </p>
                </div>
              )}
              <div className="field">
                <label htmlFor="description">
                  {t("Describe the issue", "Describa el problema")} *
                </label>
                <textarea
                  id="description"
                  maxLength={4000}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder={t(
                    "What did you notice? When did it start?",
                    "¿Qué observó? ¿Cuándo comenzó?",
                  )}
                />
                <small>
                  {t(
                    "10–4,000 characters. Do not include sensitive personal information.",
                    "10 a 4.000 caracteres. No incluya información personal sensible.",
                  )}
                </small>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              {!sessionReady && configured() && (
                <div className="notice">
                  <p>
                    {t(
                      "Complete a security check to use address search and device location. Manual entry is always available.",
                      "Complete la verificación para buscar direcciones o usar su ubicación. Siempre puede ingresar datos manualmente.",
                    )}
                  </p>
                  <Turnstile
                    action="start"
                    onToken={setVerification}
                    reset={reset}
                  />
                  <button
                    className="text-button"
                    disabled={busy || !verification}
                    onClick={() => void ensureSession()}
                  >
                    {t(
                      "Enable location tools",
                      "Activar herramientas de ubicación",
                    )}
                  </button>
                </div>
              )}
              <div className="field">
                <label htmlFor="address">
                  {t(
                    "Street address or intersection",
                    "Dirección o intersección",
                  )}{" "}
                  *
                </label>
                <input
                  id="address"
                  maxLength={300}
                  value={draft.address}
                  onChange={(e) => {
                    setDraft((d) => ({
                      ...d,
                      address: e.target.value,
                      latitude: undefined,
                      longitude: undefined,
                      locationMethod: "manual",
                    }));
                    setPlaces([]);
                  }}
                  placeholder={t(
                    "Example: Main Street & Gold Street",
                    "Ejemplo: Main Street y Gold Street",
                  )}
                />
                <small>
                  {t(
                    "The issue must be within Hartford, Connecticut.",
                    "El problema debe estar en Hartford, Connecticut.",
                  )}
                </small>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="button secondary small-button"
                  disabled={
                    !configured() ||
                    draft.address.length < 3 ||
                    searchBusy ||
                    busy
                  }
                  onClick={() => void findAddress()}
                >
                  {searchBusy
                    ? t("Searching…", "Buscando…")
                    : t("Find address", "Buscar dirección")}
                </button>
                <button
                  className="text-button"
                  disabled={!configured() || busy}
                  onClick={() => void locate()}
                >
                  {t("Use my location", "Usar mi ubicación")}
                </button>
              </div>
              {places.length > 0 && (
                <ul className="suggestions">
                  {places.map((p) => (
                    <li key={p.address}>
                      <button
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            ...p,
                            locationMethod: "search",
                          }));
                          setPlaces([]);
                        }}
                      >
                        {p.address}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY ? (
                <>
                  <Map
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onChange={(lat, lng) => void pin(lat, lng)}
                  />
                  <p className="small muted">
                    {t(
                      "Select the map or drag the pin. You can also enter the address without using the map.",
                      "Seleccione el mapa o arrastre el marcador. También puede ingresar la dirección sin usar el mapa.",
                    )}
                  </p>
                </>
              ) : (
                <div className="notice">
                  {t(
                    "Map preview is not configured. Enter an address or intersection above.",
                    "El mapa no está configurado. Ingrese una dirección o intersección arriba.",
                  )}
                </div>
              )}
              {draft.latitude !== undefined && (
                <p className="small">
                  {draft.latitude.toFixed(5)}, {draft.longitude?.toFixed(5)}{" "}
                  <button
                    className="text-button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        latitude: undefined,
                        longitude: undefined,
                        locationMethod: "manual",
                      }))
                    }
                  >
                    {t("Clear pin", "Quitar marcador")}
                  </button>
                </p>
              )}
              {mapMessage && (
                <p className="notice" role="status">
                  {mapMessage}
                </p>
              )}
              <div className="field">
                <label htmlFor="landmark">
                  {t(
                    "Landmark or location details (optional)",
                    "Punto de referencia o detalles (opcional)",
                  )}
                </label>
                <input
                  id="landmark"
                  maxLength={300}
                  value={draft.landmark}
                  onChange={(e) => set("landmark", e.target.value)}
                  placeholder={t(
                    "Near the bus stop, on the east side…",
                    "Cerca de la parada de autobús, lado este…",
                  )}
                />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                {t(
                  "A clear photo can help staff understand the issue. Do not include faces, license plates, or private documents.",
                  "Una foto clara ayuda al personal a entender el problema. No incluya rostros, matrículas ni documentos privados.",
                )}
              </p>
              <label className="upload-area">
                <strong>{t("Choose photos", "Elegir fotos")}</strong>
                <span>
                  {t(
                    "Up to 6 photos · JPEG, PNG, WebP · 10 MB each",
                    "Hasta 6 fotos · JPEG, PNG, WebP · 10 MB cada una",
                  )}
                </span>
                <input
                  aria-label={t("Choose photos", "Elegir fotos")}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="photos">
                {photos.map((p) => (
                  <div className="photo-item" key={p.slot}>
                    <img
                      src={p.preview}
                      alt={t(
                        "Selected report photo",
                        "Foto seleccionada para el reporte",
                      )}
                    />
                    <p>{p.file.name}</p>
                    <progress
                      value={p.progress}
                      max={100}
                      aria-label={t(
                        "Photo upload progress",
                        "Progreso de carga de foto",
                      )}
                    />
                    <p>
                      {p.state === "ready"
                        ? t("Uploaded", "Subida")
                        : p.state === "uploading"
                          ? t(
                              "Uploading and checking…",
                              "Subiendo y verificando…",
                            )
                          : p.state === "error"
                            ? p.error
                            : t("Ready to upload", "Lista para subir")}
                    </p>
                    {p.state === "error" && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={async () => {
                          if (await ensureSession()) {
                            setBusy(true);
                            try {
                              await upload(p);
                            } catch {
                            } finally {
                              setBusy(false);
                            }
                          }
                        }}
                      >
                        {t("Retry", "Reintentar")}
                      </button>
                    )}{" "}
                    <button
                      className="text-button"
                      disabled={busy || p.state === "uploading"}
                      onClick={() => void removePhoto(p)}
                    >
                      {t("Remove", "Quitar")}
                    </button>
                  </div>
                ))}
              </div>
              {photos.length > 0 && !sessionReady && (
                <Turnstile
                  action="start"
                  onToken={setVerification}
                  reset={reset}
                />
              )}
              <p className="small muted">
                {t(
                  "No photos? You can continue without them.",
                  "¿No tiene fotos? Puede continuar sin ellas.",
                )}
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <div className="notice">
                {t(
                  "For this demonstration, use a made-up name and test contact information. Contact details are visible only to authorized staff.",
                  "Para esta demostración, use un nombre ficticio y datos de contacto de prueba. Solo el personal autorizado puede verlos.",
                )}
              </div>
              <div className="field">
                <label htmlFor="name">
                  {t("Full name", "Nombre completo")} *
                </label>
                <input
                  id="name"
                  autoComplete="name"
                  value={draft.name}
                  maxLength={100}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="email">
                    {t("Email", "Correo electrónico")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={draft.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">{t("Phone", "Teléfono")}</label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    value={draft.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
              </div>
              <p className="small muted">
                {t(
                  "Provide at least one: email or phone.",
                  "Proporcione al menos uno: correo o teléfono.",
                )}
              </p>
              <div className="field">
                <label htmlFor="preferred">
                  {t("Preferred contact method", "Medio de contacto preferido")}
                </label>
                <select
                  id="preferred"
                  value={draft.preferredContact}
                  onChange={(e) =>
                    set("preferredContact", e.target.value as "email" | "phone")
                  }
                >
                  <option value="email">
                    {t("Email", "Correo electrónico")}
                  </option>
                  <option value="phone">
                    {t("Phone call", "Llamada telefónica")}
                  </option>
                </select>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              {[
                [
                  t("Issue", "Problema"),
                  selected?.title[locale] + "\n" + draft.description,
                  0,
                ],
                [
                  t("Location", "Ubicación"),
                  draft.address + (draft.landmark ? "\n" + draft.landmark : ""),
                  1,
                ],
                [
                  t("Photos", "Fotos"),
                  t(
                    `${photos.length} photos uploaded`,
                    `${photos.length} fotos subidas`,
                  ),
                  2,
                ],
                [
                  t("Contact", "Contacto"),
                  [draft.name, draft.email, draft.phone]
                    .filter(Boolean)
                    .join("\n"),
                  3,
                ],
              ].map(([label, value, i]) => (
                <section className="review-section" key={String(label)}>
                  <header>
                    <h3>{label}</h3>
                    <button
                      className="text-button"
                      onClick={() => changeStep(Number(i))}
                    >
                      {t("Edit", "Editar")}
                      <span className="sr-only"> {label}</span>
                    </button>
                  </header>
                  <p>{value}</p>
                </section>
              ))}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {t(
                    "I understand this is a test report, not a request to the City of Hartford. I have read the",
                    "Entiendo que es un reporte de prueba, no una solicitud a la Ciudad de Hartford. He leído el",
                  )}{" "}
                  <Link href="/privacy" target="_blank">
                    {t("privacy notice", "aviso de privacidad")}
                  </Link>
                  .
                </span>
              </label>
              {!sessionReady && (
                <Turnstile
                  action="start"
                  onToken={setVerification}
                  reset={reset}
                />
              )}
            </>
          )}
          {error && (
            <div className="notice error" role="alert" tabIndex={-1} ref={errorSummary}>
              {error}
            </div>
          )}
          <div className="form-actions">
            <button
              className="text-button"
              onClick={() => changeStep(step - 1)}
              disabled={step === 0 || busy}
            >
              {t("Back", "Atrás")}
            </button>
            {step < 4 ? (
              <button
                className="button"
                disabled={busy}
                onClick={() => void next()}
              >
                {busy
                  ? t("Please wait…", "Espere…")
                  : t("Continue", "Continuar")}{" "}
                →
              </button>
            ) : (
              <button
                className="button"
                disabled={busy || !consent || !configured()}
                onClick={() => void submit()}
              >
                {busy
                  ? t("Submitting…", "Enviando…")
                  : t("Submit test report", "Enviar reporte de prueba")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
