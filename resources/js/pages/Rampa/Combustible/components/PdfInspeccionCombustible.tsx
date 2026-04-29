import { useEffect, useState } from "react";
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
    page: {
        padding: 30,
        fontSize: 9,
        color: "#111827",
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },
    headerWrap: {
        flexDirection: "row",
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 12,
    },
    headerLeft: {
        width: 100,
        backgroundColor: GREEN,
        color: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 15,
    },
    headerLeftText: {
        fontSize: 18,
        fontWeight: "bold" as any,
        letterSpacing: 2,
    },
    headerMid: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 15,
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
    },
    headerSub: {
        fontSize: 9,
        color: GRAY_TEXT,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: "bold" as any,
        backgroundColor: "#f3f4f6",
        padding: 4,
        borderWidth: 1,
        borderColor: BORDER,
        textTransform: "uppercase",
        marginTop: 15,
        marginBottom: 5,
    },
    evidenceGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 5,
    },
    evidenceCard: {
        width: "48%",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 8,
        borderRadius: 4,
    },
    evidenceImg: {
        width: "100%",
        height: 120,
        objectFit: "cover",
        marginBottom: 5,
        borderRadius: 2,
    },
    badge: {
        fontSize: 7,
        fontWeight: "bold" as any,
        padding: 2,
        borderRadius: 2,
        textTransform: "uppercase",
        textAlign: "center",
        marginBottom: 4,
    },
    label: {
        fontSize: 7,
        color: GRAY_TEXT,
        textTransform: "uppercase",
        marginBottom: 1,
    },
    value: {
        fontSize: 9,
        fontWeight: "bold" as any,
    },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 30,
        right: 30,
        borderTopWidth: 1,
        borderColor: "#e5e7eb",
        paddingTop: 5,
        textAlign: "center",
        color: GRAY_TEXT,
        fontSize: 7,
    }
});

function InspeccionPdfDoc({ data }: { data: any }) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerLeftText}>EOLO</Text>
                    </View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Inspección de Combustible</Text>
                        <Text style={styles.headerSub}>ID Registro: #{data.id} | Fecha: {data.fecha}</Text>
                    </View>
                </View>

                {/* Detalles del Registro */}
                <Text style={styles.sectionTitle}>Detalles del Registro</Text>
                <View style={{ flexDirection: "row", marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Inspector (Usuario ID)</Text>
                        <Text style={styles.value}>{data.usuario_id}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Fecha y Hora de Captura</Text>
                        <Text style={styles.value}>{data.fecha}</Text>
                    </View>
                </View>

                {/* Evidencias Fotográficas */}
                <Text style={styles.sectionTitle}>Evidencias Fotográficas (Shell / Hydrokit)</Text>
                <View style={styles.evidenceGrid}>
                    {data.evidencias?.map((ev: any, index: number) => {
                        // LÓGICA DENTRO DEL MAP:
                        // Separamos el path y reconstruimos la URL con el origin actual
                        const pathRelativo = ev.url.split('/storage/')[1];
                        const urlLimpia = `${window.location.origin}/storage/${pathRelativo}`;
                        console.log('Prueba:', urlLimpia);

                        // Retornamos el View explícitamente
                        return (
                            <View key={index} style={styles.evidenceCard}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                                    <Text style={[styles.badge, {
                                        backgroundColor: ev.modulo === 'SHELL' ? '#fef3c7' : '#dbeafe',
                                        color: ev.modulo === 'SHELL' ? '#92400e' : '#1e40af'
                                    }]}>
                                        {ev.modulo}
                                    </Text>
                                    {ev.alerta && (
                                        <Text style={[styles.badge, { backgroundColor: '#fee2e2', color: RED_ALERTA }]}>
                                            ALERTA
                                        </Text>
                                    )}
                                </View>

                                {/* USA ev.url DIRECTAMENTE (Trae el Base64) */}
                                <Image src={ev.url} style={styles.evidenceImg} />

                                <Text style={styles.label}>Observación:</Text>
                                <Text style={[styles.value, { color: ev.alerta ? RED_ALERTA : '#111827' }]}>
                                    {ev.observacion || "Sin observaciones registradas."}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Documento generado por el Sistema de Gestión EOLO - {new Date().toLocaleString()}
                </Text>
            </Page>
        </Document>
    );
}

type Props = { id: number | null; onDone: () => void };

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

                if (!data) throw new Error("No se encontraron datos");

                const getBase64 = async (url: string) => {
                    // Añadimos { mode: 'cors' } para que el navegador permita la lectura
                    const res = await fetch(url, { mode: 'cors' });
                    const blob = await res.blob();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                };

                // Convertimos todas las evidencias a Base64 antes de pasarlas al PDF
                const evidenciasBase64 = await Promise.all(
                    data.evidencias.map(async (ev: any) => {
                        try {
                            const b64 = await getBase64(ev.url);
                            return { ...ev, url: b64 };
                        } catch (e) {
                            console.error("Error convirtiendo imagen:", ev.url);
                            return ev;
                        }
                    })
                );

                const dataFinal = { ...data, evidencias: evidenciasBase64 };

                const blobPdf = await pdf(<InspeccionPdfDoc data={dataFinal} />).toBlob();
                const urlPdf = URL.createObjectURL(blobPdf);

                const a = document.createElement("a");
                a.href = urlPdf;
                a.download = `Inspeccion_${id}.pdf`;
                a.click();

                URL.revokeObjectURL(urlPdf);
                Swal.fire({ icon: "success", title: "Reporte Generado", timer: 1500, showConfirmButton: false });

            } catch (error) {
                console.error(error);
                Swal.fire("Error", "Error de seguridad (CORS). Verifique la configuración del servidor.", "error");
            } finally {
                onDone();
            }
        };

        generarPdf();
    }, [id]);

    return null;
}
