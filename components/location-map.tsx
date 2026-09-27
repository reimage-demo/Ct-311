"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function LocationMap({
  latitude,
  longitude,
  onChange,
  readonly = false,
}: {
  latitude?: number;
  longitude?: number;
  onChange?: (lat: number, lng: number) => void;
  readonly?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    marker = useRef<L.Marker | null>(null),
    handler = useRef(onChange);
  handler.current = onChange;
  useEffect(() => {
    if (!el.current || !process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY) return;
    const m = L.map(el.current, { scrollWheelZoom: false }).setView(
      [latitude ?? 41.7637, longitude ?? -72.6851],
      14,
    );
    map.current = m;
    L.tileLayer(
      "https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=" +
        process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY,
      {
        maxZoom: 19,
        attribution:
          '<a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
      },
    ).addTo(m);
    const place = (lat: number, lng: number) => {
      if (marker.current) marker.current.setLatLng([lat, lng]);
      else {
        marker.current = L.marker([lat, lng], {
          draggable: !readonly,
          icon: L.divIcon({
            className: "",
            html: '<div class="map-pin"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 24],
          }),
        }).addTo(m);
        marker.current.on("dragend", () => {
          const pos = marker.current!.getLatLng();
          handler.current?.(pos.lat, pos.lng);
        });
      }
    };
    if (latitude !== undefined && longitude !== undefined)
      place(latitude, longitude);
    if (!readonly)
      m.on("click", (e) => {
        place(e.latlng.lat, e.latlng.lng);
        handler.current?.(e.latlng.lat, e.latlng.lng);
      });
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // Map is initialized once. Coordinate changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readonly]);
  useEffect(() => {
    if (!map.current || latitude === undefined || longitude === undefined)
      return;
    map.current.setView([latitude, longitude]);
    if (marker.current) marker.current.setLatLng([latitude, longitude]);
    else {
      marker.current = L.marker([latitude, longitude], {
        draggable: !readonly,
        icon: L.divIcon({
          className: "",
          html: '<div class="map-pin"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        handler.current?.(p.lat, p.lng);
      });
    }
  }, [latitude, longitude, readonly]);
  return (
    <div
      ref={el}
      className="map"
      role="region"
      aria-label="Hartford location map"
    />
  );
}
