"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import UsuarioFormModal from "@/components/usuarios/UsuarioFormModal";
import PageHeader from "@/components/ui/PageHeader";
import { canManageUsers, ROLE_LABELS } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { deleteUsuario, listUsuarios, updateUsuario, type UsuarioRow } from "@/lib/queries/usuarios";
import { listSucursales } from "@/lib/queries/sucursales";
import type { CrSucursal } from "@/lib/types/db";

function scopeLabel(row: UsuarioRow): string {
  if (row.rol === "administrador_general") return "Todas";
  if (row.rol === "administrador_zona") return row.region || "Sin región";
  return row.cr_sucursales?.nombre || "Sin sucursal";
}

export default function UsuariosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const canEdit = Boolean(user && canManageUsers(user));
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [sucursales, setSucursales] = useState<CrSucursal[]>([]);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<UsuarioRow | null>(null);

  useEffect(() => {
    if (!loading && (!user || !canManageUsers(user))) {
      router.replace("/cartas");
    }
  }, [loading, user, router]);

  async function reload() {
    const [users, stores] = await Promise.all([listUsuarios(), listSucursales()]);
    setRows(users);
    setSucursales(stores);
  }

  useEffect(() => {
    if (canEdit) void reload();
  }, [canEdit]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.email} ${row.nombre_completo ?? ""} ${ROLE_LABELS[row.rol]} ${scopeLabel(row)}`
        .toLowerCase()
        .includes(q),
    );
  }, [query, rows]);

  if (loading || !user || !canEdit) return null;
  const currentUser = user;

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: UsuarioRow) {
    setFormMode("edit");
    setEditing(row);
    setFormOpen(true);
  }

  async function handleDelete(row: UsuarioRow) {
    if (row.id === currentUser.id) {
      toast.error("No puedes borrar tu propia cuenta.");
      return;
    }
    if (!window.confirm(`¿Eliminar a ${row.email}? Esta acción no se puede deshacer.`)) return;
    const result = await deleteUsuario(row.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Usuario eliminado.");
    await reload();
  }

  async function handleActivo(row: UsuarioRow, activo: boolean) {
    if (row.id === currentUser.id) {
      toast.error("No puedes modificar tu propia cuenta desde aquí.");
      return;
    }
    const result = await updateUsuario(row.id, { activo });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setRows((prev) => prev.map((item) => (item.id === row.id ? result.data : item)));
    toast.success(activo ? "Usuario activado." : "Usuario desactivado.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        subtitle="Cuentas de acceso a Cartas Responsivas. Elige sucursal para un usuario de tienda, o región para un administrador de zona."
        actions={
          <button type="button" className="btn-primary gap-2" onClick={openCreate}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Nuevo usuario
          </button>
        }
      />

      <label className="block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        Buscar (correo o nombre)
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej. garcia@cemex.com"
          className="input-field mt-1.5"
        />
      </label>

      <div className="card-panel overflow-hidden">
        <div className="divide-y divide-line-subtle md:hidden">
          {visible.map((row) => {
            const isSelf = row.id === currentUser.id;
            return (
              <article key={row.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{row.email}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">{row.nombre_completo?.trim() || "—"}</p>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {ROLE_LABELS[row.rol]} · {scopeLabel(row)}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={row.activo}
                      disabled={isSelf}
                      onChange={(event) => void handleActivo(row, event.target.checked)}
                    />
                    Activo
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={isSelf} className="btn-secondary flex-1" onClick={() => openEdit(row)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={isSelf}
                    className="btn-danger flex-1 disabled:opacity-50"
                    onClick={() => void handleDelete(row)}
                  >
                    Borrar
                  </button>
                </div>
              </article>
            );
          })}
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-subtle">{query ? "Sin resultados." : "Sin usuarios."}</p>
          ) : null}
        </div>

        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-muted text-xs uppercase text-fg-subtle">
            <tr>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Alcance</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isSelf = row.id === currentUser.id;
              return (
                <tr key={row.id} className={`border-t border-line-subtle ${row.activo ? "" : "text-fg-muted"}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">{row.email}</div>
                    {isSelf ? <span className="text-xs text-amber-700">Tu cuenta (no editable)</span> : null}
                  </td>
                  <td className="px-4 py-3">{row.nombre_completo?.trim() || "—"}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[row.rol]}</td>
                  <td className="px-4 py-3">{scopeLabel(row)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={row.activo}
                      disabled={isSelf}
                      onChange={(event) => void handleActivo(row, event.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSelf}
                        className="text-xs font-semibold text-fg-muted hover:underline disabled:opacity-50"
                        onClick={() => openEdit(row)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        className="btn-danger min-h-8 px-2 py-1 text-xs disabled:opacity-50"
                        onClick={() => void handleDelete(row)}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-fg-subtle">
                  {query ? "Sin resultados." : "Sin usuarios."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <UsuarioFormModal
        open={formOpen}
        mode={formMode}
        initial={editing}
        sucursales={sucursales}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          toast.success(formMode === "create" ? "Usuario creado." : "Usuario actualizado.");
          setFormOpen(false);
          void reload();
        }}
      />
    </div>
  );
}
