import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";

const styles = StyleSheet.create({
    page: {
        padding: 14,
        fontSize: 9,
        color: "#111827",
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },

    headerLogo: {
        width: 95,
        height: 45,
        objectFit: "contain",
    },

    headerWrap: {
        flexDirection: "row",
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 8,
    },

    headerLeft: {
        width: 120,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingVertical: 10,
        paddingLeft: 14,
        paddingRight: 8,
    },

    headerMid: {
        flex: 1,
        paddingVertical: 6,
        paddingHorizontal: 10,
        justifyContent: "center",
    },

    headerTitle: {
        fontSize: 11,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        marginBottom: 2,
    },

    headerSub: {
        fontSize: 8,
        color: GRAY_TEXT,
    },

    fieldsWrap: {
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 8,
    },

    fieldsRow: {
        flexDirection: "row",
    },

    fieldCell: {
        borderRightWidth: 1,
        borderColor: BORDER,
        paddingVertical: 4,
        paddingHorizontal: 6,
    },

    fieldCellLast: {
        borderRightWidth: 0,
    },

    label: {
        fontSize: 8,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        color: "#111",
        marginBottom: 1,
    },

    value: {
        fontSize: 9.5,
        fontWeight: 800 as any,
        textTransform: "uppercase",
    },

    box: {
        borderWidth: 2,
        borderColor: BORDER,
        padding: 6,
        marginBottom: 8,
    },

    boxTitle: {
        fontSize: 9,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        color: GREEN,
        marginBottom: 6,
    },

    row: {
        flexDirection: "row",
    },

    col: {
        flex: 1,
        paddingRight: 8,
    },

    tableWrap: {
        borderWidth: 2,
        borderColor: BORDER,
    },

    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#e5e7eb",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },

    th: {
        paddingVertical: 3,
        paddingHorizontal: 3,
        fontSize: 7.5,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        borderRightWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
    },

    thLast: {
        borderRightWidth: 0,
    },

    tr: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },

    trLast: {
        borderBottomWidth: 0,
    },

    td: {
        paddingVertical: 3,
        paddingHorizontal: 3,
        fontSize: 8.5,
        borderRightWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
    },

    tdLast: {
        borderRightWidth: 0,
    },

    tdLeft: {
        textAlign: "left",
        fontWeight: 800 as any,
        textTransform: "uppercase",
    },

    obs: {
        borderWidth: 1,
        borderColor: BORDER,
        minHeight: 44,
        padding: 6,
        fontSize: 8.5,
        whiteSpace: "pre-wrap" as any,
    },

    muted: {
        marginTop: 6,
        fontSize: 8.5,
        color: GRAY_TEXT,
    },

    footer: {
        marginTop: 8,
        fontSize: 7.5,
        textAlign: "center",
        color: GRAY_TEXT,
    },
});

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount || 0);

function Watermark({ src }: { src: string }) {
    return (
        <Image
            src={src}
            style={{
                position: "absolute",
                top: 180,
                left: 50,
                width: 500,
                height: 500,
                opacity: 0.05,
                zIndex: -1,
            }}
        />
    );
}
const formatDateDMY = (value: unknown): string => {
    if (!value) {
        return "-";
    }

    const dateText = String(value)
        .split("T")[0]
        .split(" ")[0];

    const [year, month, day] = dateText.split("-");

    if (!year || !month || !day) {
        return String(value);
    }

    return `${day}/${month}/${year}`;
};
export default function EntregaTurnoPdfDoc({ detalle }: { detalle: any }) {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    const fondo = detalle.fondo_documentacion ?? {};
    const gastos = Array.isArray(fondo.gastos) ? fondo.gastos : [];

    const fecha = formatDateDMY(detalle.fecha);
    const fechaGenerado = formatDateDMY(detalle.created_at);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />

                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Image src={logoUrl} style={styles.headerLogo} />
                    </View>

                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>
                            Entrega de Turno
                        </Text>
                        <Text style={styles.headerSub}>
                            Folio #{detalle.id ?? "-"} · Sistema EOLO
                        </Text>
                    </View>
                </View>

                <View style={styles.fieldsWrap}>
                    <View style={styles.fieldsRow}>
                        <View style={[styles.fieldCell, { width: "18%" }]}>
                            <Text style={styles.label}>Folio</Text>
                            <Text style={styles.value}>#{detalle.id ?? "-"}</Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "20%" }]}>
                            <Text style={styles.label}>Fecha</Text>
                            <Text style={styles.value}>{fecha}</Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "22%" }]}>
                            <Text style={styles.label}>Entrega</Text>
                            <Text style={styles.value}>
                                {detalle.nombre_quien_entrega ?? "-"}
                            </Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "22%" }]}>
                            <Text style={styles.label}>Recibe</Text>
                            <Text style={styles.value}>
                                {detalle.nombre_quien_recibe ?? "-"}
                            </Text>
                        </View>

                        <View style={[styles.fieldCell, styles.fieldCellLast, { width: "18%" }]}>
                            <Text style={styles.label}>Jefe de turno</Text>
                            <Text style={styles.value}>
                                {detalle.nombre_jefe_turno_despacho ?? "-"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.box}>
                    <Text style={styles.boxTitle}>Datos generales</Text>

                    <View style={styles.tableWrap}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: "34%", textAlign: "left" }]}>
                                Campo
                            </Text>
                            <Text style={[styles.th, styles.thLast, { width: "66%" }]}>
                                Información
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft, { width: "34%" }]}>
                                Quién entrega
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "66%" }]}>
                                {detalle.nombre_quien_entrega ?? "-"}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft, { width: "34%" }]}>
                                Quién recibe
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "66%" }]}>
                                {detalle.nombre_quien_recibe ?? "-"}
                            </Text>
                        </View>

                        <View style={[styles.tr, styles.trLast]}>
                            <Text style={[styles.td, styles.tdLeft, { width: "34%" }]}>
                                Jefe de turno despacho
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "66%" }]}>
                                {detalle.nombre_jefe_turno_despacho ?? "-"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.box}>
                    <Text style={styles.boxTitle}>Fondo de documentación</Text>

                    <View style={styles.tableWrap}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: "50%" }]}>
                                Fondo recibido
                            </Text>
                            <Text style={[styles.th, styles.thLast, { width: "50%" }]}>
                                Fondo entregado
                            </Text>
                        </View>

                        <View style={[styles.tr, styles.trLast]}>
                            <Text style={[styles.td, { width: "50%", fontWeight: 900 as any }]}>
                                {formatCurrency(fondo.fondoRecibido)}
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "50%", fontWeight: 900 as any }]}>
                                {formatCurrency(fondo.fondoEntregado)}
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.boxTitle, { marginTop: 8 }]}>
                        Detalle de gastos
                    </Text>

                    <View style={styles.tableWrap}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: "70%", textAlign: "left" }]}>
                                Descripción
                            </Text>
                            <Text style={[styles.th, styles.thLast, { width: "30%" }]}>
                                Monto
                            </Text>
                        </View>

                        {gastos.length > 0 ? (
                            gastos.map((gasto: any, idx: number) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.tr,
                                        idx === gastos.length - 1 ? styles.trLast : {},
                                    ]}
                                >
                                    <Text style={[styles.td, styles.tdLeft, { width: "70%" }]}>
                                        {gasto.descripcion ?? "-"}
                                    </Text>
                                    <Text style={[styles.td, styles.tdLast, { width: "30%" }]}>
                                        {formatCurrency(gasto.monto)}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <View style={[styles.tr, styles.trLast]}>
                                <Text style={[styles.td, styles.tdLast, { width: "100%" }]}>
                                    Sin gastos registrados
                                </Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.muted}>
                        Gastos registrados:{" "}
                        <Text style={{ fontWeight: 900 as any }}>{gastos.length}</Text>
                    </Text>
                </View>

                <View style={styles.box}>
                    <Text style={styles.boxTitle}>Documentación y operaciones</Text>

                    <View style={styles.tableWrap}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: "46%", textAlign: "left" }]}>
                                Concepto
                            </Text>
                            <Text style={[styles.th, styles.thLast, { width: "54%" }]}>
                                Información
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft, { width: "46%" }]}>
                                Vales de gasolina
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "54%" }]}>
                                {fondo.cantidadValesGasolina ?? "0"}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft, { width: "46%" }]}>
                                Folios vales gasolina
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "54%" }]}>
                                {Array.isArray(fondo.folioValesGasolina) &&
                                fondo.folioValesGasolina.length > 0
                                    ? fondo.folioValesGasolina.join(", ")
                                    : "N/A"}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft, { width: "46%" }]}>
                                Reporte de aterrizaje
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "54%" }]}>
                                {fondo.reporteAterisaje === "si"
                                    ? `Sí (${fondo.cantidadReporteAterisaje ?? 0})`
                                    : "No"}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft, { width: "46%" }]}>
                                Operaciones llegada / salida
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "54%" }]}>
                                {fondo.totalLlegadaOperacion ?? 0} /{" "}
                                {fondo.totalSalidaOperacion ?? 0}
                            </Text>
                        </View>

                        <View style={[styles.tr, styles.trLast]}>
                            <Text style={[styles.td, styles.tdLeft, { width: "46%" }]}>
                                WalkArounds
                            </Text>
                            <Text style={[styles.td, styles.tdLast, { width: "54%" }]}>
                                {fondo.cuantosWalkArounds ?? 0}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.box}>
                    <Text style={styles.boxTitle}>Estado de caja fuerte</Text>

                    <View style={styles.obs}>
                        <Text>{detalle.estado_caja_fuerte || "Sin observaciones"}</Text>
                    </View>
                </View>

                <Text style={styles.footer}>
                    Generado el {fechaGenerado} · Sistema EOLO
                </Text>
            </Page>
        </Document>
    );
}
