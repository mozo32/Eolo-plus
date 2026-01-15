import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";
import { EntregaTurnoDetalle } from "@/stores/apiEntregarTurno";

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

    /* HEADER */
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
        fontWeight: 900 as any,
        color: "#ffffff",
        marginBottom: 2,
        letterSpacing: 1,
    },
    headerSub: {
        fontSize: 9,
        color: "#dcfce7",
    },
    headerLogo: {
        width: 70,
        height: 40,
        objectFit: "contain",
    },
    /* CARD */
    card: {
        borderWidth: 1.5,
        borderColor: BORDER,
        padding: 10,
        marginBottom: 10,
        backgroundColor: "#ffffff",
    },
    cardTitle: {
        fontSize: 9,
        fontWeight: 900 as any,
        color: GREEN,
        marginBottom: 6,
        textTransform: "uppercase",
    },

    /* GRID */
    row: {
        flexDirection: "row",
        gap: 10,
    },
    col: {
        flex: 1,
    },

    label: {
        fontSize: 7.5,
        fontWeight: 900 as any,
        color: GRAY,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    value: {
        fontSize: 9.5,
        marginBottom: 6,
    },

    /* TABLE */
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
        fontWeight: 900 as any,
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
});

function Watermark({ src }: { src: string }) {
    return (
        <Image
            src={src}
            style={{
                position: "absolute",
                top: 100,
                left: 50,
                width: 500,
                height: 500,
                opacity: 0.30,
            }}
        />
    );
}

export default function EntregaTurnoPdfDoc({
    detalle,
}: {
    detalle: EntregaTurnoDetalle;
}) {
    const watermarkUrl = `${window.location.origin}/storage/6e611b3e-6b18-4232-9946-2c340de5c753.jpg`;
    const logokUrl = `${window.location.origin}/storage/fc3de74e-ec9b-4341-a210-41878ccae559.jpg`;
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />
                {/* HEADER */}
                <View style={styles.header}>
                    {/* TEXTO IZQUIERDA */}
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
                            <Text style={styles.label}>Nombre</Text>
                            <Text style={styles.value}>{detalle.nombre}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Quién entrega</Text>
                            <Text style={styles.value}>{detalle.nombre_quien_entrega}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Jefe de turno</Text>
                            <Text style={styles.value}>{detalle.nombre_jefe_turno_despacho}</Text>
                        </View>
                    </View>
                </View>

                {/* CHECKLIST COMUNICACIÓN */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Checklist de comunicación</Text>

                    <View style={styles.table}>
                        <View style={styles.trHeader}>
                            <Text style={[styles.th, styles.tdLeft]}>Equipo</Text>
                            <Text style={styles.th}>Entregado</Text>
                            <Text style={styles.th}>Cargado</Text>
                        </View>

                        {Object.entries(detalle.checklist_comunicacion?.items || {}).map(
                            ([nombre, item]: any) => (
                                <View key={nombre} style={styles.tr}>
                                    <Text style={[styles.td, styles.tdLeft]}>{nombre}</Text>
                                    <Text style={styles.td}>{item.entregado ? "Sí" : "No"}</Text>
                                    <Text style={styles.td}>{item.cargado}</Text>
                                </View>
                            )
                        )}
                    </View>

                    {detalle.checklist_comunicacion?.fallas && (
                        <Text style={{ marginTop: 6 }}>
                            <Text style={{ fontWeight: 900 as any }}>Fallas:</Text>{" "}
                            {detalle.checklist_comunicacion.fallas}
                        </Text>
                    )}
                </View>

                {/* EQUIPO OFICINA */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Equipo de oficina</Text>

                    <View style={styles.table}>
                        <View style={styles.trHeader}>
                            <Text style={[styles.th, styles.tdLeft]}>Equipo</Text>
                            <Text style={styles.th}>Existencia</Text>
                            <Text style={styles.th}>Entregadas</Text>
                            <Text style={styles.th}>Recibidas</Text>
                        </View>

                        {detalle.equipo_oficina?.map((e, i) => (
                            <View key={i} style={styles.tr}>
                                <Text style={[styles.td, styles.tdLeft]}>{e.equipo}</Text>
                                <Text style={styles.td}>{e.existencia}</Text>
                                <Text style={styles.td}>{e.entregadas}</Text>
                                <Text style={styles.td}>{e.recibidas}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* COPIADORAS */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Copiadoras</Text>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Funciona</Text>
                            <Text style={styles.value}>{detalle.copiadoras?.funciona}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Tóner</Text>
                            <Text style={styles.value}>{detalle.copiadoras?.toner}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Paquetes</Text>
                            <Text style={styles.value}>{detalle.copiadoras?.paquetes}</Text>
                        </View>
                    </View>

                    {detalle.copiadoras?.fallas && (
                        <Text style={{ marginTop: 4 }}>
                            <Text style={{ fontWeight: 900 as any }}>Fallas:</Text>{" "}
                            {detalle.copiadoras.fallas}
                        </Text>
                    )}
                </View>

                {/* FONDO DOCUMENTACIÓN */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Fondo de documentación</Text>

                    <View style={styles.table}>
                        <View style={styles.trHeader}>
                            <Text style={[styles.th, styles.tdLeft]}>Concepto</Text>
                            <Text style={styles.th}>Cantidad</Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Fondo recibido</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.fondoRecibido}</Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Vales de gasolina</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.cantidadValesGasolina}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Fondo entregado</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.fondoEntregado}</Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Folio vales gasolina</Text>
                            <Text style={styles.td}>{detalle.fondo_documentacion?.folioValesGasolina}</Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Reporte de aterrizaje</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.reporteAterisaje === "si" ? "Sí" : "No"}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Cantidad reportes aterrizaje</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.cantidadReporteAterisaje}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Total llegada operación</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.totalLlegadaOperacion}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Total salida operación</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.totalSalidaOperacion}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>Reportes enviados por correo</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.reportesEnviadosCorreo}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>
                                Operaciones coordinadas entregadas
                            </Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.cantidadOperacionesCordinadasEntregadas}
                            </Text>
                        </View>

                        <View style={styles.tr}>
                            <Text style={[styles.td, styles.tdLeft]}>WalkArounds</Text>
                            <Text style={styles.td}>
                                {detalle.fondo_documentacion?.cuantosWalkArounds}
                            </Text>
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

                {/* FOOTER */}
                <Text style={styles.footer}>
                    Generado el {detalle.created_at?.split("T")[0]} · Sistema EOLO
                </Text>

            </Page>
        </Document>
    );
}
