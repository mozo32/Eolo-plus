import { useEffect } from "react";
import { showAutotanque } from "@/stores/apiAutoTanque";
import Swal from "sweetalert2";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
    Image, // Importamos Image para la marca de agua
} from "@react-pdf/renderer";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";

const styles = StyleSheet.create({
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
    fieldCellLast: { borderRightWidth: 0 },
    label: {
        fontSize: 7,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        color: "#111",
        marginBottom: 1,
    },
    value: {
        fontSize: 9,
        fontWeight: 800 as any,
        textTransform: "uppercase",
    },
    boxTitle: {
        fontSize: 9,
        fontWeight: 900 as any,
        textTransform: "uppercase",
        color: GREEN,
        marginBottom: 4,
        marginTop: 8,
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
        paddingVertical: 4,
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
        paddingVertical: 4,
        fontSize: 8,
        borderRightWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
    },
    tdLast: {
        borderRightWidth: 0,
    },
    balanceBox: {
        marginTop: 10,
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10
    },
    balanceCard: {
        borderWidth: 2,
        borderColor: BORDER,
        padding: 6,
        minWidth: 100,
        alignItems: "center"
    }
});

function Watermark({ src }: { src: string }) {
    return (
        <Image
            src={src}
            style={{
                position: "absolute",
                top: 100, // Ajusta la posición vertical
                left: 50, // Ajusta la posición horizontal
                width: 500, // Ajusta el ancho de la marca de agua
                height: 500, // Ajusta el alto de la marca de agua
                opacity: 0.15, // Ajusta la opacidad para que sea tenue
                zIndex: -1, // Asegura que esté detrás de todo el contenido
            }}
        />
    );
}

function AutotanquePdfDoc({ detalle }: { detalle: any }) {
    const turno = detalle?.data?.turno || {};
    const remisiones = Array.isArray(detalle?.data?.remision) ? detalle.data.remision : [];
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />

                {/* Header */}
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerLeftText}>EOLO</Text>
                    </View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Reporte de Turno Autotanque</Text>
                        <Text style={styles.headerSub}>
                            Folio Turno: #{turno.id || "N/A"} · Fecha: {turno.fecha || "N/A"}
                        </Text>
                    </View>
                </View>

                {/* Información de Apertura y Cierre */}
                <View style={styles.fieldsWrap}>
                    <View style={styles.fieldsRow}>
                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Responsable Apertura</Text>
                            <Text style={styles.value}>{turno.nombre || "-"}</Text>
                        </View>
                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Fecha/Hora Apertura</Text>
                            <Text style={styles.value}>{turno.fecha || "-"}</Text>
                        </View>
                        <View style={[styles.fieldCell, styles.fieldCellLast]}>
                            <Text style={styles.label}>Litros Iniciales</Text>
                            <Text style={styles.value}>{turno.litrosIni || 0} L</Text>
                        </View>
                    </View>
                    <View style={[styles.fieldsRow, { borderBottomWidth: 0 }]}>
                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Responsable Cierre</Text>
                            <Text style={styles.value}>{turno.nombreCierre || "-"}</Text>
                        </View>
                        <View style={styles.fieldCell}>
                            <Text style={styles.label}>Fecha/Hora Cierre</Text>
                            <Text style={styles.value}>{turno.fechaCierre || "-"}</Text>
                        </View>
                        <View style={[styles.fieldCell, styles.fieldCellLast]}>
                            <Text style={styles.label}>Litros Finales</Text>
                            <Text style={styles.value}>{turno.litrosCierre} L</Text>
                        </View>
                    </View>
                </View>

                {/* Tabla de Remisiones */}
                <Text style={styles.boxTitle}>Remisiones de Combustible</Text>
                <View style={styles.tableWrap}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: "15%" }]}>Folio</Text>
                        <Text style={[styles.th, { width: "25%" }]}>Cliente</Text>
                        <Text style={[styles.th, { width: "15%" }]}>Matrícula</Text>
                        <Text style={[styles.th, { width: "15%" }]}>Aeronave</Text>
                        <Text style={[styles.th, { width: "15%" }]}>Producto</Text>
                        <Text style={[styles.th, styles.thLast, { width: "15%" }]}>Total Lts</Text>
                    </View>

                    {remisiones.map((r: any, idx: number) => (
                        <View key={idx} style={styles.tr}>
                            <Text style={[styles.td, { width: "15%" }]}>{r.folio}</Text>
                            <Text style={[styles.td, { width: "25%", textAlign: "left", paddingLeft: 4 }]}>{r.cliente}</Text>
                            <Text style={[styles.td, { width: "15%" }]}>{r.matricula}</Text>
                            <Text style={[styles.td, { width: "15%" }]}>{r.aeronave_tipo}</Text>
                            <Text style={[styles.td, { width: "15%" }]}>{r.producto}</Text>
                            <Text style={[styles.td, styles.tdLast, { width: "15%", fontWeight: 900 as any }]}>{r.total_litros}</Text>
                        </View>
                    ))}
                </View>

                {/* Balances Finales */}
                <View style={styles.balanceBox}>
                    <View style={styles.balanceCard}>
                        <Text style={styles.label}>Total Vendido</Text>
                        <Text style={[styles.value, { color: GREEN }]}>{turno.totalVendidos || 0} L</Text>
                    </View>
                    <View style={styles.balanceCard}>
                        <Text style={styles.label}>Diferencia Final</Text>
                        <Text style={[styles.value, { color: "#dc2626" }]}>{turno.diferenciaFinal || 0} L</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}

type Props = { id: number | null; onDone: () => void };

export default function PdfExporterAutotanque({ id, onDone }: Props) {
    useEffect(() => {
        if (!id) return;

        const generatePdf = async () => {
            Swal.fire({
                title: "Generando Reporte",
                text: "Espere un momento...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const response = await showAutotanque(id);

                if (!response || !response.ok || !response.data) {
                    throw new Error("Datos incompletos");
                }

                const blob = await pdf(<AutotanquePdfDoc detalle={response} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Reporte_Autotanque_${id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);

                Swal.fire({
                    icon: "success",
                    title: "PDF Generado",
                    timer: 1500,
                    showConfirmButton: false,
                });
            } catch (e: any) {
                console.error(e);
                Swal.fire("Error", "No se pudo obtener la información", "error");
            } finally {
                onDone();
            }
        };

        generatePdf();
    }, [id]);

    return null;
}
