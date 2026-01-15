import { useEffect, useState } from "react";
import Swal from "sweetalert2";

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
    pdf,
} from "@react-pdf/renderer";

import avionImg from "@/assets/avion (2).png";
import helipImg from "@/assets/helicoptero.png";

import { fetchWalkaroundDetalle, WalkAroundDetalle } from "@/stores/apiWalkaround";

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

function toPct(n: number) {
    const v = n > 1 ? n : n * 100;
    const clamped = Math.max(0, Math.min(100, v));
    return clamped;
}

function getFirmaByRol(detalle: any, rol: string) {
    const firmas = Array.isArray(detalle?.firmas) ? detalle.firmas : [];
    return firmas.find((x: any) => x?.rol === rol && x?.status !== "I") ?? null;
}

function toSameOrigin(url: string) {
    try {
        const u = new URL(url);
        return `${window.location.origin}${u.pathname}`;
    } catch {
        return url;
    }
}

async function urlToDataUrl(url: string): Promise<string> {
    const sameOriginUrl = toSameOrigin(url);

    const res = await fetch(sameOriginUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo cargar imagen: ${sameOriginUrl}`);

    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result)); // data:image/png;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/* =======================
   PDF Styles
======================= */

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
        width: 205,
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
    footerPage: {
        padding: 20,
        fontSize: 9,
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },

    footerTitle: {
        fontSize: 10,
        fontWeight: 900 as any,
        color: GREEN,
        marginBottom: 12,
        textTransform: "uppercase",
    },

    firmasGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 12,
    },

    firmaCard: {
        width: "40%",
        borderWidth: 1,
        borderColor: BORDER,
        padding: 5,
    },

    firmaLabel: {
        fontSize: 8,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        marginBottom: 2,
    },

    firmaNombre: {
        fontSize: 9,
        marginBottom: 6,
    },

    firmaBoxFooter: {
        height: 70,
        borderWidth: 1,
        borderColor: BORDER,
        justifyContent: "center",
        alignItems: "center",
    },

    firmaImgFooter: {
        width: "100%",
        height: "100%",
        objectFit: "contain",
    },

    firmaPlaceholder: {
        fontSize: 8,
        color: GRAY_TEXT,
    },

});

/* =======================
   PDF Component
======================= */

function PdfMapaReact({
    imageSrc,
    points,
}: {
    imageSrc: string;
    points: Array<{ x: number; y: number; descripcion?: string | null }>;
}) {
    const MAP_W = 220;
    const MAP_H = 260;

    return (
        <View style={styles.mapWrap}>
            <Image src={imageSrc} style={styles.mapImage} />

            {points.map((p, idx) => {
                const left = (toPct(p.x) / 100) * MAP_W;
                const top = (toPct(p.y) / 100) * MAP_H;

                return (
                    <View
                        key={idx}
                        style={[
                            styles.dot,
                            {
                                left: left - 4,
                                top: top - 4,
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
}
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
function WalkAroundPdfDoc({
    detalle,
    firmasBase64,
    evidenciasBase64,
}: {
    detalle: WalkAroundDetalle;
    firmasBase64: { responsable: string | null; jefe_area: string | null; fbo: string | null };
    evidenciasBase64: string[];
}) {
    const isAvion = detalle.tipo === "avion";
    const checklist = isAvion
        ? detalle.checklists?.checklist_avion ?? {}
        : detalle.checklists?.checklist_helicoptero ?? {};

    const imageSrc = isAvion ? avionImg : helipImg;
    const watermarkUrl = `${window.location.origin}/storage/6e611b3e-6b18-4232-9946-2c340de5c753.jpg`;

    const marcas = Array.isArray(detalle.marcas_danio) ? detalle.marcas_danio : [];

    const AVION_PARTES = [
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

    const HELI_PARTES = [
        "Fuselaje",
        "Puertas, ventanas, antenas, luces",
        "Esquí / Neumáticos",
        "Palas",
        "Boom",
        "Estabilizadores",
        "Rotor de cola",
        "Parabrisas",
    ];

    const orderedKeys = (() => {
        const base = isAvion ? AVION_PARTES : HELI_PARTES;
        const set = new Set(base);
        const extras = Object.keys(checklist).filter((k) => !set.has(k));
        return [...base, ...extras].filter((k) => k in checklist);
    })();

    const totalConDanio = orderedKeys.filter((k) => hasDamage((checklist as any)[k])).length;

    const modalidad =
        (detalle.movimiento || "").toLowerCase().includes("llegada")
            ? "LLEGADA"
            : "SALIDA";
    const CHUNK = 6;
    const pages = [];

    for (let i = 0; i < evidenciasBase64.length; i += CHUNK) {
        pages.push(evidenciasBase64.slice(i, i + CHUNK));
    }

    const lastPageFotos = pages[pages.length - 1]?.length ?? 0;
    const footerEnMismaPagina = lastPageFotos <= 4;
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerLeftText}>EOLO</Text>
                    </View>

                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>
                            Reporte de Inspección de Aeronave
                        </Text>
                        <Text style={styles.headerSub}>
                            WalkAround #{detalle.id} · Matrícula {detalle.matricula ?? "-"} ·{" "}
                            {detalle.fecha ? String(detalle.fecha).split("T")[0] : "-"} · Tipo {detalle.tipoAeronave ?? "-"}
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={styles.headerRightText}>Tipo: {detalle.tipo ?? "-"}</Text>
                        <Text style={styles.headerRightText}>Hora: {detalle.hora ?? "-"}</Text>
                        <Text style={styles.headerRightText}>FBO: {detalle.fbo ?? "-"}</Text>
                    </View>
                </View>

                {/* Fields */}
                <View style={styles.fieldsWrap}>
                    <View style={styles.fieldsRow}>
                        <View style={[styles.fieldCell, { width: "18%" }]}>
                            <Text style={styles.value}>{modalidad}</Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "20%" }]}>
                            <Text style={styles.label}>Matrícula</Text>
                            <Text style={styles.value}>{detalle.matricula ?? "-"}</Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "16%" }]}>
                            <Text style={styles.label}>Tipo aeronave</Text>
                            <Text style={styles.value}>{detalle.tipo ?? "-"}</Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "22%" }]}>
                            <Text style={styles.label}>Procedencia / Destino</Text>
                            <Text style={styles.value}>
                                {detalle.procedensia ?? detalle.destino ?? "-"}
                            </Text>
                        </View>

                        <View style={[styles.fieldCell, { width: "12%" }]}>
                            <Text style={styles.label}>Hora</Text>
                            <Text style={styles.value}>{detalle.hora ?? "-"}</Text>
                        </View>

                        <View style={[styles.fieldCell, styles.fieldCellLast, { width: "12%" }]}>
                            <Text style={styles.label}>Fecha</Text>
                            <Text style={styles.value}>
                                {detalle.fecha ? String(detalle.fecha).split("T")[0] : "-"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.body}>
                    <View style={styles.leftCol}>
                        <View style={styles.box}>
                            <Text style={styles.boxTitle}>Diagrama de daños</Text>

                            <PdfMapaReact
                                imageSrc={imageSrc}
                                points={marcas.map((m: any) => ({
                                    x: m.x,
                                    y: m.y,
                                }))}
                            />

                            <Text style={styles.muted}>
                                Total marcas:{" "}
                                <Text style={{ fontWeight: 900 as any }}>
                                    {marcas.length}
                                </Text>
                            </Text>
                        </View>
                    </View>
                    <View style={styles.rightCol}>
                        <View style={styles.box}>
                            <Text style={styles.boxTitle}>Parte de la aeronave</Text>

                            <View style={styles.tableWrap}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { width: "46%", textAlign: "left" }]}>Parte</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Der</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Izq</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Sin</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Gol</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Ray</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Fis</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>Que</Text>
                                    <Text style={[styles.th, { width: "6%" }]}>P.C</Text>
                                    <Text style={[styles.th, styles.thLast, { width: "6%" }]}>Otro</Text>
                                </View>

                                {orderedKeys.map((k) => {
                                    const v = (checklist as any)[k];
                                    return (
                                        <View key={k} style={styles.tr}>
                                            <Text style={[styles.td, styles.tdParte, { width: "46%" }]}>{k}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{v.der ? "X" : ""}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{v.izq ? "X" : ""}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "sin_danio")}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "golpe")}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "rayon")}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "fisurado")}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "quebrado")}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "pintura_cuarteada")}</Text>
                                            <Text style={[styles.td, { width: "6%" }]}>{markX(v.danios, "otro")}</Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <Text style={styles.muted}>
                                Elementos:{" "}
                                <Text style={{ fontWeight: 900 as any }}>{orderedKeys.length}</Text>
                                {" · "}
                                Con daño:{" "}
                                <Text style={{ fontWeight: 900 as any }}>{totalConDanio}</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Observaciones */}
                <View style={[styles.box, { marginTop: 8 }]}>
                    <Text style={styles.boxTitle}>Observaciones adicionales</Text>
                    <View style={styles.obs}>
                        <Text>{detalle.observaciones ?? "Sin observaciones"}</Text>
                    </View>
                </View>
            </Page>

            {pages.slice(0, -1).map((group, pageIndex) => (
                <Page key={`evidencias-${pageIndex}`} size="A4" style={styles.page}>
                    <Watermark src={watermarkUrl} />
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
                <Watermark src={watermarkUrl} />
                <Text style={styles.boxTitle}>Evidencia fotográfica</Text>

                <View style={styles.evidenciasGrid}>
                    {pages[pages.length - 1]?.map((src, idx) => (
                        <View key={idx} style={styles.evidenciaCard}>
                            <Image src={src} style={styles.evidenciaImg} />
                            <Text style={styles.evidenciaCaption}>
                                Foto #{(pages.length - 1) * CHUNK + idx + 1}
                            </Text>
                        </View>
                    ))}
                </View>

                {footerEnMismaPagina && (
                    <View style={{ marginTop: 10 }}>
                        <View style={styles.firmasGrid}>
                            {/* Responsable */}
                            <View style={styles.firmaCard}>
                                <Text style={styles.firmaLabel}>Responsable</Text>
                                <Text style={styles.firmaNombre}>{detalle.responsable ?? "-"}</Text>
                                <View style={styles.firmaBoxFooter}>
                                    {firmasBase64.responsable ? (
                                        <Image src={firmasBase64.responsable} style={styles.firmaImgFooter} />
                                    ) : (
                                        <Text style={styles.firmaPlaceholder}>Sin firma</Text>
                                    )}
                                </View>
                            </View>

                            {/* Jefe de área */}
                            <View style={styles.firmaCard}>
                                <Text style={styles.firmaLabel}>Jefe de área</Text>
                                <Text style={styles.firmaNombre}>{detalle.jefe_area ?? "-"}</Text>
                                <View style={styles.firmaBoxFooter}>
                                    {firmasBase64.jefe_area ? (
                                        <Image src={firmasBase64.jefe_area} style={styles.firmaImgFooter} />
                                    ) : (
                                        <Text style={styles.firmaPlaceholder}>Sin firma</Text>
                                    )}
                                </View>
                            </View>

                            {/* FBO */}
                            <View style={styles.firmaCard}>
                                <Text style={styles.firmaLabel}>FBO</Text>
                                <Text style={styles.firmaNombre}>{detalle.fbo ?? "-"}</Text>
                                <View style={styles.firmaBoxFooter}>
                                    {firmasBase64.fbo ? (
                                        <Image src={firmasBase64.fbo} style={styles.firmaImgFooter} />
                                    ) : (
                                        <Text style={styles.firmaPlaceholder}>Sin firma</Text>
                                    )}
                                </View>
                            </View>

                            {/* Elabora */}
                            <View style={styles.firmaCard}>
                                <Text style={styles.firmaLabel}>Elabora</Text>
                                <Text style={styles.firmaNombre}>{detalle.elabora ?? "-"}</Text>
                                <View style={styles.firmaBoxFooter}>
                                    <Text style={styles.firmaPlaceholder}>Firma no requerida</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </Page>
            {!footerEnMismaPagina && (
                <Page size="A4" style={styles.footerPage}>
                    <Watermark src={watermarkUrl} />
                    <Text style={styles.footerTitle}>Firmas</Text>
                    <View style={styles.firmasGrid}>
                        {/* Responsable */}
                        <View style={styles.firmaCard}>
                            <Text style={styles.firmaLabel}>Responsable</Text>
                            <Text style={styles.firmaNombre}>{detalle.responsable ?? "-"}</Text>
                            <View style={styles.firmaBoxFooter}>
                                {firmasBase64.responsable ? (
                                    <Image src={firmasBase64.responsable} style={styles.firmaImgFooter} />
                                ) : (
                                    <Text style={styles.firmaPlaceholder}>Sin firma</Text>
                                )}
                            </View>
                        </View>

                        {/* Jefe de área */}
                        <View style={styles.firmaCard}>
                            <Text style={styles.firmaLabel}>Jefe de área</Text>
                            <Text style={styles.firmaNombre}>{detalle.jefe_area ?? "-"}</Text>
                            <View style={styles.firmaBoxFooter}>
                                {firmasBase64.jefe_area ? (
                                    <Image src={firmasBase64.jefe_area} style={styles.firmaImgFooter} />
                                ) : (
                                    <Text style={styles.firmaPlaceholder}>Sin firma</Text>
                                )}
                            </View>
                        </View>

                        {/* FBO */}
                        <View style={styles.firmaCard}>
                            <Text style={styles.firmaLabel}>FBO</Text>
                            <Text style={styles.firmaNombre}>{detalle.fbo ?? "-"}</Text>
                            <View style={styles.firmaBoxFooter}>
                                {firmasBase64.fbo ? (
                                    <Image src={firmasBase64.fbo} style={styles.firmaImgFooter} />
                                ) : (
                                    <Text style={styles.firmaPlaceholder}>Sin firma</Text>
                                )}
                            </View>
                        </View>

                        {/* Elabora */}
                        <View style={styles.firmaCard}>
                            <Text style={styles.firmaLabel}>Elabora</Text>
                            <Text style={styles.firmaNombre}>{detalle.elabora ?? "-"}</Text>
                            <View style={styles.firmaBoxFooter}>
                                <Text style={styles.firmaPlaceholder}>Firma no requerida</Text>
                            </View>
                        </View>
                    </View>
                </Page>
            )}
        </Document>
    );

}

/* ====================
   Exporter Component
   ==================== */

type Props = { id: number | null; onDone: () => void };

export default function WalkAroundPdfExporterReactPdf({ id, onDone }: Props) {
    const [detalle, setDetalle] = useState<WalkAroundDetalle | null>(null);
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                const data = await fetchWalkaroundDetalle(id);
                setDetalle(data);
            } catch (e: any) {
                Swal.fire("Error", e?.message || "No se pudo cargar el detalle", "error");
                onDone();
            }
        })();
    }, [id, onDone]);

    useEffect(() => {
        if (!detalle) return;

        (async () => {
            try {
                // Firmas
                const fResp = getFirmaByRol(detalle, "responsable");
                const fJefe = getFirmaByRol(detalle, "jefe_area");
                const fFbo = getFirmaByRol(detalle, "fbo");

                const firmasBase64 = {
                    responsable: fResp?.url ? await urlToDataUrl(fResp.url) : null,
                    jefe_area: fJefe?.url ? await urlToDataUrl(fJefe.url) : null,
                    fbo: fFbo?.url ? await urlToDataUrl(fFbo.url) : null,
                };

                const evidenciasRaw =
                    Array.isArray((detalle as any).imagenes)
                        ? (detalle as any).imagenes
                        : Array.isArray((detalle as any).evidencias)
                            ? (detalle as any).evidencias
                            : [];

                const evidenciasUrls: string[] = evidenciasRaw
                    .map((x: any) => x?.url)
                    .filter(Boolean);

                const evidenciasBase64 = await Promise.all(
                    evidenciasUrls.slice(0, 12).map((u) => urlToDataUrl(u))
                );

                const blob = await pdf(
                    <WalkAroundPdfDoc
                        detalle={detalle}
                        firmasBase64={firmasBase64}
                        evidenciasBase64={evidenciasBase64}
                    />
                ).toBlob();

                const filename = `WalkAround_${detalle.id}_${(detalle.matricula || "")
                    .replace(/\s+/g, "_")}_${(detalle.fecha || "").replace(/\s+/g, "_")}.pdf`;

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                await Swal.fire({
                    icon: "success",
                    title: "PDF generado",
                    text: "El archivo se descargó correctamente.",
                    timer: 2000,
                    showConfirmButton: false,
                });
            } catch (e: any) {
                Swal.fire("Error", e?.message || "No se pudo generar el PDF", "error");
            } finally {
                onDone();
            }
        })();
    }, [detalle, onDone]);
    return null;
}
