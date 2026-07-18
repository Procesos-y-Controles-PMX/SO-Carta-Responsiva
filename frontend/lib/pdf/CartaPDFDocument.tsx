import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { CARTA_INTRO_TEMPLATE, MERCANCIA_ABORDO_POINTS } from "@/lib/carta/terms";
import type { CartaWithRelations } from "@/lib/queries/cartas";
import { formatQuantity, money } from "@/lib/utils";

const BRAND_RED = "#DA291C";
const BRAND_GRAY = "#54565A";
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
    fontSize: 8,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    color: TEXT_BLACK,
    paddingHorizontal: 34,
    paddingTop: 24,
    paddingBottom: 30,
  },
  headerLogoWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLogo: {
    width: 180,
    height: 34,
    objectFit: "contain",
  },
  headerDivider: {
    borderBottom: `3 solid ${BRAND_RED}`,
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: BRAND_GRAY,
    color: TEXT_ON_GRAY,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 9,
    textAlign: "center",
    color: BRAND_GRAY,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    fontSize: 7.5,
  },
  paragraph: {
    fontSize: 9,
    lineHeight: 1.45,
    marginBottom: 10,
    textAlign: "justify",
  },
  tableBox: {
    border: `1 solid ${BRAND_GRAY}`,
    overflow: "hidden",
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_GRAY,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableTitle: {
    backgroundColor: BRAND_RED,
    color: TEXT_ON_GRAY,
    fontSize: 7.5,
    fontWeight: 700,
    textAlign: "center",
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  tableHeaderText: {
    fontSize: 7.5,
    color: TEXT_ON_GRAY,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1 solid ${BORDER_LIGHT}`,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableCell: {
    fontSize: 7.5,
    textAlign: "center",
  },
  termsIntro: {
    fontSize: 8,
    marginTop: 11,
    marginBottom: 4,
  },
  termRow: {
    flexDirection: "row",
    paddingLeft: 9,
    marginBottom: 3,
  },
  termBullet: {
    width: 10,
    fontSize: 8,
  },
  termText: {
    flex: 1,
    fontSize: 7.5,
    lineHeight: 1.35,
    textAlign: "justify",
  },
  signatureBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
  },
  signatureColumn: {
    width: "42%",
    alignItems: "center",
  },
  signatureLine: {
    borderBottom: `1 solid ${TEXT_BLACK}`,
    width: "100%",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 6.8,
    color: BRAND_GRAY,
    textAlign: "center",
  },
  totals: { width: "38%", alignSelf: "flex-end", marginBottom: 5 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  totalLabel: { fontSize: 7, fontWeight: 700 },
  totalValue: { fontSize: 7, fontWeight: 700 },
  commitment: { fontSize: 7.5, lineHeight: 1.35, marginTop: 7 },
  cityLine: { fontSize: 7.5, textAlign: "center", marginTop: 8 },
  footerLogo: { position: "absolute", bottom: 20, left: 0, right: 0, alignItems: "center" },
  colCodigo: { width: "14%" },
  colDesc: { width: "36%" },
  colCant: { width: "12%" },
  colUm: { width: "12%" },
  colPrecio: { width: "14%" },
  colTotal: { width: "12%" },
});

type Props = {
  carta: CartaWithRelations;
  logoSrc?: string;
};

export default function CartaPDFDocument({ carta, logoSrc }: Props) {
  const sucursalNombre = carta.cr_sucursales?.nombre ?? "—";
  const codigoSucursal = carta.cr_sucursales?.codigo_sap ?? sucursalNombre;
  const calculatedSubtotal = carta.cr_carta_items.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0
  );
  const subtotal = Number(carta.subtotal) || calculatedSubtotal;
  const iva = Number(carta.iva) || subtotal * 0.16;
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
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SUBTOTAL</Text>
            <Text style={styles.totalValue}>{money(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA 16%</Text>
            <Text style={styles.totalValue}>{money(iva)}</Text>
          </View>
          <View style={styles.totalRow}>
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
          Lo firmo en la ciudad de {sucursalNombre} con fecha al {pdfDate(carta.created_at)}.
        </Text>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Nombre, puesto y firma de la persona que retira el material.</Text>
          </View>
          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Nombre, puesto y firma de la persona que entrega el material.</Text>
          </View>
        </View>

        {logoSrc ? (
          <View style={styles.footerLogo} fixed>
            <Image src={logoSrc} style={styles.headerLogo} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
