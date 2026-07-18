export type UserRole = "admin" | "operador";

export type CrUsuario = {
  id: string;
  email: string;
  nombre_completo: string | null;
  rol: UserRole;
  id_sucursal: string | null;
  activo: boolean;
  created_at: string;
};

export type CrSucursal = {
  id: string;
  nombre: string;
  codigo_sap: string | null;
  prefijo_folio: string;
  region: string | null;
  activo: boolean;
  created_at: string;
};

export type CrResponsable = {
  id: string;
  id_sucursal: string;
  nombre: string;
  activo: boolean;
  created_at: string;
};

export type CrCatalogoItem = {
  id: string;
  id_sucursal: string;
  codigo: string;
  descripcion: string;
  unidad_medida: string | null;
  precio: number;
  activo: boolean;
  created_at: string;
};

export type CrCarta = {
  id: string;
  folio: string;
  id_sucursal: string;
  id_responsable: string | null;
  nombre_responsable: string;
  id_usuario: string;
  terminos_snapshot: string;
  subtotal: number;
  iva: number;
  total: number;
  email_enviado: boolean;
  email_enviado_at: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CrCartaItem = {
  id: string;
  id_carta: string;
  id_catalogo: string | null;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad_medida: string | null;
  precio: number;
  created_at: string;
};

export type CartaLineInput = {
  id_catalogo: string | null;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad_medida: string | null;
  precio: number;
};
