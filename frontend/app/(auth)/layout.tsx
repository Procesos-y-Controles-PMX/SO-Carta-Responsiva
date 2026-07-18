"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookUser,
  Boxes,
  FileClock,
  FilePlus2,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import AppCanvasMouseBackdrop from "@/components/common/AppCanvasMouseBackdrop";
import ModuleTransition from "@/components/common/ModuleTransition";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { getCurrentUser, logout, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles?: Array<"admin" | "operador">;
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Historial", href: "/cartas", icon: <FileClock className="h-[18px] w-[18px]" /> },
      { label: "Nueva carta", href: "/cartas/nueva", icon: <FilePlus2 className="h-[18px] w-[18px]" /> },
      { label: "Catálogo", href: "/catalogo", icon: <Boxes className="h-[18px] w-[18px]" />, roles: ["admin"] },
      { label: "Responsables", href: "/responsables", icon: <BookUser className="h-[18px] w-[18px]" />, roles: ["admin"] },
      { label: "Cumplimiento", href: "/cumplimiento", icon: <BarChart3 className="h-[18px] w-[18px]" />, roles: ["admin"] },
    ],
    []
  );

  useEffect(() => {
    if (!loading && !getCurrentUser()) router.replace("/login");
  }, [loading, router]);

  if (loading || !user) return <main className="min-h-screen" />;

  const filteredNav = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user.rol);
  });

  const isActive = (href: string) => {
    if (href === "/cartas") {
      if (pathname === "/cartas/nueva") return false;
      return pathname === "/cartas" || pathname.startsWith("/cartas/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const initials = "AD";

  return (
    <div className="min-h-screen app-canvas">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/10 bg-gradient-to-b from-[#0e1626] to-[#070b14] shadow-lg transition-all duration-300 lg:flex",
          sidebarCollapsed ? "w-[72px]" : "w-[250px]"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link href="/cartas" className="flex min-w-0 items-center gap-2.5">
            <Image src="/circulo-promexma.png" alt="Promexma" width={30} height={30} className="shrink-0 rounded-full" />
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none text-white">Promexma</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">Carta Responsiva</p>
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-400 transition hover:border-slate-500 hover:text-white",
              sidebarCollapsed && "absolute left-[58px]"
            )}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <PanelLeftClose className={cn("h-3.5 w-3.5 transition-transform", sidebarCollapsed && "rotate-180")} />
          </button>
        </div>
        <nav className="sidebar-scroll flex-1 space-y-0.5 px-3 py-4">
          {filteredNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                sidebarCollapsed && "justify-center",
                isActive(item.href)
                  ? "bg-gradient-to-br from-brand to-brand-active text-white shadow-[0_2px_8px_-3px_rgba(237,28,36,.7)]"
                  : "text-slate-400 hover:translate-x-0.5 hover:bg-white/10 hover:text-slate-100"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className={cn("flex items-center gap-3 rounded-sm border border-white/10 bg-gradient-to-br from-[#131c2e] to-[#0c1322] p-3", sidebarCollapsed && "justify-center p-2")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{initials}</div>
            {!sidebarCollapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">Administrador</p>
                  <p className="text-[10px] text-slate-500">Acceso completo</p>
                </div>
                <button type="button" onClick={handleLogout} className="rounded-sm p-1.5 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </aside>

      <div className={cn("relative min-h-screen transition-all duration-300 lg:ml-[250px]", sidebarCollapsed && "lg:ml-[72px]")}>
        <AppCanvasMouseBackdrop />
        <header className="app-safe-x sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 py-3 backdrop-blur-sm lg:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-semibold tracking-tight text-slate-900 lg:text-xl">
                Carta Responsiva
              </h1>
              <p className="truncate text-xs text-slate-500 lg:text-sm">
                Administrador
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 lg:hidden"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="relative z-10 app-main-pad app-safe-x overflow-x-hidden py-4 lg:py-6">
          <ModuleTransition>{children}</ModuleTransition>
        </main>
      </div>
      <MobileBottomNav
        items={filteredNav.map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          active: isActive(item.href),
        }))}
      />
    </div>
  );
}
