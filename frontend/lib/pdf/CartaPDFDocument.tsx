import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { CARTA_INTRO_TEMPLATE, MERCANCIA_ABORDO_POINTS } from "@/lib/carta/terms";
import type { CartaWithRelations } from "@/lib/queries/cartas";
import { formatQuantity, money } from "@/lib/utils";

const BRAND_RED = "#DB2C27";
const BRAND_GRAY = "#54545B";
const TEXT_BLACK = "#000000";
const TEXT_ON_GRAY = "#FFFFFF";
const BORDER_LIGHT = "#D1D3D4";

function pdfDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: {
    fontSize: 11,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    color: TEXT_BLACK,
    padding: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    backgroundColor: BRAND_GRAY,
    color: TEXT_ON_GRAY,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
    textAlign: "center",
    textTransform: "uppercase",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 9,
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.35,
    marginBottom: 12,
    textAlign: "justify",
  },
  tableBox: {
    border: `1 solid ${BRAND_GRAY}`,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_GRAY,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableTitle: {
    backgroundColor: BRAND_RED,
    color: TEXT_ON_GRAY,
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  tableHeaderText: {
    fontSize: 9,
    color: TEXT_ON_GRAY,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1 solid ${BORDER_LIGHT}`,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableCell: {
    fontSize: 9,
    textAlign: "center",
  },
  termsIntro: {
    fontSize: 11,
    marginBottom: 6,
  },
  termRow: {
    flexDirection: "row",
    paddingLeft: 9,
    marginBottom: 4,
  },
  termBullet: {
    width: 10,
    fontSize: 11,
  },
  termText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: "justify",
  },
  signatureBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 38,
  },
  signatureColumn: {
    width: "44%",
    alignItems: "center",
  },
  signatureLine: {
    borderBottom: `1 solid ${TEXT_BLACK}`,
    width: "100%",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 10,
    lineHeight: 1.25,
    color: BRAND_GRAY,
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    borderTop: `1 solid ${BORDER_LIGHT}`,
    minHeight: 19,
    alignItems: "center",
  },
  totalSpacer: { width: "74%" },
  totalLabel: { width: "14%", paddingRight: 5, fontSize: 9, fontWeight: 700, textAlign: "right" },
  totalValue: { width: "12%", paddingRight: 5, fontSize: 9, fontWeight: 700, textAlign: "right" },
  commitment: { fontSize: 11, lineHeight: 1.35, marginTop: 7, textAlign: "justify" },
  cityLine: { fontSize: 11, textAlign: "center", marginTop: 10 },
  colCodigo: { width: "14%" },
  colDesc: { width: "36%" },
  colCant: { width: "12%" },
  colUm: { width: "12%" },
  colPrecio: { width: "14%" },
  colTotal: { width: "12%" },
});

type Props = {
  carta: CartaWithRelations;
};

export default function CartaPDFDocument({ carta }: Props) {
  const sucursalNombre = carta.cr_sucursales?.nombre ?? "—";
  const codigoSucursal = carta.cr_sucursales?.codigo_sap ?? sucursalNombre;
  const ciudadFirma = carta.cr_sucursales?.ciudad ?? sucursalNombre;
  const calculatedSubtotal = carta.cr_carta_items.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0
  );
  const subtotal = Number(carta.subtotal) || calculatedSubtotal;
  const branchIvaPercentage = Number(carta.cr_sucursales?.iva_porcentaje) || 16;
  const iva = Number(carta.iva) || subtotal * (branchIvaPercentage / 100);
  const ivaPercentage =
    subtotal > 0 ? Math.round((iva / subtotal) * 10_000) / 100 : branchIvaPercentage;
  const totalConIva = Number(carta.total) || subtotal + iva;
  const terms = carta.terminos_snapshot?.trim()
    ? carta.terminos_snapshot.split("\n").filter(Boolean)
    : MERCANCIA_ABORDO_POINTS;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.metaRow}>
          <Text>Folio: {carta.folio}</Text>
        </View>
        <Text style={styles.title}>Carta responsiva material a bordo</Text>

        <Text style={styles.paragraph}>
          {CARTA_INTRO_TEMPLATE(carta.nombre_responsable, codigoSucursal)}
        </Text>

        <View style={styles.tableBox}>
          <Text style={styles.tableTitle}>Salida de material</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colCodigo]}>Código</Text>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.tableHeaderText, styles.colCant]}>Cant.</Text>
            <Text style={[styles.tableHeaderText, styles.colUm]}>UM</Text>
            <Text style={[styles.tableHeaderText, styles.colPrecio]}>P.U.</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Precio</Text>
          </View>
          {carta.cr_carta_items.map((item, index) => (
            <View key={item.id ?? index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colCodigo]}>{item.codigo}</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>{item.descripcion}</Text>
              <Text style={[styles.tableCell, styles.colCant]}>
                {formatQuantity(item.cantidad)}
              </Text>
              <Text style={[styles.tableCell, styles.colUm]}>
                {item.unidad_medida ?? "—"}
              </Text>
              <Text style={[styles.tableCell, styles.colPrecio]}>{money(item.precio)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>
                {money(item.cantidad * item.precio)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <View style={styles.totalSpacer} />
            <Text style={styles.totalLabel}>SUBTOTAL</Text>
            <Text style={styles.totalValue}>{money(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <View style={styles.totalSpacer} />
            <Text style={styles.totalLabel}>IVA {ivaPercentage}%</Text>
            <Text style={styles.totalValue}>{money(iva)}</Text>
          </View>
          <View style={styles.totalRow}>
            <View style={styles.totalSpacer} />
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{money(totalConIva)}</Text>
          </View>
        </View>

        <Text style={styles.termsIntro}>Estoy, así mismo enterado de que:</Text>
        {terms.map((point) => (
          <View key={point} style={styles.termRow}>
            <Text style={styles.termBullet}>•</Text>
            <Text style={styles.termText}>{point}</Text>
          </View>
        ))}
        <Text style={styles.commitment}>
          Me comprometo a realizar la reposición monetaria de los productos en caso de extravío u
          omisión del retorno el viernes.
        </Text>
        <Text style={styles.commitment}>
          Confirmo de leído el presente anexo y estando conforme de su contenido.
        </Text>
        <Text style={styles.cityLine}>
          Lo firmo en la ciudad de {ciudadFirma} con fecha al {pdfDate(carta.created_at)}
        </Text>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Nombre, puesto y firma de la persona que retira el material</Text>
          </View>
          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Nombre, puesto y firma de la persona que entrega el material</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
