import { useEffect } from "react";
import { fetchInspeccionId } from "@/stores/apiInspeccionCombustible";
import Swal from "sweetalert2";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
    Image,
} from "@react-pdf/renderer";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";
const RED_ALERTA = "#ef4444";

const styles = StyleSheet.create({
    headerLogo: {
        width: "100%",
        height: 45,
        objectFit: "contain",
    },
    page: {
        padding: 20,
        fontSize: 9,
        color: "#111827",
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },
    headerWrap: {
        flexDirection: "row",
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 8,
    },
    headerLeft: {
        width: 120,
        color: "#ffffff",
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
        fontWeight: "bold" as any,
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
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    fieldCell: {
        flex: 1,
        borderRightWidth: 1,
        borderColor: BORDER,
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    fieldCellLast: {
        flex: 1,
        borderRightWidth: 0,
        borderColor: BORDER,
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    label: {
        fontSize: 7,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
        color: "#111",
        marginBottom: 1,
    },
    value: {
        fontSize: 9,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
    },
    boxTitle: {
        fontSize: 9,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
        color: GREEN,
        marginBottom: 4,
        marginTop: 8,
    },
    tableWrap: {
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 8,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#e5e7eb",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    th: {
        paddingVertical: 4,
        fontSize: 7.5,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
        borderRightWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
    },
    tr: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    td: {
        paddingVertical: 4,
        paddingHorizontal: 3,
        fontSize: 8,
        borderRightWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
    },
    evidenciasGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 4,
    },
    evidenciaCard: {
        width: "49%",
        borderWidth: 2,
        borderColor: BORDER,
        padding: 6,
        marginBottom: 6,
        backgroundColor: "#ffffff",
    },
    evidenciaHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 5,
    },
    badge: {
        fontSize: 7,
        fontWeight: "bold" as any,
        paddingVertical: 2,
        paddingHorizontal: 5,
        textTransform: "uppercase",
        textAlign: "center",
        borderWidth: 1,
        borderColor: BORDER,
    },
    evidenciaImage: {
        width: "100%",
        height: 120,
        borderWidth: 1,
        borderColor: BORDER,
        objectFit: "cover",
        marginBottom: 5,
    },
    observacionBox: {
        borderTopWidth: 1,
        borderColor: "#e5e7eb",
        paddingTop: 4,
        minHeight: 28,
    },
    resumenBox: {
        borderWidth: 2,
        borderColor: BORDER,
        padding: 8,
        marginBottom: 8,
    },
    resumenGrid: {
        flexDirection: "row",
        gap: 8,
    },
    resumenCard: {
        flex: 1,
        borderWidth: 2,
        borderColor: BORDER,
        padding: 6,
        alignItems: "center",
        backgroundColor: "#ffffff",
    },
    resumenValue: {
        fontSize: 16,
        fontWeight: "bold" as any,
        color: GREEN,
    },
    resumenLabel: {
        fontSize: 7,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
        color: GRAY_TEXT,
        textAlign: "center",
        marginTop: 2,
    },
    footer: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        borderTopWidth: 1,
        borderColor: "#e5e7eb",
        paddingTop: 5,
        textAlign: "center",
        color: GRAY_TEXT,
        fontSize: 7,
    },
});

function Watermark({ src }: { src: string }) {
    return (
        <Image
            src={src}
            fixed
            style={{
                position: "absolute",
                top: 150,
                left: 50,
                width: 500,
                height: 500,
                opacity: 0.1,
                zIndex: -1,
            }}
        />
    );
}

function InspeccionPdfDoc({ data }: { data: any }) {
    const evidencias = Array.isArray(data?.evidencias) ? data.evidencias : [];
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    const totalShell = evidencias.filter((ev: any) => ev.modulo === "SHELL").length;
    const totalHydrokit = evidencias.filter((ev: any) => ev.modulo === "HYDROKIT").length;
    const totalAlertas = evidencias.filter((ev: any) => ev.alerta === true || ev.alerta === 1).length;

    const valorTexto = (valor: any) => {
        if (valor === null || valor === undefined || valor === "") {
            return "-";
        }

        return valor.toString();
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />

                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Image src={logoUrl} style={styles.headerLogo} />
                    </View>

                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Reporte de Inspección de Combustible</Text>
                        <Text style={styles.headerSub}>
                            Folio Registro: #{valorTexto(data.id)} · Fecha: {valorTexto(data.fecha)}
                        </Text>
                    </View>
                </View>

                <View style={styles.fieldsWrap}>
                    <View style={styles.fieldsRow}>
                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>ID Registro</Text>
                            <Text style={styles.value}>#{valorTexto(data.id)}</Text>
                        </View>

                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Usuario ID</Text>
                            <Text style={styles.value}>{valorTexto(data.usuario_id)}</Text>
                        </View>

                        <View style={styles.fieldCellLast}>
                            <Text style={styles.label}>Fecha y Hora</Text>
                            <Text style={styles.value}>{valorTexto(data.fecha)}</Text>
                        </View>
                    </View>

                    <View style={[styles.fieldsRow, { borderBottomWidth: 0 }]}>
                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Total Evidencias</Text>
                            <Text style={styles.value}>{evidencias.length}</Text>
                        </View>

                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Shell</Text>
                            <Text style={styles.value}>{totalShell}</Text>
                        </View>

                        <View style={styles.fieldCellLast}>
                            <Text style={styles.label}>Hydrokit</Text>
                            <Text style={styles.value}>{totalHydrokit}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.boxTitle}>Resumen de Inspección</Text>

                <View style={styles.resumenBox}>
                    <View style={styles.resumenGrid}>
                        <View style={styles.resumenCard}>
                            <Text style={styles.resumenValue}>{evidencias.length}</Text>
                            <Text style={styles.resumenLabel}>Evidencias Totales</Text>
                        </View>

                        <View style={styles.resumenCard}>
                            <Text style={styles.resumenValue}>{totalShell}</Text>
                            <Text style={styles.resumenLabel}>Módulo Shell</Text>
                        </View>

                        <View style={styles.resumenCard}>
                            <Text style={styles.resumenValue}>{totalHydrokit}</Text>
                            <Text style={styles.resumenLabel}>Módulo Hydrokit</Text>
                        </View>

                        <View style={styles.resumenCard}>
                            <Text
                                style={[
                                    styles.resumenValue,
                                    {
                                        color: totalAlertas > 0 ? RED_ALERTA : GREEN,
                                    },
                                ]}
                            >
                                {totalAlertas}
                            </Text>
                            <Text style={styles.resumenLabel}>Alertas</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.boxTitle}>Listado de Evidencias</Text>

                <View style={styles.tableWrap}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: "10%" }]}>#</Text>
                        <Text style={[styles.th, { width: "20%" }]}>Módulo</Text>
                        <Text style={[styles.th, { width: "20%" }]}>Estado</Text>
                        <Text style={[styles.th, { width: "50%", borderRightWidth: 0 }]}>Observación</Text>
                    </View>

                    {evidencias.length > 0 ? (
                        evidencias.map((ev: any, index: number) => (
                            <View key={index} style={styles.tr}>
                                <Text style={[styles.td, { width: "10%" }]}>{index + 1}</Text>
                                <Text style={[styles.td, { width: "20%" }]}>{valorTexto(ev.modulo)}</Text>
                                <Text
                                    style={[
                                        styles.td,
                                        {
                                            width: "20%",
                                            color: ev.alerta ? RED_ALERTA : "#065f46",
                                            fontWeight: "bold" as any,
                                        },
                                    ]}
                                >
                                    {ev.alerta ? "ALERTA" : "CONFORME"}
                                </Text>
                                <Text
                                    style={[
                                        styles.td,
                                        {
                                            width: "50%",
                                            borderRightWidth: 0,
                                            textAlign: "left",
                                        },
                                    ]}
                                >
                                    {valorTexto(ev.observacion)}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.tr}>
                            <Text
                                style={[
                                    styles.td,
                                    {
                                        width: "100%",
                                        borderRightWidth: 0,
                                    },
                                ]}
                            >
                                No hay evidencias registradas
                            </Text>
                        </View>
                    )}
                </View>

                <Text style={styles.boxTitle}>Evidencias Fotográficas</Text>

                <View style={styles.evidenciasGrid}>
                    {evidencias.map((ev: any, index: number) => (
                        <View key={index} style={styles.evidenciaCard} wrap={false}>
                            <View style={styles.evidenciaHeader}>
                                <Text
                                    style={[
                                        styles.badge,
                                        {
                                            backgroundColor: ev.modulo === "SHELL" ? "#fef3c7" : "#dbeafe",
                                            color: ev.modulo === "SHELL" ? "#92400e" : "#1e40af",
                                        },
                                    ]}
                                >
                                    {valorTexto(ev.modulo)}
                                </Text>

                                <Text
                                    style={[
                                        styles.badge,
                                        {
                                            backgroundColor: ev.alerta ? "#fee2e2" : "#dcfce7",
                                            color: ev.alerta ? RED_ALERTA : "#065f46",
                                        },
                                    ]}
                                >
                                    {ev.alerta ? "ALERTA" : "CONFORME"}
                                </Text>
                            </View>

                            <Image src={ev.url} style={styles.evidenciaImage} />

                            <View style={styles.observacionBox}>
                                <Text style={styles.label}>Observación</Text>
                                <Text
                                    style={[
                                        styles.value,
                                        {
                                            color: ev.alerta ? RED_ALERTA : "#111827",
                                        },
                                    ]}
                                >
                                    {valorTexto(ev.observacion)}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                <Text style={styles.footer}>
                    Documento generado por el Sistema de Gestión EOLO · {new Date().toLocaleString()}
                </Text>
            </Page>
        </Document>
    );
}

type Props = {
    id: number | null;
    onDone: () => void;
};

export default function PdfInspeccionCombustible({ id, onDone }: Props) {
    useEffect(() => {
        if (!id) return;

        const generarPdf = async () => {
            Swal.fire({
                title: "Generando Reporte",
                text: "Procesando imágenes...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const response = await fetchInspeccionId(id);
                const data = response?.data || response;

                if (!data) {
                    throw new Error("No se encontraron datos");
                }

                const getBase64 = async (url: string) => {
                    const res = await fetch(url, { mode: "cors" });
                    const blob = await res.blob();

                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();

                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                };

                const evidencias = Array.isArray(data.evidencias) ? data.evidencias : [];

                const evidenciasBase64 = await Promise.all(
                    evidencias.map(async (ev: any) => {
                        try {
                            if (!ev.url || ev.url.startsWith("data:image")) {
                                return ev;
                            }

                            const b64 = await getBase64(ev.url);

                            return {
                                ...ev,
                                url: b64,
                            };
                        } catch (e) {
                            console.error("Error convirtiendo imagen:", ev.url);

                            return ev;
                        }
                    })
                );

                const dataFinal = {
                    ...data,
                    evidencias: evidenciasBase64,
                };

                const blobPdf = await pdf(<InspeccionPdfDoc data={dataFinal} />).toBlob();
                const urlPdf = URL.createObjectURL(blobPdf);
                const a = document.createElement("a");

                a.href = urlPdf;
                a.download = `Inspeccion_${id}.pdf`;
                a.click();

                URL.revokeObjectURL(urlPdf);

                Swal.fire({
                    icon: "success",
                    title: "Reporte Generado",
                    timer: 1500,
                    showConfirmButton: false,
                });
            } catch (error) {
                console.error(error);

                Swal.fire(
                    "Error",
                    "Error de seguridad (CORS). Verifique la configuración del servidor.",
                    "error"
                );
            } finally {
                onDone();
            }
        };

        generarPdf();
    }, [id]);

    return null;
}
