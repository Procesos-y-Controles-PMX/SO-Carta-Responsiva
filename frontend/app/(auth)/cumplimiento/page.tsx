"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import {
  getComplianceReport,
  responsablesSinCarta,
  sucursalesSinCarta,
  type ComplianceRow,
} from "@/lib/queries/cumplimiento";
import { endOfMonth, formatDate, startOfMonth } from "@/lib/utils";

function toIsoStart(date: Date): string {
  return date.toISOString();
}

function monthInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function CumplimientoPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(monthInputValue(new Date()));
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const from = startOfMonth(new Date(y, m - 1, 1));
    const to = endOfMonth(new Date(y, m - 1, 1));
    return { from: toIsoStart(from), to: toIsoStart(to) };
  }, [month]);

  useEffect(() => {
    if (user?.rol !== "admin") return;
    setLoading(true);
    getComplianceReport(range.from, range.to).then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [user, range.from, range.to]);

  const sinSucursal = sucursalesSinCarta(rows);
  const sinResponsable = responsablesSinCarta(rows);
  const totalCartas = rows.reduce((sum, r) => sum + r.cartasSucursalEnPeriodo, 0);

  if (user?.rol !== "admin") {
    return <p className="text-sm text-slate-500">Acceso restringido a administradores.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supervisión"
        title="Cumplimiento"
        subtitle="Consulta quién generó cartas en el periodo y detecta sucursales pendientes."
        actions={
          <label className="block w-full sm:w-52">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Periodo</span>
            <span className="relative block">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="month" className="input-field pl-9" value={month} onChange={(event) => setMonth(event.target.value)} />
            </span>
          </label>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-panel border-l-2 border-l-steel p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Cartas generadas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalCartas}</p>
        </div>
        <div className="card-panel border-l-2 border-l-brand p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Sucursales sin carta</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{sinSucursal.length}</p>
        </div>
        <div className="card-panel border-l-2 border-l-amber-500 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Responsables sin carta</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{sinResponsable.length}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando reporte...</p>
      ) : (
        <>
          <div className="card-panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Por sucursal</h3>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => (
                <article key={row.sucursal.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.sucursal.nombre}</p>
                    <p className="text-xs text-slate-500">{row.cartasSucursalEnPeriodo} cartas en el periodo</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${row.cartasSucursalEnPeriodo === 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {row.cartasSucursalEnPeriodo === 0 ? "Pendiente" : "Cumple"}
                  </span>
                </article>
              ))}
            </div>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Cartas en periodo</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sucursal.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.sucursal.nombre}</td>
                    <td className="px-4 py-3">{row.cartasSucursalEnPeriodo}</td>
                    <td className="px-4 py-3">
                      {row.cartasSucursalEnPeriodo === 0 ? (
                        <span className="font-medium text-red-600">Sin carta</span>
                      ) : (
                        <span className="text-emerald-700">Con carta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Por responsable</h3>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.flatMap((row) =>
                row.responsables.map((resp) => (
                  <article key={resp.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{resp.nombre}</p>
                        <p className="text-xs text-slate-500">{row.sucursal.nombre}</p>
                      </div>
                      <span className={`text-sm font-bold ${resp.cartasEnPeriodo === 0 ? "text-red-600" : "text-slate-900"}`}>{resp.cartasEnPeriodo}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Última carta: {resp.ultimaCarta ? formatDate(resp.ultimaCarta) : "Sin registro"}</p>
                  </article>
                ))
              )}
            </div>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Cartas</th>
                  <th className="px-4 py-3">Última carta</th>
                </tr>
              </thead>
              <tbody>
                {rows.flatMap((row) =>
                  row.responsables.map((resp) => (
                    <tr key={resp.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{row.sucursal.nombre}</td>
                      <td className="px-4 py-3">{resp.nombre}</td>
                      <td className="px-4 py-3">
                        {resp.cartasEnPeriodo === 0 ? (
                          <span className="font-medium text-red-600">0</span>
                        ) : (
                          resp.cartasEnPeriodo
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {resp.ultimaCarta ? formatDate(resp.ultimaCarta) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
