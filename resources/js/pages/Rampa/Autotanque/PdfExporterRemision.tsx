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
    Path,
    Rect,
    G,
    Line
} from "@react-pdf/renderer";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";
const RED = "#dc2626";

const formatLitros = (value: any) => {
    const number = Number(value || 0);

    return number.toLocaleString("en-US", {
        maximumFractionDigits: 0,
    });
};

const styles = StyleSheet.create({
    page: {
        paddingTop: 30,
        paddingBottom: 80,
        paddingHorizontal: 30,
        fontSize: 9,
        color: "#111827",
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },
    watermark: {
        position: "absolute",
        top: 180,
        left: 90,
        width: 390,
        opacity: 0.05,
        zIndex: -1,
        objectFit: "contain",
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
    folioText: {
        color: RED,
        fontWeight: "bold" as any,
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
    matriculaValue: {
        fontSize: 14,
        fontWeight: "bold" as any,
        color: GREEN,
    },
    gaugeSection: {
        flexDirection: "row",
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderRightWidth: 1,
        borderColor: BORDER,
        minHeight: 220,
    },

    gaugeInfoCol: {
        flex: 1,
        borderRightWidth: 1,
        borderColor: BORDER,
        minHeight: 220,
        flexDirection: "column",
    },

    gaugeVisualCol: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        minHeight: 220,
    },

    infoBox: {
        padding: 6,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },

    totalBox: {
        flexGrow: 1,
        backgroundColor: "#f1f5f9",
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 8,
        justifyContent: "flex-start",
    },

    totalValue: {
        color: GREEN,
        fontSize: 20,
        fontWeight: "bold" as any,
        marginTop: 5,
    },

    signatureSection: {
        flexDirection: "row",
        marginTop: 30,
        justifyContent: "space-around",
    },
    signatureBox: {
        width: "40%",
        alignItems: "center",
    },
    signatureImg: {
        width: 120,
        height: 60,
        marginBottom: 8,
        objectFit: "contain",
    },
    signatureImgSpace: {
        width: 120,
        height: 60,
        marginBottom: 8,
    },
    signatureLineBox: {
        width: "100%",
        borderTopWidth: 1,
        borderColor: BORDER,
        paddingTop: 5,
        alignItems: "center",
    },
    signatureName: {
        fontSize: 8,
    },
    disclaimerBox: {
        position: "absolute",
        bottom: 30,
        left: 30,
        right: 30,
        padding: 8,
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#f1f5f9",
        borderRadius: 8,
        flexDirection: "row",
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
        color: "#64748b",
        lineHeight: 1.4,
        marginBottom: 4,
    },
    boldText: {
        fontWeight: "bold" as any,
        color: "#334155",
    },
    linkText: {
        color: "#2563eb",
        textDecoration: "none",
        fontWeight: "bold" as any,
    }
});

function PressureGaugePdf({ value }: { value: number }) {
    const safeValue = Math.max(0, Math.min(30, value));

    const height = 230;
    const width = 110;
    const topMargin = 25;
    const innerHeight = 180;

    const getPointY = (psi: number) => topMargin + (psi / 30) * innerHeight;
    const pistonY = getPointY(safeValue);

    return (
        <Svg width={width} height={height + 20} viewBox={`0 0 ${width} ${height + 20}`}>
            <Rect x={5} y={5} width={100} height={height} rx={15} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1} />
            <Rect x={10} y={10} width={90} height={height - 10} rx={12} fill="white" />

            <Rect x={44} y={topMargin - 5} width={22} height={innerHeight + 10} rx={11} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth={1} />

            <Line x1={42} y1={getPointY(0)} x2={42} y2={getPointY(8)} stroke="#22c55e" strokeWidth={2} />
            <Line x1={68} y1={getPointY(0)} x2={68} y2={getPointY(8)} stroke="#22c55e" strokeWidth={2} />

            <Line x1={42} y1={getPointY(8)} x2={42} y2={getPointY(14)} stroke="#eab308" strokeWidth={2} />
            <Line x1={68} y1={getPointY(8)} x2={68} y2={getPointY(14)} stroke="#eab308" strokeWidth={2} />

            <Line x1={42} y1={getPointY(14)} x2={42} y2={getPointY(30)} stroke="#ef4444" strokeWidth={2} />
            <Line x1={68} y1={getPointY(14)} x2={68} y2={getPointY(30)} stroke="#ef4444" strokeWidth={2} />

            <Text x={32} y={18} style={{ fontSize: 6, fill: "#94a3b8", fontWeight: "bold", textAnchor: "middle" }}>
                P.S.I.
            </Text>

            <Text x={78} y={18} style={{ fontSize: 6, fill: "#94a3b8", fontWeight: "bold", textAnchor: "middle" }}>
                KG/CM
            </Text>

            {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map((psi) => {
                const y = getPointY(psi);
                const kgcm = (psi * 0.0703).toFixed(1);

                return (
                    <G key={`scale-${psi}`}>
                        <Line x1={36} y1={y} x2={42} y2={y} stroke="#475569" strokeWidth={0.5} />
                        <Text x={33} y={y + 2} style={{ fontSize: 5, textAnchor: "end", fill: "#475569" }}>
                            {psi}
                        </Text>

                        <Line x1={68} y1={y} x2={74} y2={y} stroke="#475569" strokeWidth={0.5} />
                        <Text x={77} y={y + 2} style={{ fontSize: 5, textAnchor: "start", fill: "#475569" }}>
                            {kgcm}
                        </Text>
                    </G>
                );
            })}

            <Rect
                x={47}
                y={pistonY}
                width={16}
                height={(topMargin + innerHeight) - pistonY + 5}
                fill="#3b82f6"
                rx={2}
            />

            <G>
                <Line
                    x1={30}
                    y1={pistonY}
                    x2={80}
                    y2={pistonY}
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="1,1"
                />

                <Path d={`M35 ${pistonY} L38 ${pistonY - 2} L38 ${pistonY + 2} Z`} fill="#ef4444" />
                <Path d={`M75 ${pistonY} L72 ${pistonY - 2} L72 ${pistonY + 2} Z`} fill="#ef4444" />
            </G>

            <Text
                x={55}
                y={height - 5}
                style={{ fontSize: 5, textAnchor: "middle", fill: "#94a3b8", fontWeight: "bold" }}
            >
                READ AT TOP OF PISTON
            </Text>
        </Svg>
    );
}

function RemisionPdfDoc({ data }: { data: any }) {
    const getFirmaUrl = (path: string) => `${window.location.origin}/storage/${path}`;
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    const firmaCliente = data.firmas?.find((f: any) => f.pivot.rol === "cliente");
    const firmaOperador = data.firmas?.find((f: any) => f.pivot.rol === "operador");
    const formatHora = (value: any) => {
        if (!value) return "-";

        const hora = String(value);

        if (hora.includes("T")) {
            return hora.split("T")[1]?.substring(0, 5) || "-";
        }

        const match = hora.match(/^(\d{2}:\d{2})/);

        if (match) {
            return match[1];
        }

        return hora;
    };
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Image src={watermarkUrl} style={styles.watermark} />

                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Image src={logoUrl} style={styles.headerLogo} />
                    </View>

                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Remisión de Suministro</Text>

                        <Text style={styles.headerSub}>
                            <Text style={styles.folioText}>Folio: {data.folio}</Text>
                            <Text> | Fecha: {data.fecha}</Text>
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Información General</Text>

                <View style={styles.grid}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Cliente</Text>
                        <Text style={styles.value}>{data.cliente}</Text>
                    </View>

                    <View style={styles.col}>
                        <Text style={styles.label}>Unidad / Pipa</Text>
                        <Text style={styles.value}>{data.unidad}</Text>
                    </View>

                    <View style={styles.col}>
                        <Text style={styles.label}>Operador</Text>
                        <Text style={styles.value}>{data.operador}</Text>
                    </View>

                    <View style={styles.col}>
                        <Text style={styles.label}>Producto</Text>
                        <Text style={styles.value}>{data.producto}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Detalles de la Aeronave y Servicio</Text>

                <View style={styles.grid}>
                    <View style={styles.col3}>
                        <Text style={styles.label}>Matrícula</Text>
                        <Text style={styles.matriculaValue}>{data.matricula}</Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Equipo</Text>
                        <Text style={styles.value}>{data.aeronave_tipo}</Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Destino</Text>
                        <Text style={styles.value}>{data.destino}</Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Llegada de Autotanque</Text>
                        <Text style={styles.value}>{formatHora(data.hora_llegada)}</Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Inicio de Carga</Text>
                        <Text style={styles.value}>{formatHora(data.hora_inicial)}</Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Fin de Carga</Text>
                        <Text style={styles.value}>{formatHora(data.hora_final)}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Lecturas y Presión Diferencial</Text>

                <View style={styles.gaugeSection}>
                    <View style={styles.gaugeInfoCol}>
                        <View style={styles.infoBox}>
                            <Text style={styles.label}>Lectura Inicial</Text>
                            <Text style={styles.value}>{formatLitros(data.lectura_inicial)}</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.label}>Lectura Final</Text>
                            <Text style={styles.value}>{formatLitros(data.lectura_final)}</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.label}>Forma de Pago</Text>
                            <Text style={styles.value}>{data.forma_pago || "-"}</Text>
                        </View>

                        <View style={styles.totalBox}>
                            <Text style={styles.label}>Total Suministrado</Text>
                            <Text style={styles.totalValue}>{formatLitros(data.total_litros)} L</Text>
                        </View>
                    </View>

                    <View style={styles.gaugeVisualCol}>
                        <Text style={[styles.label, { marginBottom: 5, fontWeight: "bold" }]}>
                            Monitoreo de Presión
                        </Text>

                        <PressureGaugePdf value={Number(data.presionDif || 0)} />
                    </View>
                </View>

                <View style={styles.signatureSection}>
                    <View style={styles.signatureBox}>
                        {firmaOperador ? (
                            <Image src={getFirmaUrl(firmaOperador.path)} style={styles.signatureImg} />
                        ) : (
                            <View style={styles.signatureImgSpace} />
                        )}

                        <View style={styles.signatureLineBox}>
                            <Text style={styles.label}>Firma del Operador</Text>
                            <Text style={styles.signatureName}>{data.operador}</Text>
                        </View>
                    </View>

                    <View style={styles.signatureBox}>
                        {firmaCliente ? (
                            <Image src={getFirmaUrl(firmaCliente.path)} style={styles.signatureImg} />
                        ) : (
                            <View style={styles.signatureImgSpace} />
                        )}

                        <View style={styles.signatureLineBox}>
                            <Text style={styles.label}>Firma del Cliente</Text>
                            <Text style={styles.signatureName}>{data.cliente}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.disclaimerBox} fixed>
                    <View style={styles.disclaimerIcon}>
                        <Svg viewBox="0 0 24 24">
                            <Path
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                stroke="#3b82f6"
                                strokeWidth={2}
                            />
                        </Svg>
                    </View>

                    <View style={styles.disclaimerTextCol}>
                        <Text style={styles.disclaimerText}>
                            Acepto ser el representante del cliente y aeronave descrita, por lo que me obligo a pagar a{" "}
                            <Text style={styles.boldText}>Eolo Plus S.A. de C.V.</Text> el importe total por este servicio.
                        </Text>

                        <Text style={styles.disclaimerText}>
                            Contacto:{" "}
                            <Link src="mailto:sales@eolo.com.mx" style={styles.linkText}>
                                sales@eolo.com.mx
                            </Link>
                        </Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}

export default function PdfExporterRemision({ id, onDone }: { id: number | null; onDone: () => void }) {
    useEffect(() => {
        if (!id) return;

        const generarPdfRemision = async () => {
            Swal.fire({
                title: "Generando Remisión",
                text: "Preparando documento con gráficos...",
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

                Swal.fire({
                    icon: "success",
                    title: "PDF Descargado",
                    timer: 1500,
                    showConfirmButton: false,
                });
            } catch (error) {
                console.error(error);
                Swal.fire("Error", "No se pudo generar el PDF", "error");
            } finally {
                onDone();
            }
        };

        generarPdfRemision();
    }, [id]);

    return null;
}
