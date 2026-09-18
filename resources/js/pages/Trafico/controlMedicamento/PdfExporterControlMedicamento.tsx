import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Download, FileText, Loader2, X } from "lucide-react";
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
} from "@react-pdf/renderer";
import { fetchCierresMedicamento } from "@/stores/apiControlMedicamento";
import type { EntregaCierre } from "./types";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";
const RED = "#dc2626";

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
    cierreBox: {
        marginBottom: 14,
    },
    cierreHeader: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
        padding: 6,
        backgroundColor: "#f8fafc",
    },
    cierreTitle: {
        fontSize: 10,
        fontWeight: "bold" as any,
        color: GREEN,
        textTransform: "uppercase",
        marginBottom: 3,
    },
    cierreInfo: {
        fontSize: 8,
        color: GRAY_TEXT,
    },
    table: {
        borderLeftWidth: 1,
        borderColor: BORDER,
    },
    tableRow: {
        flexDirection: "row",
    },
    th: {
        backgroundColor: "#f3f4f6",
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
        padding: 5,
        fontSize: 7,
        fontWeight: "bold" as any,
        color: GRAY_TEXT,
        textTransform: "uppercase",
    },
    td: {
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
        padding: 5,
        fontSize: 8,
    },
    colMedicamento: {
        width: "34%",
    },
    colSmall: {
        width: "16.5%",
        textAlign: "center",
    },
    statusDisponible: {
        color: "#059669",
        fontWeight: "bold" as any,
        textTransform: "uppercase",
    },
    statusReabastecer: {
        color: "#ea580c",
        fontWeight: "bold" as any,
        textTransform: "uppercase",
    },
    statusAgotado: {
        color: RED,
        fontWeight: "bold" as any,
        textTransform: "uppercase",
    },
    aparatosGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    aparatoCol: {
        width: "50%",
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
        fontSize: 9,
        fontWeight: "bold" as any,
    },
    colEntregaReceptor: {
        width: "30%",
    },
    colEntregaMedicamento: {
        width: "24%",
    },
    colEntregaCantidad: {
        width: "10%",
        textAlign: "center",
    },
    colEntregaEntrego: {
        width: "20%",
    },
    colEntregaFecha: {
        width: "16%",
        textAlign: "center",
    },
    sinEntregas: {
        borderWidth: 1,
        borderColor: BORDER,
        padding: 8,
        fontSize: 8,
        color: GRAY_TEXT,
        textAlign: "center",
        textTransform: "uppercase",
    },
    emptyBox: {
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER,
        textAlign: "center",
        marginTop: 10,
    },
    emptyText: {
        fontSize: 10,
        fontWeight: "bold" as any,
        color: GRAY_TEXT,
        textTransform: "uppercase",
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
    },
});

const formatearFecha = (valor: any) => {
    if (!valor) return "-";

    const texto = String(valor);
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const fecha = new Date(texto);

    if (Number.isNaN(fecha.getTime())) {
        return texto;
    }

    return fecha.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const normalizarJson = (value: any) => {
    if (!value) return {};

    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }

    return value;
};

const obtenerEstatus = (stock: number) => {
    if (stock === 0) {
        return {
            texto: "Agotado",
            style: styles.statusAgotado,
        };
    }

    if (stock <= 5) {
        return {
            texto: "Reabastecer",
            style: styles.statusReabastecer,
        };
    }

    return {
        texto: "Disponible",
        style: styles.statusDisponible,
    };
};

/** "2026-09-18T17:56:30.000000Z" (o "2026-09-18 17:56:30") → "18/09/2026 17:56" en hora local. */
function formatearFechaHora(valor?: string | null): string {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);

    return fecha.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function CierreMedicamentoPdfDoc({
    cierres,
    fechaInicio,
    fechaFin,
}: {
    cierres: any[];
    fechaInicio: string;
    fechaFin: string;
}) {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Image src={watermarkUrl} style={styles.watermark} />

                <View style={styles.headerWrap}>
                    <View style={styles.headerLeft}>
                        <Image src={logoUrl} style={styles.headerLogo} />
                    </View>

                    <View style={styles.headerMid}>
                        <Text style={styles.headerTitle}>Reporte de Cierres de Turno</Text>

                        <Text style={styles.headerSub}>
                            <Text style={styles.folioText}>Control Médico</Text>
                            <Text>
                                {" "} | Periodo: {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}
                            </Text>
                        </Text>
                    </View>
                </View>

                {cierres.length === 0 && (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                            No se encontraron cierres en el rango seleccionado
                        </Text>
                    </View>
                )}

                {cierres.map((cierre) => {
                    const medicamentos = normalizarJson(cierre.medicamentos);
                    const aparatos = normalizarJson(cierre.aparatos);
                    const entregas: EntregaCierre[] = Array.isArray(cierre.entregas) ? cierre.entregas : [];

                    return (
                        <View key={cierre.id} style={styles.cierreBox} wrap={false}>
                            <Text style={styles.sectionTitle}>Cierre de Turno #{cierre.id}</Text>

                            <View style={styles.cierreHeader}>
                                <Text style={styles.cierreTitle}>
                                    Responsable: {cierre.responsable || "-"}
                                </Text>

                                <Text style={styles.cierreInfo}>
                                    Fecha: {formatearFecha(cierre.fecha)} | Día: {cierre.dia || "-"}
                                </Text>
                            </View>

                            <View style={styles.table}>
                                <View style={styles.tableRow}>
                                    <Text style={[styles.th, styles.colMedicamento]}>Medicamento</Text>
                                    <Text style={[styles.th, styles.colSmall]}>Inicio</Text>
                                    <Text style={[styles.th, styles.colSmall]}>Entregados</Text>
                                    <Text style={[styles.th, styles.colSmall]}>Final</Text>
                                    <Text style={[styles.th, styles.colSmall]}>Estatus</Text>
                                </View>

                                {Object.entries(medicamentos).map(([nombre, data]: any) => {
                                    const inicio = Number(data?.inicio || 0);
                                    const final = Number(data?.final || 0);
                                    const entregados = inicio - final;
                                    const estatus = obtenerEstatus(final);

                                    return (
                                        <View key={nombre} style={styles.tableRow}>
                                            <Text style={[styles.td, styles.colMedicamento]}>
                                                {String(nombre).toUpperCase()}
                                            </Text>

                                            <Text style={[styles.td, styles.colSmall]}>
                                                {inicio}
                                            </Text>

                                            <Text style={[styles.td, styles.colSmall]}>
                                                {entregados}
                                            </Text>

                                            <Text style={[styles.td, styles.colSmall]}>
                                                {final}
                                            </Text>

                                            <Text style={[styles.td, styles.colSmall, estatus.style]}>
                                                {estatus.texto}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <Text style={styles.sectionTitle}>Aparatos Verificados</Text>

                            <View style={styles.aparatosGrid}>
                                <View style={styles.aparatoCol}>
                                    <Text style={styles.label}>Oxímetro</Text>
                                    <Text style={styles.value}>{aparatos.oximetro ? "Sí" : "No"}</Text>
                                </View>

                                <View style={styles.aparatoCol}>
                                    <Text style={styles.label}>Baumanómetro</Text>
                                    <Text style={styles.value}>{aparatos.baumanometro ? "Sí" : "No"}</Text>
                                </View>

                                <View style={styles.aparatoCol}>
                                    <Text style={styles.label}>Monitor de Presión</Text>
                                    <Text style={styles.value}>{aparatos.monitor_presion ? "Sí" : "No"}</Text>
                                </View>

                                <View style={styles.aparatoCol}>
                                    <Text style={styles.label}>Estetoscopio</Text>
                                    <Text style={styles.value}>{aparatos.estetoscopio ? "Sí" : "No"}</Text>
                                </View>
                            </View>

                            {/* Entregas finalizadas por este cierre (control_medicamento_id = cierre.id). */}
                            <Text style={styles.sectionTitle}>Entregas de medicamentos del turno</Text>

                            {entregas.length === 0 ? (
                                <Text style={styles.sinEntregas}>
                                    No se registraron entregas de medicamentos durante este turno
                                </Text>
                            ) : (
                                <View style={styles.table}>
                                    <View style={styles.tableRow}>
                                        <Text style={[styles.th, styles.colEntregaReceptor]}>Recibió</Text>
                                        <Text style={[styles.th, styles.colEntregaMedicamento]}>Medicamento</Text>
                                        <Text style={[styles.th, styles.colEntregaCantidad]}>Cant.</Text>
                                        <Text style={[styles.th, styles.colEntregaEntrego]}>Entregó</Text>
                                        <Text style={[styles.th, styles.colEntregaFecha]}>Fecha y hora</Text>
                                    </View>

                                    {entregas.map((entrega) => (
                                        <View key={entrega.id} style={styles.tableRow}>
                                            <Text style={[styles.td, styles.colEntregaReceptor]}>
                                                {String(entrega.receptor || "-").toUpperCase()}
                                            </Text>
                                            <Text style={[styles.td, styles.colEntregaMedicamento]}>
                                                {String(entrega.medicamento?.nombre || "-").toUpperCase()}
                                            </Text>
                                            <Text style={[styles.td, styles.colEntregaCantidad]}>
                                                {entrega.cantidad}
                                            </Text>
                                            <Text style={[styles.td, styles.colEntregaEntrego]}>
                                                {String(entrega.entregado_por?.name || entrega.capturado_por?.name || "-").toUpperCase()}
                                            </Text>
                                            <Text style={[styles.td, styles.colEntregaFecha]}>
                                                {formatearFechaHora(entrega.created_at)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}

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
                </View>
            </Page>
        </Document>
    );
}

export default function PdfExporterControlMedicamento({
    fechaInicio,
    fechaFin,
    onDone,
}: {
    fechaInicio: string | null;
    fechaFin: string | null;
    onDone: () => void;
}) {
    const [blob, setBlob] = useState<Blob | null>(null);
    const [urlVistaPrevia, setUrlVistaPrevia] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abierto = Boolean(fechaInicio && fechaFin);

    // Se genera el PDF una sola vez; la vista previa y la descarga usan el
    // mismo blob, así el archivo descargado es idéntico a lo que se ve.
    useEffect(() => {
        if (!fechaInicio || !fechaFin) return;

        let cancelado = false;
        let url: string | null = null;

        const generar = async () => {
            setCargando(true);
            setError(null);
            setBlob(null);

            try {
                const response = await fetchCierresMedicamento({
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin,
                });

                const cierres = Array.isArray(response) ? response : [];

                const generado = await pdf(
                    <CierreMedicamentoPdfDoc
                        cierres={cierres}
                        fechaInicio={fechaInicio}
                        fechaFin={fechaFin}
                    />
                ).toBlob();

                if (cancelado) return;

                url = URL.createObjectURL(generado);
                setBlob(generado);
                setUrlVistaPrevia(url);
            } catch (e) {
                console.error(e);
                if (!cancelado) setError("No se pudo generar el PDF");
            } finally {
                if (!cancelado) setCargando(false);
            }
        };

        void generar();

        return () => {
            cancelado = true;
            if (url) URL.revokeObjectURL(url);
            setUrlVistaPrevia(null);
            setBlob(null);
        };
    }, [fechaInicio, fechaFin]);

    useEffect(() => {
        if (!abierto) return;

        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onDone();
        };

        window.addEventListener("keydown", cerrarConEscape);
        return () => window.removeEventListener("keydown", cerrarConEscape);
    }, [abierto, onDone]);

    if (!abierto) return null;

    const descargar = () => {
        if (!blob || !urlVistaPrevia) return;

        const a = document.createElement("a");
        a.href = urlVistaPrevia;
        a.download = `Cierres_Medicamento_${fechaInicio}_${fechaFin}.pdf`;
        a.click();

        Swal.fire({
            icon: "success",
            title: "PDF descargado",
            timer: 1500,
            showConfirmButton: false,
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onDone} />

            <div className="relative z-10 flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                            <FileText size={20} />
                        </div>

                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-black uppercase tracking-wide text-slate-800">
                                Vista previa del reporte de cierres
                            </h2>
                            <p className="truncate text-xs text-slate-500">
                                Control Médico · {formatearFecha(fechaInicio!)} al {formatearFecha(fechaFin!)}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onDone}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-4">
                    {cargando && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <Loader2 size={36} className="mb-3 animate-spin text-red-600" />
                            <p className="text-sm font-black uppercase tracking-wide text-slate-700">Generando vista previa</p>
                            <p className="mt-1 text-xs text-slate-400">Preparando reporte de cierres...</p>
                        </div>
                    )}

                    {!cargando && error && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-200 bg-white px-6 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <FileText size={28} />
                            </div>
                            <p className="text-sm font-black uppercase text-slate-800">Sin vista previa</p>
                            <p className="mt-2 max-w-md text-sm text-slate-500">{error}</p>
                        </div>
                    )}

                    {!cargando && !error && urlVistaPrevia && (
                        <iframe
                            title="Vista previa del reporte de cierres de medicamento"
                            src={`${urlVistaPrevia}#toolbar=0&navpanes=0&scrollbar=1`}
                            className="h-full w-full rounded-xl border border-slate-300 bg-white shadow-sm"
                        />
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <button
                        type="button"
                        onClick={onDone}
                        className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Cerrar
                    </button>

                    <button
                        type="button"
                        onClick={descargar}
                        disabled={!blob || cargando}
                        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download size={16} />
                        Descargar PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
