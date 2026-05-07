import { useEffect } from "react";
import { fetchRemisionById } from "@/stores/apiAutoTanque";
import Swal from "sweetalert2";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
    Image,
    Link,
    Svg,
    Path
} from "@react-pdf/renderer";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";

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
        marginTop: 10,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    col: {
        width: "50%",
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6,
    },
    col3: {
        width: "33.33%",
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6,
    },
    label: {
        fontSize: 7,
        color: GRAY_TEXT,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    value: {
        fontSize: 10,
        fontWeight: "bold" as any,
    },
    signatureSection: {
        flexDirection: "row",
        marginTop: 30,
        justifyContent: "space-around",
    },
    signatureBox: {
        width: "40%",
        alignItems: "center",
        borderTopWidth: 1,
        borderColor: BORDER,
        paddingTop: 5,
    },
    signatureImg: {
        width: 120,
        height: 60,
        marginBottom: 5,
    },
    disclaimerBox: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 8,
        flexDirection: 'row',
    },
    disclaimerIcon: {
        width: 14,
        height: 14,
        marginRight: 8,
        marginTop: 2,
    },
    disclaimerTextCol: {
        flex: 1,
    },
    disclaimerText: {
        fontSize: 8,
        color: '#64748b',
        lineHeight: 1.4,
        marginBottom: 4,
    },
    boldText: {
        fontWeight: 'bold' as any,
        color: '#334155',
    },
    linkText: {
        color: '#2563eb',
        textDecoration: 'none',
        fontWeight: 'bold' as any,
    }
});

function Watermark({ src }: { src: string }) {
    return (
        <Image
            src={src}
            style={{
                position: "absolute",
                top: 180,
                left: 50,
                width: 500,
                height: 500,
                opacity: 0.1,
                zIndex: -1,
            }}
        />
    );
}

function RemisionPdfDoc({ data }: { data: any }) {
    const getFirmaUrl = (path: string) => `${window.location.origin}/storage/${path}`;
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    const firmaCliente = data.firmas?.find((f: any) => f.pivot.rol === "cliente");
    const firmaOperador = data.firmas?.find((f: any) => f.pivot.rol === "operador");

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />
                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Image src={logoUrl} style={styles.headerLogo} />
                    </View>
                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Remisión de Suministro</Text>
                        <Text style={styles.headerSub}>Folio: {data.folio} | Fecha: {data.fecha}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Información General</Text>
                <View style={styles.grid}>
                    <View style={styles.col}><Text style={styles.label}>Cliente</Text><Text style={styles.value}>{data.cliente}</Text></View>
                    <View style={styles.col}><Text style={styles.label}>Unidad / Pipa</Text><Text style={styles.value}>{data.unidad}</Text></View>
                    <View style={styles.col}><Text style={styles.label}>Operador</Text><Text style={styles.value}>{data.operador}</Text></View>
                    <View style={styles.col}><Text style={styles.label}>Producto</Text><Text style={styles.value}>{data.producto}</Text></View>
                </View>

                <Text style={styles.sectionTitle}>Detalles de la Aeronave y Servicio</Text>
                <View style={styles.grid}>
                    <View style={styles.col3}><Text style={styles.label}>Matrícula</Text><Text style={styles.value}>{data.matricula}</Text></View>
                    <View style={styles.col3}><Text style={styles.label}>Tipo de Aeronave</Text><Text style={styles.value}>{data.aeronave_tipo}</Text></View>
                    <View style={styles.col3}><Text style={styles.label}>Destino</Text><Text style={styles.value}>{data.destino}</Text></View>

                    <View style={styles.col3}><Text style={styles.label}>Hora Llegada</Text><Text style={styles.value}>{data.hora_llegada}</Text></View>
                    <View style={styles.col3}><Text style={styles.label}>Hora Inicial</Text><Text style={styles.value}>{data.hora_inicial}</Text></View>
                    <View style={styles.col3}><Text style={styles.label}>Hora Final</Text><Text style={styles.value}>{data.hora_final}</Text></View>
                </View>

                <Text style={styles.sectionTitle}>Lecturas del Contador</Text>
                <View style={styles.grid}>
                    <View style={styles.col3}>
                        <Text style={styles.label}>Lectura Inicial</Text>
                        <Text style={styles.value}>
                            {Number(data.lectura_inicial || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} L
                        </Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Lectura Final</Text>
                        <Text style={styles.value}>
                            {Number(data.lectura_final || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} L
                        </Text>
                    </View>

                    <View style={[styles.col3, { backgroundColor: "#e5e7eb" }]}>
                        <Text style={styles.label}>Total Suministrado</Text>
                        <Text style={[styles.value, { color: GREEN, fontSize: 12 }]}>
                            {Number(data.total_litros || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} L
                        </Text>
                    </View>

                    <View style={styles.col}><Text style={styles.label}>Presión Diferencial</Text><Text style={styles.value}>{data.presionDif} PSI</Text></View>
                    <View style={styles.col}><Text style={styles.label}>Forma de Pago</Text><Text style={styles.value}>{data.forma_pago}</Text></View>
                </View>

                <View style={styles.signatureSection}>
                    <View style={styles.signatureBox}>
                        {firmaOperador && <Image src={getFirmaUrl(firmaOperador.path)} style={styles.signatureImg} />}
                        <Text style={styles.label}>Firma del Operador</Text>
                        <Text style={{ fontSize: 8 }}>{data.operador}</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        {firmaCliente && <Image src={getFirmaUrl(firmaCliente.path)} style={styles.signatureImg} />}
                        <Text style={styles.label}>Firma del Cliente</Text>
                        <Text style={{ fontSize: 8 }}>{data.cliente}</Text>
                    </View>
                </View>

                <View style={styles.disclaimerBox}>
                    <View style={styles.disclaimerIcon}>
                        <Svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
                            <Path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </Svg>
                    </View>
                    <View style={styles.disclaimerTextCol}>
                        <Text style={styles.disclaimerText}>
                            Acepto ser el representante del cliente y aeronave descrita, por lo que me obligo a pagar a <Text style={styles.boldText}>Eolo Plus S.A. de C.V.</Text> el importe total que se haya generado por este servicio.
                        </Text>
                        <Text style={styles.disclaimerText}>
                            Aclaraciones y quejas: <Link src="mailto:sales@eolo.com.mx" style={styles.linkText}>sales@eolo.com.mx</Link>
                        </Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}

type Props = { id: number | null; onDone: () => void };

export default function PdfExporterRemision({ id, onDone }: Props) {
    useEffect(() => {
        if (!id) return;

        const generarPdfRemision = async () => {
            Swal.fire({
                title: "Generando Remisión",
                text: "Preparando documento PDF...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const response = await fetchRemisionById(id);
                const datosRemision = response?.data || response;

                if (!datosRemision) throw new Error("No se encontraron datos");

                const blob = await pdf(<RemisionPdfDoc data={datosRemision} />).toBlob();
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = `Remision_${datosRemision.folio || id}.pdf`;
                a.click();

                URL.revokeObjectURL(url);
                Swal.fire({ icon: "success", title: "PDF Descargado", timer: 1500, showConfirmButton: false });
            } catch (error) {
                console.error(error);
                Swal.fire("Error", "No se pudo generar el PDF de la remisión", "error");
            } finally {
                onDone();
            }
        };

        generarPdfRemision();
    }, [id]);

    return null;
}
