"use client";

import { useTheme } from "next-themes";


import {
  GridLoadingScreen,
  GridThemeToggle,
  NoiseField,
  SIDEBAR_NAV_ACTIVE,
  SIDEBAR_NAV_IDLE,
  SIDEBAR_NAV_LIST,
  SIDEBAR_NAV_LIST_COLLAPSED,
  SIDEBAR_SHELL,
  SIDEBAR_USER_CARD,
  ThemeToggle,
} from "@promexma/ui";
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
  Shield,
  Users,
} from "lucide-react";

import ModuleTransition from "@/components/common/ModuleTransition";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { canGenerateCartas, canManageUsers, canViewAccesos, ROLE_LABELS } from "@/lib/access";
import { logout, useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types/db";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles?: UserRole[];
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Historial", href: "/cartas", icon: <FileClock className="h-[18px] w-[18px]" /> },
      { label: "Nueva carta", href: "/cartas/nueva", icon: <FilePlus2 className="h-[18px] w-[18px]" />, roles: ["usuario", "administrador_general"] },
      { label: "Catálogo", href: "/catalogo", icon: <Boxes className="h-[18px] w-[18px]" /> },
      { label: "Responsables", href: "/responsables", icon: <BookUser className="h-[18px] w-[18px]" /> },
      { label: "Usuarios", href: "/usuarios", icon: <Users className="h-[18px] w-[18px]" />, roles: ["administrador_general"] },
      { label: "Cumplimiento", href: "/cumplimiento", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
      { label: "Accesos", href: "/accesos", icon: <Shield className="h-[18px] w-[18px]" />, roles: ["administrador_general"] },
    ],
    []
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <GridLoadingScreen message="Verificando sesión..." variant="dark" />;
  }

  const filteredNav = navItems.filter((item) => {
    if (item.href === "/usuarios") return canManageUsers(user);
    if (item.href === "/accesos") return canViewAccesos(user);
    if (item.href === "/cartas/nueva") return canGenerateCartas(user);
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

  const displayName = user.nombre_completo?.trim() || user.email;
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es-MX"))
    .join("");
  const roleLabel = ROLE_LABELS[user.rol];

  return (
    <div className="min-h-screen app-canvas">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col transition-all duration-300 lg:flex",
          SIDEBAR_SHELL,
          sidebarCollapsed ? "w-[72px]" : "w-[250px]"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href="/cartas" className="flex min-w-0 items-center gap-2.5">
            <Image src="/circulo-promexma.png" alt="Promexma" width={30} height={30} className="shrink-0 rounded-full" />
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none text-white">Promexma</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-fg-subtle">SO Cartas Responsivas</p>
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className={cn(
              "neu-button flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:text-fg",
              sidebarCollapsed && "absolute left-[58px]"
            )}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <PanelLeftClose className={cn("h-3.5 w-3.5 transition-transform", sidebarCollapsed && "rotate-180")} />
          </button>
        </div>
        <nav className={cn("sidebar-scroll flex-1 py-4", sidebarCollapsed ? SIDEBAR_NAV_LIST_COLLAPSED : SIDEBAR_NAV_LIST)}>
          {filteredNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-medium",
                sidebarCollapsed && "justify-center",
                isActive(item.href) ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_IDLE,
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="p-3 space-y-2">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <GridThemeToggle compact />
            </div>
          ) : (
            <GridThemeToggle />
          )}
          <div className={cn(SIDEBAR_USER_CARD, "flex items-center gap-3", sidebarCollapsed && "justify-center p-2")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{initials}</div>
            {!sidebarCollapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-fg-faint">{displayName}</p>
                  <p className="text-[10px] text-fg-subtle">{roleLabel}</p>
                </div>
                <button type="button" onClick={handleLogout} className="neu-button rounded-full p-1.5 text-fg-subtle hover:text-fg" aria-label="Cerrar sesión">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </aside>

      <div className={cn("relative min-h-screen transition-all duration-300 lg:ml-[250px]", sidebarCollapsed && "lg:ml-[72px]")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen overflow-hidden" aria-hidden>
          <NoiseField
            key={resolvedTheme ?? "dark"}
            className="absolute inset-0 [mask-image:radial-gradient(ellipse_90%_80%_at_50%_40%,white,transparent)]"
            color={isDark ? [255, 255, 255] : [52, 80, 122]}
            maxOpacity={isDark ? 0.5 : 0.7}
          />
        </div>
        <header className="app-safe-x sticky top-0 z-30 flex items-center gap-3 bg-transparent py-3 lg:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight text-fg lg:text-xl">
              SO Cartas Responsivas
            </h1>
            <p className="truncate text-xs text-fg-subtle lg:text-sm">
              {roleLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Classic toggle stays on mobile — sidebar is desktop-only. */}
            <ThemeToggle className="lg:hidden" />
            <button
              type="button"
              onClick={handleLogout}
              className="neu-button flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-fg-subtle hover:text-fg lg:hidden"
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
