"use client";
import { useEffect, useRef } from "react";
import { useLanguage } from "./language";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
export function Turnstile({
  action,
  onToken,
  reset,
}: {
  action: string;
  onToken: (token: string) => void;
  reset: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const { locale, t } = useLanguage();
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!key) return;
    let id: string | undefined;
    let timer: ReturnType<typeof setInterval>;
    const render = () => {
      if (window.turnstile && el.current && !id) {
        id = window.turnstile.render(el.current, {
          sitekey: key,
          action,
          language: locale,
          theme: "light",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(""),
          "error-callback": () => callback.current(""),
        });
        clearInterval(timer);
      }
    };
    if (!document.getElementById("turnstile-script")) {
      const s = document.createElement("script");
      s.id = "turnstile-script";
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      document.head.appendChild(s);
    }
    timer = setInterval(render, 150);
    render();
    return () => {
      clearInterval(timer);
      if (id) window.turnstile?.remove(id);
      callback.current("");
    };
  }, [action, locale, reset]);
  return (
    <div className="no-print">
      <p className="small muted">
        {t("Security check", "Verificación de seguridad")}
      </p>
      <div ref={el} />
      {!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <p className="small">
          {t(
            "Security verification is not configured. Submissions are unavailable.",
            "La verificación no está configurada. No se pueden enviar reportes.",
          )}
        </p>
      )}
    </div>
  );
}
