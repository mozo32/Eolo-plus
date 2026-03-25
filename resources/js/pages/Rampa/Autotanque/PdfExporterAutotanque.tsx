import { useEffect } from "react";
import { showAutotanque } from "@/stores/apiAutoTanque";
import Swal from "sweetalert2";
import camioPipa from '../../../../../resources/js/assets/Captura de pantalla 2026-02-10 121721.png';
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
        fontWeight: "bold" as any,
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
    fieldCellLast: { borderRightWidth: 0 },
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
    // Estilos de Inspección
    inspeccionBox: {
        borderWidth: 2,
        borderColor: BORDER,
        padding: 8,
        marginBottom: 8,
    },
    checklistGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 5,
        borderTopWidth: 1,
        borderColor: "#eee",
        paddingTop: 5,
    },
    checkItem: {
        width: "33%",
        fontSize: 7,
        marginBottom: 3,
    },
    damageContainer: {
        position: 'relative',
        width: 320,
        height: 140,
        marginTop: 10,
        alignSelf: 'center',
    },

    damageMarker: {
        position: 'absolute',
        color: 'red',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // Estilos de Tabla
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
        fontSize: 8,
        borderRightWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
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

function AutotanquePdfDoc({ detalle }: { detalle: any }) {
    const turno = detalle?.data?.turno || {};
    const inspeccion = detalle?.data?.inspeccion || turno?.inspeccion;
    const remisiones = Array.isArray(detalle?.data?.remision) ? detalle.data.remision : [];
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />

                {/* Header */}
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}><Text style={styles.headerLeftText}>EOLO</Text></View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Reporte de Turno Autotanque</Text>
                        <Text style={styles.headerSub}>Folio Turno: #{turno.id || "N/A"} · Fecha: {turno.fecha || "N/A"}</Text>
                    </View>
                </View>

                {/* Apertura y Cierre */}
                <View style={styles.fieldsWrap}>
                    <View style={styles.fieldsRow}>
                        <View style={styles.fieldCell}><Text style={styles.label}>Responsable Apertura</Text><Text style={styles.value}>{turno.nombre || "-"}</Text></View>
                        <View style={styles.fieldCell}><Text style={styles.label}>Litros Iniciales</Text><Text style={styles.value}>{turno.litrosIni || 0} L</Text></View>
                    </View>
                    <View style={[styles.fieldsRow, { borderBottomWidth: 0 }]}>
                        <View style={styles.fieldCell}><Text style={styles.label}>Responsable Cierre</Text><Text style={styles.value}>{turno.nombreCierre || "-"}</Text></View>
                        <View style={styles.fieldCell}><Text style={styles.label}>Litros Finales</Text><Text style={styles.value}>{turno.litrosCierre} L</Text></View>
                    </View>
                </View>

                {/* Sección Inspección */}
                {inspeccion && (
                    <>
                        <Text style={styles.boxTitle}>Inspección de Unidad (Checklist)</Text>
                        <View style={styles.inspeccionBox}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={styles.label}>Operador: {inspeccion.operador}</Text>
                                <Text style={styles.label}>KM: {inspeccion.kilometraje}</Text>
                                <Text style={styles.label}>Combustible: {inspeccion.porcentaje_combustible}%</Text>
                            </View>

                            <View style={styles.checklistGrid}>
                                {Object.entries(inspeccion.checklist_respuestas || {}).map(([key, val], i) => (
                                    <View key={i} style={styles.checkItem}>
                                        <Text>• {key}: <Text style={{ color: val === 'Ok' ? '#065f46' : '#991b1b' }}>{val as string}</Text></Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.damageContainer}>
                                <Image src={camioPipa} style={{ width: '100%', height: '100%' }} />
                                {(inspeccion.danos_grafico || []).map((d: any, idx: number) => (
                                    <Text key={idx} style={[styles.damageMarker, { left: `${d.x}%`, top: `${d.y}%` }]}>X</Text>
                                ))}
                            </View>
                        </View>
                    </>
                )}

                {/* Tabla Remisiones */}
                <Text style={styles.boxTitle}>Remisiones de Combustible</Text>
                <View style={styles.tableWrap}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: "15%" }]}>Folio</Text>
                        <Text style={[styles.th, { width: "40%" }]}>Cliente</Text>
                        <Text style={[styles.th, { width: "25%" }]}>Matrícula</Text>
                        <Text style={[styles.th, { width: "20%", borderRightWidth: 0 }]}>Total Lts</Text>
                    </View>
                    {remisiones.length > 0 ? remisiones.map((r: any, idx: number) => (
                        <View key={idx} style={styles.tr}>
                            <Text style={[styles.td, { width: "15%" }]}>{r.folio}</Text>
                            <Text style={[styles.td, { width: "40%", textAlign: "left", paddingLeft: 4 }]}>{r.cliente}</Text>
                            <Text style={[styles.td, { width: "25%" }]}>{r.matricula}</Text>
                            <Text style={[styles.td, { width: "20%", borderRightWidth: 0, fontWeight: "bold" as any }]}>{r.total_litros}</Text>
                        </View>
                    )) : (
                        <View style={styles.tr}><Text style={[styles.td, { width: "100%", borderRightWidth: 0 }]}>No hay remisiones registradas</Text></View>
                    )}
                </View>

                {/* Balances */}
                <View style={styles.balanceBox}>
                    <View style={styles.balanceCard}><Text style={styles.label}>Total Vendido</Text><Text style={[styles.value, { color: GREEN }]}>{turno.totalVendidos || 0} L</Text></View>
                    <View style={styles.balanceCard}><Text style={styles.label}>Diferencia Final</Text><Text style={[styles.value, { color: "#dc2626" }]}>{turno.diferenciaFinal || 0} L</Text></View>
                </View>
            </Page>
        </Document>
    );
}

export default function PdfExporterAutotanque({ id, onDone }: { id: number | null; onDone: () => void }) {
    useEffect(() => {
        if (!id) return;
        const generatePdf = async () => {
            Swal.fire({ title: "Generando Reporte", text: "Espere un momento...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const response = await showAutotanque(id);
                if (!response?.data) throw new Error("Sin datos");
                const blob = await pdf(<AutotanquePdfDoc detalle={response} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Reporte_Autotanque_${id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                Swal.fire({ icon: "success", title: "PDF Generado", timer: 1500, showConfirmButton: false });
            } catch (e) {
                Swal.fire("Error", "No se pudo obtener la información", "error");
            } finally { onDone(); }
        };
        generatePdf();
    }, [id]);
    return null;
}
