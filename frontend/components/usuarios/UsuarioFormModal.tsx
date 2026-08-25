"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import FilterSelect from "@/components/common/FilterSelect";
import Modal from "@/components/ui/Modal";
import { ROLE_LABELS } from "@/lib/access";
import { createUsuario, updateUsuario, type UsuarioRow } from "@/lib/queries/usuarios";
import type { CrSucursal, UserRole } from "@/lib/types/db";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial: UsuarioRow | null;
  sucursales: CrSucursal[];
  onClose: () => void;
  onSaved: (usuario: UsuarioRow) => void;
};

const ROLES: UserRole[] = ["usuario", "administrador_zona", "administrador_general"];

export default function UsuarioFormModal({ open, mode, initial, sucursales, onClose, onSaved }: Props) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [rol, setRol] = useState<UserRole>("usuario");
  const [idSucursal, setIdSucursal] = useState("");
  const [region, setRegion] = useState("");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const regionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const sucursal of sucursales) {
      const value = sucursal.region?.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      options.push({ value, label: value });
    }
    const current = region.trim();
    if (current && !seen.has(current)) options.unshift({ value: current, label: current });
    return options.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [sucursales, region]);

  useEffect(() => {
    if (!open) return;
    setEmail(initial?.email ?? "");
    setNombre(initial?.nombre_completo ?? "");
    setPassword("");
    setPasswordConfirm("");
    setRol(initial?.rol ?? "usuario");
    setIdSucursal(initial?.id_sucursal ?? "");
    setRegion(initial?.region ?? "");
    setActivo(initial?.activo ?? true);
    setSaving(false);
  }, [open, initial]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      toast.error("El correo es obligatorio.");
      return;
    }
    if (mode === "create" || password.trim()) {
      if (password.trim().length < 4) {
        toast.error("La contraseña debe tener al menos 4 caracteres.");
        return;
      }
      if (password !== passwordConfirm) {
        toast.error("Las contraseñas no coinciden.");
        return;
      }
    }
    if (rol === "usuario" && !idSucursal) {
      toast.error("Elige una sucursal.");
      return;
    }
    if (rol === "administrador_zona" && !region.trim()) {
      toast.error("Elige una región.");
      return;
    }

    setSaving(true);
    const payload = {
      email: nextEmail,
      nombre_completo: nombre.trim(),
      rol,
      password: password.trim() || undefined,
      id_sucursal: rol === "usuario" ? idSucursal : null,
      region: rol === "administrador_zona" ? region.trim() : null,
      activo,
    };
    const result =
      mode === "create"
        ? await createUsuario({ ...payload, password: password.trim() })
        : initial
          ? await updateUsuario(initial.id, payload)
          : { ok: false as const, message: "Usuario no encontrado." };
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    onSaved(result.data);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nuevo usuario" : "Editar usuario"}
      actions={
        <>
          <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="usuario-form" className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      <form id="usuario-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            Correo electrónico *
          </span>
          <input
            type="email"
            required
            className="input-field"
            placeholder="ejemplo.usuario@cemex.com"
            value={email}
            onChange={(event) => setEmail(event.target.value.toLowerCase())}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            Nombre completo *
          </span>
          <input
            required
            className="input-field"
            placeholder="Nombre Apellido"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            {mode === "create" ? "Contraseña *" : "Nueva contraseña"}
          </span>
          <input
            type="password"
            required={mode === "create"}
            autoComplete="new-password"
            className="input-field"
            placeholder={mode === "create" ? "Mínimo 4 caracteres" : "Vacío = sin cambio"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            {mode === "create" ? "Confirmar contraseña *" : "Confirmar nueva"}
          </span>
          <input
            type="password"
            required={mode === "create"}
            autoComplete="new-password"
            className="input-field"
            placeholder="Repite la contraseña"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">Rol *</span>
          <select
            className="input-field"
            value={rol}
            onChange={(event) => {
              const next = event.target.value as UserRole;
              setRol(next);
              if (next === "administrador_general") {
                setIdSucursal("");
                setRegion("");
              }
              if (next === "administrador_zona") setIdSucursal("");
              if (next === "usuario") setRegion("");
            }}
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            checked={activo}
            onChange={(event) => setActivo(event.target.checked)}
            className="h-4 w-4 rounded border-line-strong text-brand"
          />
          <span className="text-sm font-semibold text-fg">Usuario activo</span>
        </label>
        {rol === "usuario" ? (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Sucursal *
            </span>
            <FilterSelect
              value={idSucursal}
              onChange={setIdSucursal}
              searchable="auto"
              placeholder="-- Sucursal --"
              options={sucursales.map((sucursal) => ({
                value: sucursal.id,
                label: `${sucursal.nombre}${sucursal.codigo_sap ? ` / ${sucursal.codigo_sap}` : ""}`,
              }))}
            />
          </div>
        ) : null}
        {rol === "administrador_zona" ? (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Región *
            </span>
            <FilterSelect
              value={region}
              onChange={setRegion}
              searchable="auto"
              placeholder="-- Región --"
              options={regionOptions}
            />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
