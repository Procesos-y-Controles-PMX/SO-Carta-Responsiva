"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CartaForm, { type CartaFormInitial } from "@/components/carta/CartaForm";
import { getCartaById } from "@/lib/queries/cartas";

export default function EditarCartaPage() {
  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<CartaFormInitial | null>(null);

  useEffect(() => {
    getCartaById(id).then((carta) => {
      if (!carta) return;
      setInitial({
        id: carta.id,
        id_sucursal: carta.id_sucursal,
        id_responsable: carta.id_responsable ?? "",
        items: carta.cr_carta_items.map((item) => ({
          id_catalogo: item.id_catalogo,
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida,
          precio: item.precio,
        })),
      });
    });
  }, [id]);

  if (!initial) {
    return <p className="text-sm text-slate-500">Cargando carta...</p>;
  }

  return <CartaForm mode="edit" initial={initial} />;
}
