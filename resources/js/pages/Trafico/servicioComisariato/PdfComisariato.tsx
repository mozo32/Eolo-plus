import { useEffect } from "react";
import { fetchShowServicioComisariato } from "@/stores/apiServicioComisariato";
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
    page: { padding: 30, fontSize: 8, color: "#111827", fontFamily: "Helvetica", backgroundColor: "#ffffff" },
    headerWrap: { flexDirection: "row", borderWidth: 2, borderColor: BORDER, marginBottom: 15 },
    headerLeft: { width: 95, backgroundColor: GREEN, color: "#ffffff", justifyContent: "center", alignItems: "center", paddingVertical: 10 },
    headerLeftText: { fontSize: 16, fontWeight: 900 as any, letterSpacing: 4 },
    headerMid: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, justifyContent: "center" },
    headerTitle: { fontSize: 12, fontWeight: 900 as any, textTransform: "uppercase", marginBottom: 2 },
    headerSub: { fontSize: 8, color: GRAY_TEXT },
    sectionTitle: { fontSize: 9, fontWeight: 900 as any, textTransform: "uppercase", color: GREEN, marginBottom: 6, marginTop: 12, borderBottomWidth: 1, borderBottomColor: GREEN, paddingBottom: 2 },
    infoGrid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: BORDER, marginBottom: 10 },
    infoItem: { width: "33.33%", padding: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BORDER },
    infoLabel: { fontSize: 6, color: "#6B7280", textTransform: "uppercase", marginBottom: 2, fontWeight: "bold" },
    infoValue: { fontSize: 9, fontWeight: "bold", color: "#111827" },
    detailsBox: { marginTop: 5, padding: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: "#f9fafb" },
    detailsRow: { flexDirection: "row", marginBottom: 4 },
    detailsLabel: { width: 100, fontSize: 7, fontWeight: "bold", textTransform: "uppercase" },
    detailsText: { flex: 1, fontSize: 8, color: GRAY_TEXT },
    footer: { marginTop: 30, flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
    signatureBox: { width: 180, alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 2, position: 'relative' },
    signatureImg: { width: 100, height: 50, marginBottom: -10, zIndex: 10 },
    signatureLabel: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", marginTop: 5, color: GRAY_TEXT },
    totalSection: { marginTop: 10, alignItems: 'flex-end', paddingRight: 10 },
    totalLabel: { fontSize: 8, color: GRAY_TEXT },
    totalValue: { fontSize: 12, fontWeight: "bold", color: GREEN }
});

// Función para manejar CORS si las firmas vienen de la API
async function urlToDataUrl(url: string): Promise<string> {
    try {
        const u = new URL(url);
        const sameOriginUrl = `${window.location.origin}${u.pathname}`;
        const res = await fetch(sameOriginUrl, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return url; // Si falla, intenta usar la original
    }
}

function ComisariatoPdfDoc({ data }: { data: any }) {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    return (
        <Document title={`Comisariato_${data.matricula}`}>
            <Page size="A4" style={styles.page}>
                <Image src={watermarkUrl} style={{ position: "absolute", top: 150, left: 100, width: 400, opacity: 0.08, zIndex: -1 }} />

                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}><Text style={styles.headerLeftText}>EOLO</Text></View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Recibo de Servicio de Comisariato</Text>
                        <Text style={styles.headerSub}>Folio Interno: #COM-{data.id} · Fecha: {new Date(data.fecha_entrega).toLocaleDateString('es-MX')}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Información General</Text>
                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}><Text style={styles.infoLabel}>Matrícula</Text><Text style={styles.infoValue}>{data.matricula}</Text></View>
                    <View style={styles.infoItem}><Text style={styles.infoLabel}>Catering</Text><Text style={styles.infoValue}>{data.catering}</Text></View>
                    <View style={[styles.infoItem, { borderRightWidth: 0 }]}><Text style={styles.infoLabel}>Forma de Pago</Text><Text style={styles.infoValue}>{data.forma_pago}</Text></View>
                    <View style={styles.infoItem}><Text style={styles.infoLabel}>Hora Entrega</Text><Text style={styles.infoValue}>{data.hora_entrega} hrs</Text></View>
                    <View style={styles.infoItem}><Text style={styles.infoLabel}>Solicitado Por</Text><Text style={styles.infoValue}>{data.solicitado_por}</Text></View>
                    <View style={[styles.infoItem, { borderRightWidth: 0, borderBottomWidth: 1 }]}><Text style={styles.infoLabel}>Atendió</Text><Text style={styles.infoValue}>{data.atendio}</Text></View>
                </View>

                <Text style={styles.sectionTitle}>Detalles del Servicio</Text>
                <View style={styles.detailsBox}>
                    <View style={styles.detailsRow}>
                        <Text style={styles.detailsText}>{data.detalle || "No se especificaron detalles del servicio."}</Text>
                    </View>
                </View>

                <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Subtotal: ${data.subtotal}</Text>
                    <Text style={styles.totalValue}>Total: ${data.total}</Text>
                </View>

                <View style={[styles.footer, { marginTop: 'auto' }]} wrap={false}>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Firma de Conformidad</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Sello / Firma FBO</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}

export default function PdfComisariato({ id, onDone }: { id: number | null; onDone: () => void }) {
    useEffect(() => {
        if (!id) return;

        const generatePdf = async () => {
            Swal.fire({
                title: "Generando Documento",
                text: "Preparando recibo de comisariato...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const response = await fetchShowServicioComisariato(id);
                // Si la respuesta viene anidada en data, la extraemos
                const finalData = response?.data ? response.data : response;

                const blob = await pdf(<ComisariatoPdfDoc data={finalData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Comisariato_${finalData.matricula}_${finalData.id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);

                Swal.fire({ icon: "success", title: "Recibo Descargado", timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error(e);
                Swal.fire("Error", "No se pudo generar el PDF", "error");
            } finally {
                onDone();
            }
        };

        generatePdf();
    }, [id]);

    return null;
}
