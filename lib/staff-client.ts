"use client";
import { useEffect, useState, useRef } from "react";
import type { Audit, Detail, Page, Report, Staff } from "./models";
const endpoints = {
  me: "me",
  members: "members",
  detail: "detail",
  list: "list",
  activity: "activity",
  update: "update",
  note: "note",
  saveMember: "saveMember",
} as const;
export const api = { staff: endpoints };
type ReadMap = {
  me: Staff;
  members: Staff[];
  detail: Detail | null;
  list: Page<Report>;
  activity: Page<Audit>;
};
export async function staffRequest<T>(
  operation: string,
  args: unknown,
): Promise<T> {
  const res = await fetch("/api/staff/" + operation, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (
    res.redirected ||
    !res.headers.get("content-type")?.includes("application/json")
  )
    throw Error("UNAUTHORIZED");
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "SERVICE_UNAVAILABLE");
  return data;
}
export function useQuery<K extends keyof ReadMap>(
  operation: K,
  args: unknown = {},
) {
  const key = JSON.stringify(args),
    [state, setState] = useState<{
      key: string;
      value?: ReadMap[K];
      error?: Error;
    }>({ key });
  useEffect(() => {
    let alive = true,
      busy = false;
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const value = await staffRequest<ReadMap[K]>(
          operation,
          JSON.parse(key),
        );
        if (alive) setState({ key, value });
      } catch (e) {
        if (alive)
          setState({
            key,
            error: e instanceof Error ? e : Error("SERVICE_UNAVAILABLE"),
          });
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("staff-refresh", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("staff-refresh", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [operation, key]);
  if (state.key === key && state.error) throw state.error;
  return state.key === key ? state.value : undefined;
}
export function useMutation(operation: "update" | "note" | "saveMember") {
  return async (args: unknown) => {
    const result = await staffRequest(operation, args);
    window.dispatchEvent(new Event("staff-refresh"));
    return result;
  };
}
export function usePaginatedQuery<K extends "list" | "activity">(
  operation: K,
  args: unknown,
  options: { initialNumItems: number },
) {
  const browsingEarlier = useRef(false);
  type Item = K extends "list" ? Report : Audit;
  const key = JSON.stringify(args),
    [page, setPage] = useState<{
      key: string;
      items: Item[];
      cursor: string | null;
      loading: boolean;
      error?: Error;
    }>({ key, items: [], cursor: null, loading: true });
  useEffect(() => {
    browsingEarlier.current = false;
    let alive = true,
      busy = false;
    const refresh = async () => {
      if (busy || document.hidden || browsingEarlier.current) return;
      busy = true;
      try {
        const result = await staffRequest<Page<Item>>(operation, {
          ...JSON.parse(key),
          limit: options.initialNumItems,
        });
        if (alive && !browsingEarlier.current)
          setPage({
            key,
            items: result.page,
            cursor: result.cursor,
            loading: false,
          });
      } catch (e) {
        if (alive)
          setPage({
            key,
            items: [],
            cursor: null,
            loading: false,
            error: e instanceof Error ? e : Error("SERVICE_UNAVAILABLE"),
          });
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    const manualRefresh = () => { browsingEarlier.current = false; void refresh(); };
    window.addEventListener("staff-refresh", manualRefresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("staff-refresh", manualRefresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [operation, key, options.initialNumItems]);
  if (page.key === key && page.error) throw page.error;
  const loadMore = async (limit: number) => {
    if (page.loading || !page.cursor) return;
    browsingEarlier.current = true;
    setPage((p) => ({ ...p, loading: true }));
    try {
      const result = await staffRequest<Page<Item>>(operation, {
        ...JSON.parse(key),
        limit,
        cursor: page.cursor,
      });
      setPage((p) =>
        p.key !== key
          ? p
          : {
              key,
              items: [
                ...p.items,
                ...result.page.filter(
                  (r) => !p.items.some((old) => old._id === r._id),
                ),
              ],
              cursor: result.cursor,
              loading: false,
            },
      );
    } catch (e) {
      setPage((p) => p.key !== key ? p : ({
        ...p,
        loading: false,
        error: e instanceof Error ? e : Error("SERVICE_UNAVAILABLE"),
      }));
    }
  };
  const fresh = page.key === key;
  return {
    results: fresh ? page.items : [],
    status:
      !fresh || (page.loading && !page.items.length)
        ? "LoadingFirstPage"
        : page.loading
          ? "LoadingMore"
          : page.cursor
            ? "CanLoadMore"
            : "Exhausted",
    loadMore,
  };
}
