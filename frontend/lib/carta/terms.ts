export const MERCANCIA_ABORDO_POINTS = [
  'Estos productos me han sido entregados con el fin de venderlos entre mis clientes como parte del esquema de "Venta de Material a Bordo".',
  "Al cerrar una venta tengo el compromiso de confirmarlo a mi respectiva sucursal, así como entregar los documentos comprobantes (remisión manual, recibo de caja) y efectivo recibido en el mismo día que se realice.",
  "Los productos no vendidos serán regresados a la sucursal a más tardar el viernes de esta semana.",
];

export const MERCANCIA_ABORDO_TERMS = MERCANCIA_ABORDO_POINTS.join("\n");

export const CARTA_INTRO_TEMPLATE = (
  nombreResponsable: string,
  codigoSucursal: string
) =>
  `Yo, ${nombreResponsable.toUpperCase()}, como parte del equipo de la sucursal ${codigoSucursal}, hago constar que he recibido material de la empresa Proveedora Mexicana de Materiales. Los productos específicos se detallan en la presente carta.`;
