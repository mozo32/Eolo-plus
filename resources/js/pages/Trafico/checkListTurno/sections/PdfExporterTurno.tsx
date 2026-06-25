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
        opacity: 0.05,
        zIndex: -1,
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
        flex: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6,
    },
    col2: {
        width: "50%",
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6,
    },
    col3: {
        width: "33.333%",
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6,
    },
    col4: {
        width: "25%",
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
    valueSmall: {
        fontSize: 8,
        fontWeight: "bold" as any,
    },
    tableBox: {
        borderLeftWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f9fafb",
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    headerCell: {
        fontSize: 7,
        fontWeight: "bold" as any,
        padding: 4,
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
        padding: 4,
        borderRightWidth: 1,
        borderColor: BORDER,
    },
    observationBox: {
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },
    observationItem: {
        width: "100%",
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderColor: BORDER,
        padding: 6,
    },
    signatureSection: {
        flexDirection: "row",
        marginTop: 25,
        justifyContent: "space-around",
    },
    signatureBox: {
        width: "30%",
        alignItems: "center",
        borderTopWidth: 1,
        borderColor: BORDER,
        paddingTop: 5,
    },
    signatureImg: {
        width: 100,
        height: 50,
        marginBottom: 5,
        objectFit: "contain",
    },
    footerInfo: {
        marginTop: 15,
        fontSize: 7,
        color: GRAY_TEXT,
        textAlign: "center",
    },
});

const formatDate = (value: any) => {
    if (!value) return "-";

    const raw = String(value);

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [year, month, day] = raw.substring(0, 10).split("-");
        return `${day}/${month}/${year}`;
    }

    return raw;
};

const formatKey = (key: string) => {
    return String(key || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
};

const boolText = (value: any) => {
    return value ? "SI" : "NO";
};

const boolColor = (value: any) => {
    return value ? GREEN_INST : "#ef4444";
};

function ChecklistPdfDoc({ data }: { data: any }) {
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    const recibeTurno = Object.entries(data?.recibe_turno_con || {});
    const entregaTurno = Object.entries(data?.entrega_turno_con || {});
    const revisionSalas = Object.entries(data?.revision_salas || {});
    const hotTrasComiCoor = Array.isArray(data?.hot_tras_comi_coor) ? data.hot_tras_comi_coor : [];
    const firmas = Array.isArray(data?.firmas) ? data.firmas : [];

    const cantidadNacionales =
        data?.cantidad_operaciones_nacionales ??
        data?.cantidad_nacionales ??
        0;

    const cantidadInternacionales =
        data?.cantidad_operaciones_internacionales ??
        data?.cantidad_internacionales ??
        0;

    const getFirmaSrc = (firma: any) => {
        if (!firma) return "";

        if (firma.url) return firma.url;

        if (firma.path) {
            return `${window.location.origin}/storage/${firma.path}`;
        }

        return "";
    };

    const renderCheckGrid = (items: [string, any][]) => {
        if (!items.length) {
            return (
                <View style={styles.grid}>
                    <View style={[styles.col, { width: "100%" }]}>
                        <Text style={styles.label}>Sin datos</Text>
                        <Text style={styles.valueSmall}>-</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.grid}>
                {items.map(([key, value]) => (
                    <View key={key} style={styles.col4}>
                        <Text style={styles.label}>{formatKey(key)}</Text>
                        <Text style={[styles.value, { color: boolColor(value) }]}>
                            {boolText(value)}
                        </Text>
                    </View>
                ))}
            </View>
        );
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
                        <Text style={styles.headerTitle}>Entrega de Turno - Operaciones</Text>
                        <Text style={styles.headerSub}>
                            ID Registro: {data?.id ?? "-"} | Fecha: {formatDate(data?.fecha)}
                        </Text>
                        <Text style={styles.headerSub}>
                            Responsable: {data?.nombre_empleado ?? "-"}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Información del Turno</Text>
                <View style={styles.grid}>
                    <View style={styles.col2}>
                        <Text style={styles.label}>Responsable</Text>
                        <Text style={styles.value}>{data?.nombre_empleado ?? "-"}</Text>
                    </View>

                    <View style={styles.col2}>
                        <Text style={styles.label}>Fecha</Text>
                        <Text style={styles.value}>{formatDate(data?.fecha)}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Resumen de Operaciones</Text>
                <View style={styles.grid}>
                    <View style={styles.col4}>
                        <Text style={styles.label}>Total Operaciones</Text>
                        <Text style={styles.value}>{data?.cantidad_operaciones ?? 0}</Text>
                    </View>

                    <View style={styles.col4}>
                        <Text style={styles.label}>Nacionales</Text>
                        <Text style={styles.value}>{cantidadNacionales}</Text>
                    </View>

                    <View style={styles.col4}>
                        <Text style={styles.label}>Internacionales</Text>
                        <Text style={styles.value}>{cantidadInternacionales}</Text>
                    </View>

                    <View style={styles.col4}>
                        <Text style={styles.label}>Equipaje</Text>
                        <Text style={styles.value}>{data?.cantidad_equipaje ?? 0}</Text>
                    </View>

                    <View style={styles.col2}>
                        <Text style={styles.label}>Total Pasajeros</Text>
                        <Text style={styles.value}>{data?.cantidad_pasajeros ?? 0}</Text>
                    </View>

                    <View style={styles.col2}>
                        <Text style={styles.label}>Folio</Text>
                        <Text style={styles.value}>#{data?.id ?? "-"}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Tipo de Cliente</Text>
                <View style={styles.grid}>
                    <View style={styles.col4}>
                        <Text style={styles.label}>Tránsito</Text>
                        <Text style={styles.value}>{data?.cantidad_transito ?? 0}</Text>
                    </View>

                    <View style={styles.col4}>
                        <Text style={styles.label}>Guarda</Text>
                        <Text style={styles.value}>{data?.cantidad_guarda ?? 0}</Text>
                    </View>

                    <View style={styles.col4}>
                        <Text style={styles.label}>Aerotaxi</Text>
                        <Text style={styles.value}>{data?.cantidad_aerotaxi ?? 0}</Text>
                    </View>

                    <View style={styles.col4}>
                        <Text style={styles.label}>Mantenimiento</Text>
                        <Text style={styles.value}>{data?.cantidad_mantenimiento ?? 0}</Text>
                    </View>

                    <View style={[styles.col, { width: "100%" }]}>
                        <Text style={styles.label}>Handling</Text>
                        <Text style={styles.value}>{data?.cantidad_handling ?? 0}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Cumplimiento de Obligaciones</Text>
                <View style={styles.grid}>
                    <View style={styles.col3}>
                        <Text style={styles.label}>Revisión Base Operaciones</Text>
                        <Text style={[styles.value, { color: boolColor(data?.revision_base_operaciones) }]}>
                            {boolText(data?.revision_base_operaciones)}
                        </Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Informe Diario</Text>
                        <Text style={[styles.value, { color: boolColor(data?.envia_informe_diario) }]}>
                            {boolText(data?.envia_informe_diario)}
                        </Text>
                    </View>

                    <View style={styles.col3}>
                        <Text style={styles.label}>Resumen Semanal</Text>
                        <Text style={[styles.value, { color: boolColor(data?.envia_resumen_semanal) }]}>
                            {boolText(data?.envia_resumen_semanal)}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Recepción de Turno</Text>
                {renderCheckGrid(recibeTurno)}

                <Text style={styles.sectionTitle}>Revisión de Salas / Aulas</Text>
                <View style={styles.tableBox}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { width: "50%" }]}>Ubicación</Text>
                        <Text style={[styles.headerCell, { width: "50%", borderRightWidth: 0 }]}>
                            Horarios Revisados
                        </Text>
                    </View>

                    {revisionSalas.length > 0 ? (
                        revisionSalas.map(([sala, horarios]: any, idx) => {
                            const horariosActivos = Object.entries(horarios || {})
                                .filter(([, activo]) => activo)
                                .map(([hora]) => formatKey(hora));

                            return (
                                <View key={idx} style={styles.row}>
                                    <Text style={[styles.cell, { width: "50%", fontWeight: "bold" as any }]}>
                                        {formatKey(sala)}
                                    </Text>
                                    <Text style={[styles.cell, { width: "50%", borderRightWidth: 0 }]}>
                                        {horariosActivos.length ? horariosActivos.join(", ") : "-"}
                                    </Text>
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.row}>
                            <Text style={[styles.cell, { width: "100%", borderRightWidth: 0 }]}>
                                Sin registros de revisión de salas.
                            </Text>
                        </View>
                    )}
                </View>

                {hotTrasComiCoor.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Hotelería, Traslados, Comidas y Coordinación</Text>

                        <View style={styles.tableBox}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: "18%" }]}>Matrícula</Text>
                                <Text style={[styles.headerCell, { width: "30%" }]}>Descripción</Text>
                                <Text style={[styles.headerCell, { width: "22%" }]}>Fecha / Hora</Text>
                                <Text style={[styles.headerCell, { width: "30%", borderRightWidth: 0 }]}>Notas</Text>
                            </View>

                            {hotTrasComiCoor.map((item: any, idx: number) => (
                                <View key={idx} style={styles.row}>
                                    <Text style={[styles.cell, { width: "18%", fontWeight: "bold" as any }]}>
                                        {item?.matricula || "-"}
                                    </Text>
                                    <Text style={[styles.cell, { width: "30%" }]}>
                                        {item?.descripcion || "-"}
                                    </Text>
                                    <Text style={[styles.cell, { width: "22%" }]}>
                                        {`${formatDate(item?.fecha)} ${item?.hora || ""}`}
                                    </Text>
                                    <Text style={[styles.cell, { width: "30%", borderRightWidth: 0 }]}>
                                        {item?.notas || "-"}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                <Text style={styles.sectionTitle}>Entrega de Turno</Text>
                {renderCheckGrid(entregaTurno)}

                <Text style={styles.sectionTitle}>Observaciones</Text>
                <View style={styles.observationBox}>
                    <View style={styles.observationItem}>
                        <Text style={styles.label}>Observaciones al Recibir</Text>
                        <Text style={styles.valueSmall}>
                            {data?.observaciones_recibe || "Sin observaciones al recibir."}
                        </Text>
                    </View>

                    <View style={styles.observationItem}>
                        <Text style={styles.label}>Observaciones al Entregar</Text>
                        <Text style={styles.valueSmall}>
                            {data?.observaciones_entrega || "Sin observaciones al entregar."}
                        </Text>
                    </View>
                </View>

                <View style={styles.signatureSection} wrap={false}>
                    {firmas.length > 0 ? (
                        firmas.map((firma: any, index: number) => (
                            <View key={firma?.id ?? index} style={styles.signatureBox}>
                                {getFirmaSrc(firma) && (
                                    <Image src={getFirmaSrc(firma)} style={styles.signatureImg} />
                                )}
                                <Text style={styles.label}>{firma?.tag || "Firma"}</Text>
                                <Text style={{ fontSize: 8 }}>
                                    {(data?.nombre_empleado || "________________").toUpperCase()}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.signatureBox}>
                            <Text style={styles.label}>Firma Autorizada</Text>
                            <Text style={{ fontSize: 8 }}>________________</Text>
                        </View>
                    )}
                </View>


            </Page>
        </Document>
    );
}

type Props = {
    id: number | null;
    onDone: () => void;
};

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
                const finalData = data?.data ? data.data : data;

                const blob = await pdf(<ChecklistPdfDoc data={finalData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");

                a.href = url;
                a.download = `Checklist_Turno_${id}.pdf`;
                a.click();

                URL.revokeObjectURL(url);

                Swal.fire({
                    icon: "success",
                    title: "Descarga iniciada",
                    timer: 1500,
                    showConfirmButton: false,
                });
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
