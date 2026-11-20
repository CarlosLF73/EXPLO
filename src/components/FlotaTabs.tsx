"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, FileWarning, Wrench } from "lucide-react";

const TABS = [
  { href: "/flota", label: "Vehículos", icon: Car },
  { href: "/flota/multas", label: "Multas", icon: FileWarning },
  { href: "/flota/mantenimiento", label: "Mantenimiento", icon: Wrench },
];

/** Pestañas de la sección Flota. */
export function FlotaTabs({ avisos }: { avisos?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Flota" className="flex gap-1 border-b border-border -mt-1 overflow-x-auto">
      {TABS.map(({ href, label, icon: Icon }) => {
        const activa = href === "/flota" ? path === "/flota" : path.startsWith(href);
        const n = avisos?.[href];
        return (
          <Link key={href} href={href} aria-current={activa ? "page" : undefined}
            className={`flex items-center gap-2 px-4 h-11 text-[15px] font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activa ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}>
            <Icon size={17} /> {label}
            {!!n && <span className="min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[11px] grid place-items-center">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
