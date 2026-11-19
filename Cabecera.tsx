"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Camera, Boxes, Car, Users, LayoutGrid, Shield, Moon, Sun, LogOut, KeyRound, Menu, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Marca } from "./Marca";

type Props = { nombre: string; email: string; esAdmin: boolean };

const SECCIONES = [
  { href: "/", label: "Panel", icon: LayoutGrid },
  { href: "/camaras", label: "Cámaras", icon: Camera },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/flota", label: "Flota", icon: Car },
  { href: "/operadores", label: "Operadores", icon: Users },
];

export function Cabecera({ nombre, email, esAdmin }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [oscuro, setOscuro] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOscuro(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) setMenuUsuario(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  useEffect(() => setMenuMovil(false), [path]);

  function cambiarTema() {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    if (nuevo) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("explo_tema", nuevo ? "dark" : "light"); } catch {}
  }

  async function salir() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const secciones = esAdmin
    ? [...SECCIONES, { href: "/admin/usuarios", label: "Usuarios", icon: Shield }]
    : SECCIONES;

  const activa = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const iniciales = (nombre || email).split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  return (
    <header className="sticky top-0 z-30 bg-ink text-ink-text shadow-md">
      <div aria-hidden className="h-1 flex"><div className="flex-1 bg-a3" /><div className="flex-1 bg-l6" /></div>
      <div className="mx-auto max-w-7xl px-3 sm:px-5 h-14 flex items-center gap-3">
        <button
          className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/10"
          aria-label="Abrir menú"
          onClick={() => setMenuMovil((v) => !v)}
        >
          {menuMovil ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href="/" aria-label="Inicio"><Marca claro /></Link>

        <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Secciones">
          {secciones.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={activa(href) ? "page" : undefined}
              className={`flex items-center gap-2 px-3 h-10 rounded-lg text-[15px] font-medium transition-colors ${
                activa(href) ? "bg-white/15 text-white" : "text-[#b9c5d4] hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={cambiarTema}
            className="p-2.5 rounded-lg hover:bg-white/10"
            aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={oscuro ? "Modo claro" : "Modo oscuro"}
          >
            {oscuro ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <div className="relative" ref={refMenu}>
            <button
              onClick={() => setMenuUsuario((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2 h-10 rounded-lg hover:bg-white/10"
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
            >
              <span className="grid place-items-center size-8 rounded-full bg-accent text-white text-sm font-bold">
                {iniciales || "?"}
              </span>
              <span className="hidden sm:block text-sm font-medium max-w-40 truncate">{nombre || email}</span>
            </button>
            {menuUsuario && (
              <div role="menu" className="absolute right-0 mt-2 w-60 card shadow-xl text-text overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-semibold truncate">{nombre}</p>
                  <p className="text-xs text-muted truncate">{email}</p>
                  {esAdmin && <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-accent">Administrador</p>}
                </div>
                <Link role="menuitem" href="/cuenta/password" onClick={() => setMenuUsuario(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-surface-2">
                  <KeyRound size={16} /> Cambiar contraseña
                </Link>
                <button role="menuitem" onClick={salir}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-surface-2 text-danger">
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {menuMovil && (
        <nav className="md:hidden border-t border-white/10 px-3 py-2 grid grid-cols-2 gap-1" aria-label="Secciones">
          {secciones.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 h-12 rounded-lg text-[15px] font-medium ${
                activa(href) ? "bg-white/15 text-white" : "text-[#b9c5d4]"
              }`}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
