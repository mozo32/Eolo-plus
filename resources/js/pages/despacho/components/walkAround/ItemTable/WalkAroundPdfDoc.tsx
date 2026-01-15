import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";
import avionImg from "@/assets/avion (2).png";
import helipImg from "@/assets/helicoptero.png";
import { WalkAroundDetalle } from "@/stores/apiWalkaround";

/* =======================
   Helpers
======================= */

function normalizeArray(v: unknown): string[] {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string" && v) return [v];
    return [];
}

function hasDamage(v: unknown) {
    const arr = normalizeArray(v);
    if (!arr.length) return false;
    return !(arr.includes("sin_danio") && arr.length === 1);
}

function markX(v: unknown, key: string) {
    const arr = normalizeArray(v);
    if (arr.includes("sin_danio")) return key === "sin_danio" ? "X" : "";
    return arr.includes(key) ? "X" : "";
}

/* =======================
   Styles
======================= */

const GREEN = "#3d00cb";
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

    // Header
    headerWrap: {
        flexDirection: "row",
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 8,
    },
    headerLeft: {
        width: 95,
        backgroundColor: GREEN,
        color: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 10,
    },
    headerLeftText: {
        fontSize: 16,
        fontWeight: 900 as any,
        letterSpacing: 4,
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
    headerRight: {
        width: 140,
        paddingVertical: 6,
        paddingHorizontal: 10,
        justifyContent: "center",
        alignItems: "flex-end",
    },
    headerRightText: {
        fontSize: 8,
        color: GRAY_TEXT,
        textAlign: "right",
    },

    // Fields table
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

    // Body grid
    body: {
        flexDirection: "row",
        gap: 8,
    },
    leftCol: {
        width: 220,
    },
    rightCol: {
        flex: 1,
    },
    box: {
        borderWidth: 2,
        borderColor: BORDER,
        padding: 6,
    },
    boxTitle: {
        fontSize: 9,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        color: GREEN,
        marginBottom: 6,
    },

    // Map
    mapWrap: {
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#ffffff",
        width: 220,
        height: 260,
        position: "relative",
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    mapImage: {
        width: "100%",
        height: "100%",
        objectFit: "fill",
    },
    dot: {
        position: "absolute",
        width: 8,
        height: 8,
        borderRadius: 999,
        backgroundColor: "#dc2626",
        borderWidth: 2,
        borderColor: "#ffffff",
    },
    muted: {
        marginTop: 6,
        fontSize: 8.5,
        color: GRAY_TEXT,
    },

    // Table
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
    tdParte: {
        textAlign: "left",
        fontWeight: 800 as any,
        textTransform: "uppercase",
    },

    // Footer
    footer: {
        marginTop: 8,
        borderWidth: 2,
        borderColor: BORDER,
        padding: 6,
    },
    obs: {
        borderWidth: 1,
        borderColor: BORDER,
        minHeight: 44,
        padding: 6,
        fontSize: 8.5,
        whiteSpace: "pre-wrap" as any,
    },
    signGrid: {
        marginTop: 8,
        flexDirection: "row",
        gap: 10,
    },
    signCol: {
        flex: 1,
    },
    firmaBox: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: BORDER,
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ffffff",
    },
    firmaImg: {
        width: "100%",
        height: "100%",
        objectFit: "contain",
    },

    // Evidencias
    evidenciasTitle: {
        marginTop: 10,
        fontSize: 9,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        color: GREEN,
    },
    evidenciasGrid: {
        marginTop: 8,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },

    evidenciaCard: {
        width: "48%",
        borderWidth: 1,
        borderColor: BORDER,
        padding: 6,
        marginBottom: 8,
    },

    evidenciaImg: {
        width: "100%",
        height: 220,
        objectFit: "cover",
    },

    evidenciaCaption: {
        marginTop: 4,
        fontSize: 8,
        textAlign: "center",
        color: GRAY_TEXT,
    },
    footerFirmas: {
        marginTop: "auto",
        borderTopWidth: 1,
        borderColor: BORDER,
        paddingTop: 6,
    },

});

/* =======================
   PDF Document
======================= */

export default function WalkAroundPdfDoc({
    detalle,
    firmasBase64,
    evidenciasBase64,
    mapa3d,
}: {
    detalle: WalkAroundDetalle;
    firmasBase64: {
        responsable: string | null;
        jefe_area: string | null;
        fbo: string | null;
    };
    evidenciasBase64: string[];
    mapa3d: string;
}) {
    const isAvion = detalle.tipo === "avion";
    const checklist = isAvion
        ? detalle.checklists?.checklist_avion ?? {}
        : detalle.checklists?.checklist_helicoptero ?? {};
    const ORDER_HELI = [
        "Fuselaje",
        "Parabrisas",
        "Puertas, ventanas, antenas, luces",
        "Esquí / Neumáticos",
        "Palas",
        "Boom",
        "Estabilizadores",
        "Rotor de cola",
    ];

    const ORDER_AVION = [
        "Tren de nariz",
        "Compuertas tren de aterrizaje",
        "Parabrisas / limpiadores",
        "Radomo",
        "Tubo Pitot",
        "Fuselaje",
        "Antena",
        "Aleta",
        "Aleron",
        "Compensador de aleron",
        "Mechas de descarga estatica",
        "Punta de ala",
        "Luces de carreteo / aterrizaje",
        "Luces de navegación, beacon",
        "Borde de ataque",
        "Tren de aterrizaje principal",
        "Válvulas de servicio (combustible, etc...)",
        "Motor",
        "Estabilizador vertical",
        "Timón de dirección",
        "Compensador timón de dirección",
        "Estabilizador horizontal",
        "Timón de profundidad",
        "Compensador timón de profundidad",
        "Borde de empenaje",
        "Alas delta",
    ];
    const orderedKeys = (isAvion ? ORDER_AVION : ORDER_HELI).filter(
        (k) => checklist[k] !== undefined
    );
    const totalConDanio = orderedKeys.filter((k) =>
        hasDamage((checklist as any)[k]?.danios)
    ).length;
    const CHUNK = 4;
    const pages = [];

    for (let i = 0; i < evidenciasBase64.length; i += CHUNK) {
        pages.push(evidenciasBase64.slice(i, i + CHUNK));
    }
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* HEADER */}
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerLeftText}>EOLO</Text>
                    </View>

                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>
                            Reporte de Inspección de Aeronavedddddddddd
                        </Text>
                        <Text style={styles.headerSub}>
                            WalkAround #{detalle.id} · Matrícula {detalle.matricula}
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={styles.headerRightText}>
                            Fecha: {detalle.fecha}
                        </Text>
                        <Text style={styles.headerRightText}>
                            Hora: {detalle.hora}
                        </Text>
                    </View>
                </View>

                {/* BODY */}
                <View style={styles.body}>
                    {/* MAPA 3D */}
                    <View style={styles.leftCol}>
                        <View style={styles.box}>
                            <Text style={styles.boxTitle}>Diagrama de daños</Text>

                            <View style={styles.mapWrap}>
                                <Image src={mapa3d} style={styles.mapImage} />
                            </View>

                            <Text style={{ fontSize: 8, marginTop: 4 }}>
                                Total marcas: {detalle.marcas_danio?.length ?? 0}
                            </Text>
                        </View>
                    </View>

                    {/* CHECKLIST */}
                    <View style={styles.rightCol}>
                        <View style={styles.box}>
                            <Text style={styles.boxTitle}>
                                Parte de la aeronave
                            </Text>

                            <View style={styles.tableWrap}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { width: "50%" }]}>
                                        Parte
                                    </Text>
                                    <Text style={[styles.th, { width: "10%" }]}>
                                        Sin
                                    </Text>
                                    <Text style={[styles.th, { width: "10%" }]}>
                                        Gol
                                    </Text>
                                    <Text style={[styles.th, { width: "10%" }]}>
                                        Ray
                                    </Text>
                                    <Text style={[styles.th, { width: "10%" }]}>
                                        Fis
                                    </Text>
                                    <Text style={[styles.th, { width: "10%" }]}>
                                        Otro
                                    </Text>
                                </View>

                                {orderedKeys.map((k) => {
                                    const v = (checklist as any)[k];

                                    return (
                                        <View key={k} style={styles.tr}>
                                            <Text style={[styles.td, styles.tdParte, { width: "50%" }]}>
                                                {k}
                                            </Text>
                                            <Text style={[styles.td, { width: "10%" }]}>
                                                {markX(v.danios, "sin_danio")}
                                            </Text>
                                            <Text style={[styles.td, { width: "10%" }]}>
                                                {markX(v.danios, "golpe")}
                                            </Text>
                                            <Text style={[styles.td, { width: "10%" }]}>
                                                {markX(v.danios, "rayon")}
                                            </Text>
                                            <Text style={[styles.td, { width: "10%" }]}>
                                                {markX(v.danios, "fisurado")}
                                            </Text>
                                            <Text style={[styles.td, { width: "10%" }]}>
                                                {markX(v.danios, "otro")}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <Text style={{ fontSize: 8, marginTop: 4 }}>
                                Elementos: {orderedKeys.length} · Con daño: {totalConDanio}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* OBSERVACIONES */}
                <View style={[styles.box, { marginTop: 8 }]}>
                    <Text style={styles.boxTitle}>Observaciones</Text>
                    <View style={styles.obs}>
                        <Text>{detalle.observaciones || "Sin observaciones"}</Text>
                    </View>
                </View>
            </Page>
            {pages.map((group, pageIndex) => (
                <Page key={pageIndex} size="A4" style={styles.page}>
                    <Text style={styles.boxTitle}>Evidencia fotográfica</Text>

                    <View style={styles.evidenciasGrid}>
                        {group.map((src, idx) => (
                            <View key={idx} style={styles.evidenciaCard}>
                                <Image src={src} style={styles.evidenciaImg} />
                                <Text style={styles.evidenciaCaption}>
                                    Foto #{pageIndex * CHUNK + idx + 1}
                                </Text>
                            </View>
                        ))}
                    </View>
                </Page>
            ))}
            <Page size="A4" style={styles.page}>
                <View style={styles.footerFirmas}>
                    <View style={styles.signGrid}>
                        {/* firmas */}
                    </View>
                </View>
            </Page>
        </Document>
    );
}
