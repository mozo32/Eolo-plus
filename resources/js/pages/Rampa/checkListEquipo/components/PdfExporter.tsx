import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { fetchCheckUser } from "@/stores/apiCheckListEquipoSeguridad";
import { useEffect } from "react";
import Swal from "sweetalert2";

const styles = StyleSheet.create({
    page: {
        padding: 0,
        fontSize: 10,
        fontFamily: 'Helvetica',
        backgroundColor: '#FFFFFF'
    },
    documentOuterFrame: {
        borderWidth: 8,
        borderStyle: 'solid',
        borderColor: '#FFFFFF',
        height: '100%',
        padding: 25,
    },

    watermark: {
        position: 'absolute',
        top: '30%',
        left: '10%',
        width: '80%',
        opacity: 0.08,
        zIndex: -1,
    },

    contentWrapper: {
        flexDirection: 'column',
    },

    headerFrame: {
        flexDirection: 'row',
        marginBottom: 25,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden'
    },

    headerLeftPanel: {
        flex: 1,
        backgroundColor: '#073B4C',
        padding: 20,
        justifyContent: 'center'
    },

    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4
    },

    headerInfoText: {
        color: '#FFFFFF',
        fontSize: 9,
        opacity: 0.8
    },

    headerRightPanel: {
        width: 130,
        backgroundColor: '#FFFFFF',
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
        borderLeftStyle: 'solid',
    },

    logo: {
        width: 60,
        height: 'auto'
    },

    table: { marginTop: 10, borderRadius: 8, overflow: 'hidden' },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        paddingVertical: 10,
        paddingHorizontal: 12
    },
    tableHeaderText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 9, textTransform: 'uppercase' },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        borderBottomStyle: 'solid',
        backgroundColor: 'transparent',
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'center'
    },
    rowAlternate: { backgroundColor: 'rgba(249, 250, 251, 0.5)' },
    col1: { flex: 3 },
    col2: { flex: 1, textAlign: 'right' },

    badge: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        fontSize: 8,
        textAlign: 'center',
        width: 70
    },
    badgeOk: { backgroundColor: '#D1FAE5', color: '#065F46' },
    badgeNo: { backgroundColor: '#FEE2E2', color: '#991B1B' },

    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        borderTopStyle: 'solid',
        paddingTop: 10,
        fontSize: 8,
        color: '#6B7280'
    }
});

const ElegantPdfDocument = ({ data }: { data: any }) => {
    const mesArr = Object.keys(data.checklist || {});
    const mes = mesArr.length > 0 ? mesArr[0] : 'N/A';
    const items = mes !== 'N/A' ? Object.entries(data.checklist[mes]) : [];

    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/Gemini_Generated_Image_y7xk1dy7xk1dy7xk.png`;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.documentOuterFrame}>
                    <Image src={watermarkUrl} style={styles.watermark} />

                    <View style={styles.contentWrapper}>
                        <View style={styles.headerFrame}>
                            <View style={styles.headerLeftPanel}>
                                <Text style={styles.title}>ENTREGA DE TURNO</Text>
                                <Text style={styles.headerInfoText}>Folio #{data.id} · Fecha {new Date(data.created_at).toLocaleDateString()}</Text>
                                <Text style={styles.headerInfoText}>Responsable: {data.nombre}</Text>
                            </View>

                            <View style={styles.headerRightPanel}>
                                <Image src={logoUrl} style={styles.logo} />
                            </View>
                        </View>

                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, styles.col1]}>Insumo de Seguridad</Text>
                                <Text style={[styles.tableHeaderText, styles.col2]}>Verificación</Text>
                            </View>

                            {items.map(([key, value]: [string, any], index: number) => (
                                <View key={key} style={[styles.tableRow, index % 2 === 1 ? styles.rowAlternate : {}]}>
                                    <Text style={styles.col1}>{key}</Text>
                                    <View style={styles.col2}>
                                        <Text style={[styles.badge, value ? styles.badgeOk : styles.badgeNo]}>
                                            {value ? 'VERIFICADO' : 'PENDIENTE'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={{ marginTop: 25, marginLeft: 10 }}>
                            <Text style={{ fontWeight: 'bold', color: '#073B4C', marginBottom: 4 }}>Observaciones Generales:</Text>
                            <Text style={{ color: '#4B5563', lineHeight: 1.4, fontSize: 9 }}>
                                {data.observaciones || "No se reportaron anomalías durante la inspección de seguridad."}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.footer}>
                        EOLO Plus - Registro Oficial de Seguridad Industrial (Generado Digitalmente)
                    </Text>
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
                link.download = `Checklist_Turno_${data.id}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                onDone();
            } catch (e: any) {
                console.error("Error al generar PDF:", e);
                Swal.fire("Error", "No se pudo procesar el reporte", "error");
                onDone();
            }
        };

        generateDownload();
    }, [id, onDone]);

    return null;
}
