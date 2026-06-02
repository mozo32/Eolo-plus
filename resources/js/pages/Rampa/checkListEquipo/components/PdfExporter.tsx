import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { fetchCheckUser } from "@/stores/apiCheckListEquipoSeguridad";
import { useEffect } from "react";
import Swal from "sweetalert2";

// Configuración de colores institucional (Eolo Plus)
const GREEN_INST = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";

const styles = StyleSheet.create({
    page: {
        paddingTop: 30,
        paddingBottom: 60,
        paddingHorizontal: 30,
        fontSize: 9,
        color: "#111827",
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },
    watermark: {
        position: "absolute",
        top: 180,
        left: 50,
        width: 500,
        height: 500,
        opacity: 0.04,
        zIndex: -1
    },
    headerWrap: {
        flexDirection: "row",
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 12,
    },
    headerLeft: {
        width: 140,
        justifyContent: "center",
        alignItems: "center",
        padding: 5,
    },
    headerLogo: {
        width: "100%",
        height: 45,
        objectFit: "contain",
    },
    headerMid: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 15,
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: "bold",
        textTransform: "uppercase",
    },
    headerSub: {
        fontSize: 9,
        color: GRAY_TEXT,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: "bold",
        backgroundColor: "#f3f4f6",
        padding: 4,
        borderWidth: 1,
        borderColor: BORDER,
        textTransform: "uppercase",
        marginTop: 10,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    col2: {
        width: "50%",
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6
    },
    label: {
        fontSize: 7,
        color: GRAY_TEXT,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    value: {
        fontSize: 10,
        fontWeight: "bold",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f9fafb",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    headerCell: {
        fontSize: 7,
        fontWeight: "bold",
        padding: 5,
        borderRightWidth: 1,
        borderColor: BORDER,
        textTransform: "uppercase",
    },
    row: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    cell: {
        fontSize: 8,
        padding: 5,
        borderRightWidth: 1,
        borderColor: BORDER,
    },
    badgeOk: {
        color: '#065F46',
        fontWeight: 'bold',
    },
    badgeNo: {
        color: '#991B1B',
        fontWeight: 'bold',
    },
    observacionesContainer: {
        left: 0,
        right: 0,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
        padding: 8,
        minHeight: 60
    },
    footerInfo: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        fontSize: 7,
        color: GRAY_TEXT,
        textAlign: 'center'
    }
});

const ElegantPdfDocument = ({ data }: { data: any }) => {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    const mesArr = Object.keys(data.checklist || {});
    const mesActual = mesArr.length > 0 ? mesArr[0] : 'N/A';
    const items = mesActual !== 'N/A' ? Object.entries(data.checklist[mesActual]) : [];

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* MARCA DE AGUA */}
                <Image src={watermarkUrl} style={styles.watermark} />

                {/* HEADER INSTITUCIONAL */}
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Image src={logoUrl} style={styles.headerLogo} />
                    </View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Control de Activos EPP - Rampa</Text>
                        <Text style={styles.headerSub}>ID Registro: {data.id} | Periodo Auditado: {mesActual.toUpperCase()} 2026</Text>
                    </View>
                </View>

                {/* INFORMACIÓN DEL TURNO */}
                <Text style={styles.sectionTitle}>Información del Trabajador</Text>
                <View style={styles.grid}>
                    <View style={styles.col2}>
                        <Text style={styles.label}>Empleado</Text>
                        <Text style={[styles.value, { textTransform: 'uppercase' }]}>{data.nombre}</Text>
                    </View>
                    <View style={styles.col2}>
                        <Text style={styles.label}>Fecha de Inspección</Text>
                        <Text style={styles.value}>
                            {data.created_at ? new Date(data.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                        </Text>
                    </View>
                </View>

                {/* TABLA RESTRUCTURADA DE EQUIPOS */}
                <Text style={styles.sectionTitle}>Listado e Inspección de Seguridad</Text>
                <View style={{ borderLeftWidth: 1, borderTopWidth: 1, borderColor: BORDER }}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { width: '40%' }]}>Insumo de Seguridad</Text>
                        <Text style={[styles.headerCell, { width: '25%' }]}>Estatus Asignación</Text>
                        <Text style={[styles.headerCell, { flex: 1, borderRightWidth: 0 }]}>Condición / Desgaste</Text>
                    </View>

                    {items.map(([key, item]: [string, any]) => (
                        <View key={key} style={styles.row}>
                            <Text style={[styles.cell, { width: '40%', fontWeight: 'bold', textTransform: 'uppercase' }]}>
                                {key}
                            </Text>
                            <Text style={[styles.cell, { width: '25%' }, item.tiene ? styles.badgeOk : styles.badgeNo]}>
                                {item.tiene ? '✓ PORTA EQUIPO' : '✗ NO ENTREGO / NO PORTA'}
                            </Text>
                            <Text style={[styles.cell, { flex: 1, borderRightWidth: 0, color: item.estado === 'Mal Estado' ? '#ef4444' : '#111827', fontWeight: item.estado === 'Mal Estado' ? 'bold' : 'normal' }]}>
                                {item.tiene ? (item.estado || 'Buen Estado') : '—'}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* SECCIÓN DE OBSERVACIONES */}
                <Text style={styles.sectionTitle}>Hallazgos Especiales y Observaciones</Text>
                <View style={styles.observacionesContainer} wrap={false}>
                    <Text style={{ fontSize: 9, color: '#374151', lineHeight: 1.4 }}>
                        {data.observaciones || "No se reportaron anomalías ni faltantes de equipo de protección personal durante esta auditoría mensual."}
                    </Text>
                </View>

                {/* PIE DE PÁGINA */}
                <View style={styles.footerInfo}>
                    <Text>Este documento es propiedad de Eolo Plus S.A. de C.V. - Registro Oficial de Seguridad Industrial Generado Digitalmente.</Text>
                    <Text style={{ marginTop: 2 }}>Copia Autenticada de Sistema Oficial | Fecha de Impresión: {new Date().toLocaleString()}</Text>
                </View>
            </Page>
        </Document>
    );
};

type Props = { id: number | null; onDone: () => void };
export default function PdfExporter({ id, onDone }: Props) {
    useEffect(() => {
        if (!id) return;

        const generateDownload = async () => {
            try {
                const response = await fetchCheckUser(id);
                const data = response.data || response;

                const doc = <ElegantPdfDocument data={data} />;
                const blob = await pdf(doc).toBlob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');

                link.href = url;
                link.download = `Checklist_EPP_${data.nombre.replace(/\s+/g, '_')}_${data.id}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                onDone();
            } catch (e: any) {
                console.error("Error al generar PDF:", e);
                Swal.fire("Error", "No se pudo procesar el reporte de activos", "error");
                onDone();
            }
        };

        generateDownload();
    }, [id, onDone]);

    return null;
}
