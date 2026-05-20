import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
    Svg,
    Path
} from '@react-pdf/renderer';

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
        opacity: 0.05,
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
    col2: { width: "50%", borderRightWidth: 1, borderTopWidth: 1, borderColor: BORDER, padding: 6 },
    col4: { width: "25%", borderRightWidth: 1, borderTopWidth: 1, borderColor: BORDER, padding: 6 },
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
    },
    footerInfo: {
        marginTop: 15,
        fontSize: 7,
        color: GRAY_TEXT,
        textAlign: 'center'
    }
});

const ReportePDF = ({ data }: { data: any }) => {
    // Rutas de imágenes (usando la misma lógica que tu exporter)
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;
    const getFirmaUrl = (path: string) => `${window.location.origin}/storage/${path}`;

    const vehiculos = Object.entries(data.vehiculos || {});
    const gpus = Object.entries(data.gpus || {});
    const carritos = Object.entries(data.carrito_golf || {});

    // Helper para firmas
    const getFirmaByRol = (rol: string) => data.firmas?.find((f: any) => f.pivot.rol === rol);

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
                        <Text style={styles.headerTitle}>Entrega de Turno - Rampa</Text>
                        <Text style={styles.headerSub}>ID Registro: {data.id} | Fecha: {data.encabezado.fecha}</Text>
                    </View>
                </View>

                {/* INFORMACIÓN GENERAL */}
                <Text style={styles.sectionTitle}>Información del Turno</Text>
                <View style={styles.grid}>
                    <View style={styles.col2}>
                        <Text style={styles.label}>Jefe de Turno</Text>
                        <Text style={styles.value}>{data.encabezado.jefeTurno}</Text>
                    </View>
                    <View style={styles.col2}>
                        <Text style={styles.label}>Comunicaciones (Radios)</Text>
                        <Text style={styles.value}>
                            VHF: {data.comunicaciones.vhfOperativos}/{data.comunicaciones.radiosVHF} |
                            UHF: {data.comunicaciones.uhfOperativos}/{data.comunicaciones.radiosUHF}
                        </Text>
                    </View>
                    {data.comunicaciones.observaciones && (
                        <View style={[styles.col, { width: '100%' }]}>
                            <Text style={styles.label}>Observaciones de Comunicación</Text>
                            <Text style={[styles.value, { fontSize: 8 }]}>{data.comunicaciones.observaciones}</Text>
                        </View>
                    )}
                </View>

                {/* UBICACIÓN AERONAVES */}
                <Text style={styles.sectionTitle}>Estado de Plataforma / Aeronaves</Text>
                <View style={styles.grid}>
                    {Object.entries(data.aeronaves).map(([key, value]: any) => (
                        <View key={key} style={styles.col4}>
                            <Text style={styles.label}>{key.replace('_', ' ')}</Text>
                            <Text style={styles.value}>{value} Unidades</Text>
                        </View>
                    ))}
                </View>

                {/* TABLA FLOTA */}
                <Text style={styles.sectionTitle}>Inspección de Flota y Vehículos</Text>
                <View style={{ borderLeftWidth: 1, borderTopWidth: 1, borderColor: BORDER }}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { width: '18%' }]}>Unidad</Text>
                        <Text style={[styles.headerCell, { width: '15%' }]}>Estado</Text>
                        <Text style={[styles.headerCell, { width: '12%' }]}>Nivel/KM</Text>
                        <Text style={[styles.headerCell, { width: '15%' }]}>Limpieza/Llantas</Text>
                        <Text style={[styles.headerCell, { flex: 1, borderRightWidth: 0 }]}>Notas / Suministros</Text>
                    </View>
                    {vehiculos.map(([name, v]: any) => (
                        <View key={name} style={styles.row}>
                            <Text style={[styles.cell, { width: '18%', fontWeight: 'bold' }]}>{name.toUpperCase()}</Text>
                            <Text style={[styles.cell, { width: '15%', color: v.estado === 'Mantenimiento' ? '#ef4444' : GREEN_INST }]}>{v.estado}</Text>
                            <Text style={[styles.cell, { width: '12%' }]}>{v.nivel || v.kilometraje || '-'}</Text>
                            <Text style={[styles.cell, { width: '15%' }]}>{v.limpieza || '-'}/{v.llantas || '-'}</Text>
                            <View style={[styles.cell, { flex: 1, borderRightWidth: 0 }]}>
                                {v.obs && <Text style={{ fontSize: 7, marginBottom: 2 }}>{v.obs}</Text>}
                                {v.suministros?.map((s: any, idx: number) => (
                                    <Text key={idx} style={{ fontSize: 6, color: GREEN_INST, fontWeight: 'bold' }}>
                                        Suministro: {s.matricula} - {s.cantidad}L
                                    </Text>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>

                {/* EQUIPOS GSE */}
                <Text style={styles.sectionTitle}>Equipos GSE y Apoyo</Text>
                <View style={{ borderLeftWidth: 1, borderTopWidth: 1, borderColor: BORDER }}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { width: '25%' }]}>Equipo</Text>
                        <Text style={[styles.headerCell, { width: '20%' }]}>Horóm/Carga</Text>
                        <Text style={[styles.headerCell, { width: '15%' }]}>Llantas</Text>
                        <Text style={[styles.headerCell, { flex: 1, borderRightWidth: 0 }]}>Observaciones</Text>
                    </View>
                    {gpus.map(([name, g]: any) => (
                        <View key={name} style={styles.row}>
                            <Text style={[styles.cell, { width: '25%', fontWeight: 'bold' }]}>{name.toUpperCase()}</Text>
                            <Text style={[styles.cell, { width: '20%' }]}>{g.horometro || g.numPlantas || '-'}</Text>
                            <Text style={[styles.cell, { width: '15%' }]}>{g.llantas}</Text>
                            <Text style={[styles.cell, { flex: 1, borderRightWidth: 0 }]}>{g.obs || '-'}</Text>
                        </View>
                    ))}
                    {carritos.map(([id, c]: any) => (
                        <View key={id} style={styles.row}>
                            <Text style={[styles.cell, { width: '25%', fontWeight: 'bold' }]}>Carrito Golf {id}</Text>
                            <Text style={[styles.cell, { width: '20%' }]}>{c.carga}%</Text>
                            <Text style={[styles.cell, { width: '15%' }]}>{c.llantas || '-'}</Text>
                            <Text style={[styles.cell, { flex: 1, borderRightWidth: 0 }]}>{c.estado} - {c.obs || ''}</Text>
                        </View>
                    ))}
                </View>

                {/* FIRMAS */}
                <View style={styles.signatureSection}>
                    <View style={styles.signatureBox}>
                        {getFirmaByRol('quien_entrega') && (
                            <Image src={getFirmaUrl(getFirmaByRol('quien_entrega').path)} style={styles.signatureImg} />
                        )}
                        <Text style={styles.label}>Entrega Turno</Text>
                        <Text style={{ fontSize: 8 }}>{data.nombre_entrega}</Text>
                    </View>

                    <View style={styles.signatureBox}>
                        {getFirmaByRol('jefe_rampa') && (
                            <Image src={getFirmaUrl(getFirmaByRol('jefe_rampa').path)} style={styles.signatureImg} />
                        )}
                        <Text style={styles.label}>Jefe de Rampa</Text>
                        <Text style={{ fontSize: 8 }}>{data.nombre_jefe_area}</Text>
                    </View>

                    <View style={styles.signatureBox}>
                        {getFirmaByRol('quien_recibe') && (
                            <Image src={getFirmaUrl(getFirmaByRol('quien_recibe').path)} style={styles.signatureImg} />
                        )}
                        <Text style={styles.label}>Recibe Turno</Text>
                        <Text style={{ fontSize: 8 }}>{data.nombre_recibe || '________________'}</Text>
                    </View>
                </View>

                <View style={styles.footerInfo}>
                    <Text>Este documento es propiedad de Eolo Plus S.A. de C.V. - Prohibida su reproducción total o parcial sin autorización.</Text>
                    <Text style={{ marginTop: 2 }}>Generado el: {new Date().toLocaleString()}</Text>
                </View>
            </Page>
        </Document>
    );
};

export default ReportePDF;
