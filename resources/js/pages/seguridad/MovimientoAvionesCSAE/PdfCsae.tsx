import { useEffect } from "react";
import { fetchShowMovimientoCSAE } from "@/stores/apiMovimientoCSAE";
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

    // --- ESTILOS MEJORADOS DE FIRMA ---
    signatureBox: {
        width: 180,
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: BORDER,
        paddingTop: 2,
        position: 'relative'
    },
    signatureImg: {
        width: 100,
        height: 50,
        marginBottom: -10, // Tira la imagen un poco hacia arriba de la línea
        zIndex: 10
    },
    signatureLabel: {
        fontSize: 7,
        fontWeight: "bold",
        textTransform: "uppercase",
        marginTop: 5,
        color: GRAY_TEXT
    }
});

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
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function MovimientoPdfDoc({ data, firmasBase64 }: { data: any, firmasBase64: any; }) {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    return (
        <Document title={`Movimiento_${data.matricula}`}>
            <Page size="A4" style={styles.page}>
                <Image src={watermarkUrl} style={{ position: "absolute", top: 150, left: 100, width: 400, opacity: 0.08, zIndex: -1 }} />

                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}><Text style={styles.headerLeftText}>EOLO</Text></View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Manifiesto de Movimiento de Aeronave</Text>
                        <Text style={styles.headerSub}>Folio Interno: #CSAE-{data.id} · Fecha: {new Date().toLocaleDateString('es-MX')}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Datos de la Aeronave</Text>
                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}><Text style={styles.infoLabel}>Matrícula</Text><Text style={styles.infoValue}>{data.matricula}</Text></View>
                    <View style={styles.infoItem}><Text style={styles.infoLabel}>Tipo</Text><Text style={styles.infoValue}>{data.tipo_aeronave}</Text></View>
                    <View style={[styles.infoItem, { borderRightWidth: 0 }]}><Text style={styles.infoLabel}>Transportista</Text><Text style={styles.infoValue}>{data.transportista || "N/A"}</Text></View>
                </View>

                <Text style={styles.sectionTitle}>Registro de Entrada</Text>
                <View style={styles.detailsBox}>
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Fecha/Hora:</Text><Text style={styles.detailsText}>{data.fecha_hora_entrada}</Text></View>
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Cómo llega:</Text><Text style={styles.detailsText}>{data.como_llega}</Text></View>
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Observaciones:</Text><Text style={styles.detailsText}>{data.observaciones_entrada || "Sin observaciones."}</Text></View>
                </View>

                <Text style={styles.sectionTitle}>Registro de Salida</Text>
                <View style={styles.detailsBox}>
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Fecha/Hora:</Text><Text style={styles.detailsText}>{data.fecha_hora_salida || "PENDIENTE"}</Text></View>
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Observaciones:</Text><Text style={styles.detailsText}>{data.observaciones_salida || "Sin observaciones."}</Text></View>
                </View>

                <View style={[styles.footer, { marginTop: 'auto' }]} wrap={false}>
                    <View style={styles.signatureBox}>
                        {firmasBase64.firma_entrada && (
                            <Image src={firmasBase64.firma_entrada} style={styles.signatureImg} />
                        )}
                        <Text style={styles.signatureLabel}>Firma de Entrada</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        {firmasBase64.firma_salida && (
                            <Image src={firmasBase64.firma_salida} style={styles.signatureImg} />
                        )}
                        <Text style={styles.signatureLabel}>Firma de Salida</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}

export default function PdfCsae({ id, onDone }: { id: number | null; onDone: () => void }) {
    useEffect(() => {
        if (!id) return;

        const generatePdf = async () => {
            Swal.fire({
                title: "Generando PDF",
                text: "Procesando firmas...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const response = await fetchShowMovimientoCSAE(id);
                const finalData = response?.data ? response.data : response;

                const fEntrada = getFirmaByRol(finalData, "firma_entrada");
                const fSalida = getFirmaByRol(finalData, "firma_salida");

                const firmasBase64 = {
                    firma_entrada: fEntrada?.url ? await urlToDataUrl(fEntrada.url) : null,
                    firma_salida: fSalida?.url ? await urlToDataUrl(fSalida.url) : null,
                };

                const blob = await pdf(<MovimientoPdfDoc firmasBase64={firmasBase64} data={finalData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Manifiesto_${finalData.matricula}.pdf`;
                a.click();
                URL.revokeObjectURL(url);

                Swal.fire({ icon: "success", title: "Descargado", timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error(e);
                Swal.fire("Error", "No se pudo generar el documento", "error");
            } finally {
                onDone();
            }
        };

        generatePdf();
    }, [id]);

    return null;
}
