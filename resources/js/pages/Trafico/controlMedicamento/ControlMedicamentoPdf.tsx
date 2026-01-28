import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";

type Medicamento = {
    inicio: number;
    final: number;
};
type Firma = {
    id: number;
    url: string;
    rol: string;
};

type ControlMedicamento = {
    dia: string;
    fecha: string;
    responsable: string;
    medicamentos: Record<string, Medicamento>;
    firmas: Firma[];
};

type Props = {
    data: ControlMedicamento[];
    week: string;
    firmasBase64: Record<string, string | null>;
};
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
export default function ControlMedicamentoPdf({
    data,
    week,
    firmasBase64,
}: Props) {

    const pages = chunkArray(data, 4);

    return (
        <Document>
            {pages.map((group, pageIndex) => (
                <Page key={pageIndex} size="A4" style={styles.page}>
                    {/* HEADER */}
                    <Text style={styles.title}>
                        Control Semanal de Medicamento
                    </Text>
                    <Text style={styles.subtitle}>
                        Semana {week}
                    </Text>

                    {/* GRID DE TARJETAS (máx 4) */}
                    <View style={styles.grid}>
                        {group.map((dia) => (
                            <View key={dia.fecha} style={styles.card}>
                                <Text style={styles.dayTitle}>
                                    {dia.dia.toUpperCase()}
                                </Text>

                                <View style={styles.separator} />

                                {/* ENCABEZADO */}
                                <View style={styles.headerRow}>
                                    <Text style={styles.colMed}>Medicamento</Text>
                                    <Text style={styles.colNum}>Ini</Text>
                                    <Text style={styles.colNum}>Fin</Text>
                                </View>

                                {/* MEDICAMENTOS */}
                                {Object.entries(dia.medicamentos).map(
                                    ([nombre, val]) => (
                                        <View key={nombre} style={styles.row}>
                                            <Text style={styles.colMed}>
                                                {nombre}
                                            </Text>
                                            <Text style={styles.colNum}>
                                                {val.inicio}
                                            </Text>
                                            <Text style={styles.colNum}>
                                                {val.final}
                                            </Text>
                                        </View>
                                    )
                                )}

                                {/* FIRMA */}
                                <View style={styles.signature}>
                                    {firmasBase64[dia.fecha] ? (
                                        <Image
                                            src={firmasBase64[dia.fecha]!}
                                            style={styles.firmaImg}
                                        />
                                    ) : (
                                        <Text style={styles.firmaPlaceholder}>
                                            Sin firma
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footer} fixed>
                        <Text style={styles.footerText}>
                            Control Semanal de Medicamentos · Página {pageIndex + 1} de {pages.length}
                        </Text>
                    </View>
                </Page>
            ))}
        </Document>
    );
}

// ===== ESTILOS =====
const styles = StyleSheet.create({
    page: {
        padding: 16,
        fontSize: 9,
        fontFamily: "Helvetica",
    },
    title: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#00677F",
    },
    subtitle: {
        fontSize: 9,
        marginBottom: 10,
    },
    dayTitle: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#00677F",
    },
    separator: {
        borderBottomWidth: 1,
        marginVertical: 4,
    },
    headerRow: {
        flexDirection: "row",
        marginBottom: 3,
        fontWeight: "bold",
    },
    row: {
        flexDirection: "row",
        marginBottom: 2,
    },
    colMed: {
        flex: 3,
    },
    colNum: {
        flex: 1,
        textAlign: "center",
    },
    signature: {
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
    },
    line: {
        marginLeft: 4,
        borderBottomWidth: 1,
        width: 100,
    },
    firmaImg: {
        width: 90,
        height: 40,
        objectFit: "contain",
    },

    firmaPlaceholder: {
        fontSize: 8,
        color: "#888",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },

    card: {
        width: "48%",
        height: 320,
        borderWidth: 1,
        borderColor: "#00677F",
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
    },

    footer: {
        position: "absolute",
        bottom: 12,
        left: 0,
        right: 0,
        textAlign: "center",
    },

    footerText: {
        fontSize: 8,
        color: "#666",
    },
});
