import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";

const GREEN = "#003E51";
const BORDER = "#111827";
const GRAY = "#374151";
const LIGHT = "#f9fafb";

const styles = StyleSheet.create({
    page: {
        padding: 18,
        fontSize: 9,
        fontFamily: "Helvetica",
        color: "#111827",
    },
    header: {
        backgroundColor: GREEN,
        padding: 14,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerTextWrap: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: "bold" as any,
        color: "#ffffff",
        marginBottom: 2,
        letterSpacing: 1,
    },
    headerSub: {
        fontSize: 9,
        color: "#dcfce7",
    },
    card: {
        borderWidth: 1.5,
        borderColor: BORDER,
        padding: 10,
        marginBottom: 10,
        backgroundColor: "#ffffff",
    },
    cardTitle: {
        fontSize: 9,
        fontWeight: "bold" as any,
        color: GREEN,
        marginBottom: 6,
        textTransform: "uppercase",
    },
    row: {
        flexDirection: "row",
        gap: 10,
    },
    col: {
        flex: 1,
    },
    label: {
        fontSize: 7.5,
        fontWeight: "bold" as any,
        color: GRAY,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    value: {
        fontSize: 9.5,
        marginBottom: 6,
    },
    table: {
        borderWidth: 1,
        borderColor: BORDER,
    },
    trHeader: {
        flexDirection: "row",
        backgroundColor: LIGHT,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    tr: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    th: {
        flex: 1,
        padding: 5,
        fontSize: 7.5,
        fontWeight: "bold" as any,
        textAlign: "center",
    },
    td: {
        flex: 1,
        padding: 5,
        fontSize: 8.5,
        textAlign: "center",
    },
    tdLeft: {
        textAlign: "left",
        flex: 2,
    },
    footer: {
        marginTop: 12,
        fontSize: 7.5,
        textAlign: "center",
        color: GRAY,
    },
    // Estilo especial para la lista de gastos
    gastoRow: {
        flexDirection: "row",
        backgroundColor: "#fff",
        borderBottomWidth: 0.5,
        borderColor: "#e5e7eb",
    }
});

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

export default function EntregaTurnoPdfDoc({ detalle }: { detalle: any }) {
    const watermarkUrl = `${window.location.origin}/storage/6e611b3e-6b18-4232-9946-2c340de5c753.jpg`;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Image
                    src={watermarkUrl}
                    style={{
                        position: "absolute",
                        top: 100,
                        left: 50,
                        width: 500,
                        height: 500,
                        opacity: 0.1, // Reducido un poco para que no estorbe la lectura
                    }}
                />

                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.headerTitle}>ENTREGA DE TURNO</Text>
                        <Text style={styles.headerSub}>
                            Folio #{detalle.id} · Fecha {detalle.fecha?.split("T")[0]}
                        </Text>
                    </View>
                </View>

                {/* DATOS GENERALES */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Datos generales</Text>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Quién entrega</Text>
                            <Text style={styles.value}>{detalle.nombre_quien_entrega}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Quién recibe</Text>
                            <Text style={styles.value}>{detalle.nombre_quien_recibe}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Jefe de turno</Text>
                            <Text style={styles.value}>{detalle.nombre_jefe_turno_despacho}</Text>
                        </View>
                    </View>
                </View>

                {/* FONDO DE DOCUMENTACIÓN */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Fondo de documentación</Text>

                    {/* Resumen de Fondos */}
                    <View style={[styles.row, { marginBottom: 10, borderBottomWidth: 1, paddingBottom: 5, borderColor: BORDER }]}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Fondo Recibido</Text>
                            <Text style={[styles.value, { color: GREEN, fontWeight: 'bold' }]}>
                                {formatCurrency(detalle.fondo_documentacion?.fondoRecibido)}
                            </Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Fondo Entregado</Text>
                            <Text style={[styles.value, { color: GREEN, fontWeight: 'bold' }]}>
                                {formatCurrency(detalle.fondo_documentacion?.fondoEntregado)}
                            </Text>
                        </View>
                    </View>

                    {/* LISTA DE GASTOS */}
                    <Text style={[styles.label, { marginBottom: 4 }]}>Detalle de Gastos</Text>
                    <View style={[styles.table, { marginBottom: 10 }]}>
                        <View style={styles.trHeader}>
                            <Text style={[styles.th, { flex: 3, textAlign: 'left' }]}>Descripción</Text>
                            <Text style={styles.th}>Monto</Text>
                        </View>
                        {detalle.fondo_documentacion?.gastos?.length > 0 ? (
                            detalle.fondo_documentacion.gastos.map((gasto: any, idx: number) => (
                                <View key={idx} style={styles.tr}>
                                    <Text style={[styles.td, { flex: 3, textAlign: 'left' }]}>{gasto.descripcion}</Text>
                                    <Text style={styles.td}>{formatCurrency(gasto.monto)}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.tr}><Text style={[styles.td, { width: '100%' }]}>Sin gastos registrados</Text></View>
                        )}
                    </View>

                    {/* Otros Datos de Documentación */}
                    <View style={styles.table}>
                        <View style={styles.trHeader}>
                            <Text style={[styles.th, styles.tdLeft]}>Concepto</Text>
                            <Text style={styles.th}>Información</Text>
                        </View>
                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Vales de gasolina (Cantidad)</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.cantidadValesGasolina}</Text>
                        </View>
                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Folios vales</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.folioValesGasolina?.join(', ') || "N/A"}</Text>
                        </View>
                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Reporte de aterrizaje</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.reporteAterisaje === "si" ? `Sí (${detalle.fondo_documentacion.cantidadReporteAterisaje})` : "No"}</Text>
                        </View>
                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Operaciones (Llegada/Salida)</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.totalLlegadaOperacion} / {detalle.fondo_documentacion?.totalSalidaOperacion}</Text>
                        </View>
                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>WalkArounds</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.cuantosWalkArounds}</Text>
                        </View>
                    </View>
                </View>

                {/* CAJA FUERTE */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Estado de caja fuerte</Text>
                    <Text style={styles.value}>
                        {detalle.estado_caja_fuerte || "Sin observaciones"}
                    </Text>
                </View>

                <Text style={styles.footer}>
                    Generado el {detalle.created_at?.split("T")[0]} · Sistema EOLO
                </Text>
            </Page>
        </Document>
    );
}
