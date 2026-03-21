import { useEffect } from "react";
import { fetchShowCheckListTurno } from "@/stores/apiCheckListTurno";
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

const styles = StyleSheet.create({
    page: { padding: 25, fontSize: 8, color: "#111827", fontFamily: "Helvetica", backgroundColor: "#ffffff" },
    headerWrap: { flexDirection: "row", borderWidth: 2, borderColor: BORDER, marginBottom: 10 },
    headerLeft: { width: 95, backgroundColor: GREEN, color: "#ffffff", justifyContent: "center", alignItems: "center", paddingVertical: 10 },
    headerLeftText: { fontSize: 16, fontWeight: 900 as any, letterSpacing: 4 },
    headerMid: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, justifyContent: "center" },
    headerTitle: { fontSize: 11, fontWeight: 900 as any, textTransform: "uppercase", marginBottom: 2 },
    headerSub: { fontSize: 8, color: GRAY_TEXT },

    sectionTitle: { fontSize: 9, fontWeight: 900 as any, textTransform: "uppercase", color: GREEN, marginBottom: 4, marginTop: 10, borderBottomWidth: 1, borderBottomColor: GREEN, paddingBottom: 2 },

    gridContainer: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: BORDER, marginBottom: 5 },
    gridItem: { width: "25%", padding: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BORDER, flexDirection: "row", alignItems: "center", gap: 4 },
    gridLabel: { fontSize: 7, color: "#4B5563", flex: 1, textTransform: "uppercase" },
    gridStatus: { fontSize: 8, fontWeight: "bold" },

    tableWrap: { borderWidth: 1, borderColor: BORDER, marginTop: 5 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderColor: BORDER },
    th: { padding: 4, fontSize: 7, fontWeight: "bold", borderRightWidth: 1, borderColor: BORDER, textAlign: "center", textTransform: "uppercase" },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER },
    td: { padding: 4, fontSize: 7, borderRightWidth: 1, borderColor: BORDER, textAlign: "center" },

    observationsBox: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: BORDER, backgroundColor: "#f9fafb" },
    obsLabel: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", marginBottom: 2 },
    obsText: { fontSize: 8, color: "#374151" },

    footer: { marginTop: 20, flexDirection: "row", justifyContent: "space-around" },
    signatureBox: { width: 150, alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5 },
    signatureImg: { width: 100, height: 50, marginBottom: 5 }
});

function ChecklistPdfDoc({ data }: { data: any }) {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    const renderCheckGroup = (title: string, obj: any) => (
        <View style={{ marginBottom: 5 }} wrap={false}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.gridContainer}>
                {Object.keys(obj).map((key) => (
                    <View key={key} style={styles.gridItem}>
                        <Text style={styles.gridLabel}>{key.replace(/_/g, ' ')}</Text>
                        <Text style={[styles.gridStatus, { color: obj[key] ? "#059669" : "#DC2626" }]}>
                            {obj[key] ? "SI" : "NO"}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Image src={watermarkUrl} style={{ position: "absolute", top: 150, left: 100, width: 400, opacity: 0.1, zIndex: -1 }} />

                {/* Header */}
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}><Text style={styles.headerLeftText}>EOLO</Text></View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Checklist de Entrega de Turno</Text>
                        <Text style={styles.headerSub}>Folio: #{data.id} · Fecha: {new Date(data.fecha).toLocaleString('es-MX')}</Text>
                        <Text style={styles.headerSub}>Responsable: {data.nombre_empleado}</Text>
                    </View>
                </View>

                {/* Métricas Principales */}
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 5 }}>
                    <View style={{ flex: 1, borderWidth: 1, borderColor: BORDER, padding: 5, alignItems: 'center' }}>
                        <Text style={styles.gridLabel}>OPERACIONES</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{data.cantidad_operaciones}</Text>
                    </View>
                    <View style={{ flex: 1, borderWidth: 1, borderColor: BORDER, padding: 5, alignItems: 'center' }}>
                        <Text style={styles.gridLabel}>PASAJEROS</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{data.cantidad_pasajeros}</Text>
                    </View>
                </View>

                {/* Tareas de Cumplimiento General */}
                <Text style={styles.sectionTitle}>Cumplimiento de Obligaciones</Text>
                <View style={[styles.gridContainer, { marginBottom: 10 }]}>
                    <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>Revisión Base Op.</Text>
                        <Text style={[styles.gridStatus, { color: data.revision_base_operaciones ? "#059669" : "#DC2626" }]}>
                            {data.revision_base_operaciones ? "SI" : "NO"}
                        </Text>
                    </View>
                    <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>Informe Diario</Text>
                        <Text style={[styles.gridStatus, { color: data.envia_informe_diario ? "#059669" : "#DC2626" }]}>
                            {data.envia_informe_diario ? "SI" : "NO"}
                        </Text>
                    </View>
                    <View style={[styles.gridItem, { width: "50%", borderRightWidth: 0 }]}>
                        <Text style={styles.gridLabel}>Resumen Semanal</Text>
                        <Text style={[styles.gridStatus, { color: data.envia_resumen_semanal ? "#059669" : "#DC2626" }]}>
                            {data.envia_resumen_semanal ? "SI" : "NO"}
                        </Text>
                    </View>
                </View>

                {renderCheckGroup("Recepción de Turno", data.recibe_turno_con)}

                {/* Revisión de Salas */}
                <View wrap={false}>
                    <Text style={styles.sectionTitle}>Revisión de Salas / Aulas</Text>
                    <View style={styles.tableWrap}>
                        <View style={styles.tableHeader}> {/* Antes decía <div> */}
                            <Text style={[styles.th, { width: "60%" }]}>Ubicación</Text>
                            <Text style={[styles.th, { width: "40%", borderRightWidth: 0 }]}>Horarios Revisados</Text>
                        </View>
                        {Object.entries(data.revision_salas).map(([sala, horarios]: any, idx) => (
                            <View key={idx} style={styles.tr}>
                                <Text style={[styles.td, { width: "60%", textAlign: "left" }]}>{sala.replace(/_/g, ' ').toUpperCase()}</Text>
                                <Text style={[styles.td, { width: "40%", borderRightWidth: 0 }]}>
                                    {Object.keys(horarios).join(", ")}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Tabla de Hotelería / Traslados (Si tiene datos) */}
                {data.hot_tras_comi_coor && data.hot_tras_comi_coor.length > 0 && (
                    <View wrap={false}>
                        <Text style={styles.sectionTitle}>Hotelería, Traslados y Comidas</Text>
                        <View style={styles.tableWrap}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.th, { width: "20%" }]}>Matrícula</Text>
                                <Text style={[styles.th, { width: "30%" }]}>Descripción</Text>
                                <Text style={[styles.th, { width: "25%" }]}>Fecha / Hora</Text>
                                <Text style={[styles.th, { width: "25%", borderRightWidth: 0 }]}>Notas</Text>
                            </View>
                            {data.hot_tras_comi_coor.map((item: any, idx: number) => (
                                <View key={idx} style={styles.tr}>
                                    <Text style={[styles.td, { width: "20%" }]}>{item.matricula || "N/A"}</Text>
                                    <Text style={[styles.td, { width: "30%" }]}>{item.descripcion || "-"}</Text>
                                    <Text style={[styles.td, { width: "25%" }]}>{`${item.fecha} ${item.hora}`}</Text>
                                    <Text style={[styles.td, { width: "25%", borderRightWidth: 0 }]}>{item.notas || "Sin notas"}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {renderCheckGroup("Entrega de Turno", data.entrega_turno_con)}

                {/* Observaciones */}
                <View wrap={false} style={styles.observationsBox}>
                    <Text style={styles.obsLabel}>Observaciones de Turno</Text>
                    <Text style={styles.obsText}>
                        {data.observaciones_recibe ? `AL RECIBIR: ${data.observaciones_recibe}` : "SIN OBSERVACIONES AL RECIBIR."}
                    </Text>
                    <Text style={[styles.obsText, { marginTop: 4 }]}>
                        {data.observaciones_entrega ? `AL ENTREGAR: ${data.observaciones_entrega}` : "SIN OBSERVACIONES AL ENTREGAR."}
                    </Text>
                </View>

                {/* Firmas */}
                <View style={[styles.footer, { marginTop: 'auto' }]} wrap={false}>
                    {data.firmas.map((f: any) => (
                        <View key={f.id} style={styles.signatureBox}>
                            <Image src={f.url} style={styles.signatureImg} />
                            <Text style={styles.gridLabel}>{f.tag}</Text>
                            <Text style={{ fontSize: 7, fontWeight: 'bold' }}>{data.nombre_empleado.toUpperCase()}</Text>
                        </View>
                    ))}
                </View>
            </Page>
        </Document>
    );
}

type Props = { id: number | null; onDone: () => void };

export default function PdfExporterTurno({ id, onDone }: Props) {
    useEffect(() => {
        if (!id) return;

        const generatePdf = async () => {
            Swal.fire({
                title: "Generando Reporte",
                text: "Esto puede tardar unos segundos...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const data = await fetchShowCheckListTurno(id);
                // Si la API devuelve un objeto con .data, ajustamos:
                const finalData = data?.data ? data.data : data;

                const blob = await pdf(<ChecklistPdfDoc data={finalData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Checklist_Turno_${id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);

                Swal.fire({ icon: "success", title: "Descarga iniciada", timer: 1500, showConfirmButton: false });
            } catch (e: any) {
                console.error(e);
                Swal.fire("Error", "No se pudo obtener la información del turno", "error");
            } finally {
                onDone();
            }
        };

        generatePdf();
    }, [id]);

    return null;
}
