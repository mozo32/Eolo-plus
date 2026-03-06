import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const COLORS = {
    PRIMARY: '#003B49',
    SECONDARY: '#5E8CA1',
    ACCENT: '#A6192E',
    TEXT: '#1A1A1B',
    MUTED: '#64748B',
    BORDER: '#E2E8F0',
    HIGHLIGHT: '#F1F5F9'
};

const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 8, fontFamily: 'Helvetica', color: COLORS.TEXT },

    // Header
    header: { marginBottom: 20, borderBottom: `2pt solid ${COLORS.PRIMARY}`, paddingBottom: 10 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logoSection: { flexDirection: 'column' },
    mainTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.PRIMARY },
    badge: { backgroundColor: COLORS.ACCENT, color: 'white', padding: '2 6', borderRadius: 4, fontSize: 10, fontWeight: 'bold', marginTop: 4 },

    // Grid de Metadatos
    metaGrid: { flexDirection: 'row', backgroundColor: COLORS.HIGHLIGHT, padding: 10, borderRadius: 4, marginBottom: 15 },
    metaItem: { flex: 1 },
    metaLabel: { fontSize: 6, color: COLORS.MUTED, textTransform: 'uppercase' },
    metaValue: { fontSize: 9, fontWeight: 'bold', color: COLORS.PRIMARY },

    // Secciones Principales
    section: { marginBottom: 15 },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottom: `1pt solid ${COLORS.SECONDARY}`,
        marginBottom: 8,
        paddingBottom: 2
    },
    sectionTitle: { fontSize: 10, fontWeight: 'bold', color: COLORS.SECONDARY, textTransform: 'uppercase' },

    // Tablas Compactas
    table: { width: '100%' },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: COLORS.PRIMARY,
        padding: 4,
        borderRadius: 2
    },
    headerCell: { color: 'white', fontWeight: 'bold', fontSize: 7 },
    row: {
        flexDirection: 'row',
        borderBottom: `0.5pt solid ${COLORS.BORDER}`,
        paddingVertical: 4,
        alignItems: 'center'
    },
    cell: { paddingHorizontal: 2 },
    bold: { fontWeight: 'bold' },

    // Estados Visuales
    statusPill: { fontSize: 6, padding: '1 3', borderRadius: 3, textAlign: 'center' },
    statusError: { color: COLORS.ACCENT, fontWeight: 'bold' },

    // Bloques de Detalles
    detailBox: {
        padding: 6,
        border: `1pt solid ${COLORS.BORDER}`,
        borderRadius: 4,
        width: '48%',
        marginBottom: 6
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },

    // Firmas
    footer: { marginTop: 'auto', paddingTop: 20 },
    signatureRow: { flexDirection: 'row', justifyContent: 'space-around' },
    signBox: { width: '30%', textAlign: 'center', borderTop: '0.5pt solid #000', paddingTop: 5 },
    signImg: { width: 80, height: 40, marginBottom: 4, alignSelf: 'center' }
});

const ReportePDF = ({ data }: { data: any }) => {
    const vehiculos = Object.entries(data.vehiculos || {});
    const gpus = Object.entries(data.gpus || {});
    const carritos = Object.entries(data.carrito_golf || {});

    return (
        <Document>
            <Page style={styles.page} size="A4">
                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.topRow}>
                        <View style={styles.logoSection}>
                            <Text style={styles.mainTitle}>EOLO PLUS S.A.</Text>
                            <Text style={{ fontSize: 9, color: COLORS.SECONDARY }}>Operations & Ground Handling Report</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.metaLabel}>Folio de Registro</Text>
                            <Text style={styles.badge}>ID: {data.id}</Text>
                        </View>
                    </View>
                </View>

                {/* METADATOS GENERALES */}
                <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Jefe de Turno</Text>
                        <Text style={styles.metaValue}>{data.encabezado.jefeTurno}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Fecha y Hora</Text>
                        <Text style={styles.metaValue}>{data.encabezado.fecha}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Comunicaciones</Text>
                        <Text style={styles.metaValue}>
                            {data.comunicaciones.radios} Rad / Freq: {data.comunicaciones.radioFrecuencia}
                        </Text>
                        <Text style={[styles.statusPill, !data.comunicaciones.radiosFuncionando ? styles.statusError : { color: 'green' }]}>
                            {data.comunicaciones.radiosFuncionando ? '● SISTEMA OPERATIVO' : '● FALLA EN SISTEMA'}
                        </Text>
                    </View>
                </View>

                {/* AERONAVES Y PLATAFORMA */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Ubicación de Aeronaves</Text></View>
                    <View style={styles.rowBetween}>
                        {['Hangar 1', 'Hangar 2', 'Plataforma H1', 'Plataforma H2'].map((loc, i) => (
                            <View key={loc} style={[styles.detailBox, { width: '23%' }]}>
                                <Text style={styles.metaLabel}>{loc}</Text>

                                <Text style={styles.metaValue}>
                                    {Object.values(data.aeronaves)[i]} <Text style={{ fontSize: 6 }}>Unidades</Text>
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* TABLA VEHÍCULOS (Completa) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Inspección de Flota Vehicular</Text></View>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.cell, styles.headerCell, { width: '18%' }]}>UNIDAD</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '12%' }]}>ESTADO</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>NIVEL</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>LIMP.</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>LLANT.</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>FREN./LUC.</Text>
                            <Text style={[styles.cell, styles.headerCell, { flex: 1 }]}>OBSERVACIONES</Text>
                        </View>
                        {vehiculos.map(([name, v]: any) => (
                            <View key={name} style={styles.row}>
                                <Text style={[styles.cell, styles.bold, { width: '18%' }]}>{name.toUpperCase()}</Text>
                                <Text style={[styles.cell, { width: '12%' }]}>{v.estado}</Text>
                                <Text style={[styles.cell, { width: '10%' }]}>{v.nivel || 'N/A'}</Text>
                                <Text style={[styles.cell, { width: '10%' }]}>{v.limpieza}</Text>
                                <Text style={[styles.cell, { width: '10%' }, v.llantas === 'Mal' ? styles.statusError : {}]}>{v.llantas}</Text>
                                <Text style={[styles.cell, { width: '10%' }]}>{v.frenos || v.luces ? `${v.frenos}/${v.luces}` : 'OK'}</Text>
                                <Text style={[styles.cell, { flex: 1, fontStyle: 'italic', fontSize: 7 }]}>{v.obs}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* GSE: GPUS Y CARRITOS */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Equipos de Apoyo (GPU & Carritos)</Text></View>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.cell, styles.headerCell, { width: '20%' }]}>EQUIPO</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '15%' }]}>HORÓM/CARGA</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '15%' }]}>ENCHUFE/LUCES</Text>
                            <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>LLANTAS</Text>
                            <Text style={[styles.cell, styles.headerCell, { flex: 1 }]}>NOTAS TÉCNICAS</Text>
                        </View>
                        {gpus.map(([name, g]: any) => (
                            <View key={name} style={styles.row}>
                                <Text style={[styles.cell, styles.bold, { width: '20%' }]}>{name.toUpperCase()}</Text>
                                <Text style={[styles.cell, { width: '15%' }]}>{g.horometro || g.numPlantas}</Text>
                                <Text style={[styles.cell, { width: '15%' }]}>{g.enchufe || 'OK'}</Text>
                                <Text style={[styles.cell, { width: '10%' }, g.llantas === 'Mal' ? styles.statusError : {}]}>{g.llantas}</Text>
                                <Text style={[styles.cell, { flex: 1, fontSize: 7 }]}>{g.obs}</Text>
                            </View>
                        ))}
                        {carritos.map(([id, c]: any) => (
                            <View key={id} style={styles.row}>
                                <Text style={[styles.cell, styles.bold, { width: '20%' }]}>CARRITO GOLF {id}</Text>
                                <Text style={[styles.cell, { width: '15%' }]}>{c.carga}%</Text>
                                <Text style={[styles.cell, { width: '15%' }]}>{c.luces}/{c.frenos}</Text>
                                <Text style={[styles.cell, { width: '10%' }, c.llantas === 'Mal' ? styles.statusError : {}]}>{c.llantas}</Text>
                                <Text style={[styles.cell, { flex: 1, fontSize: 7 }]}>{c.obs}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* BARRAS Y EQUIPOS MENORES */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Detalle de Herramental y Remolque</Text></View>
                    <View style={styles.rowBetween}>
                        <View style={styles.detailBox}>
                            <Text style={styles.metaLabel}>Barras de Remolque / Towbars</Text>
                            <Text style={styles.metaValue}>Total: {data.barras_remolque.total} | Estado: {data.barras_remolque.estado}</Text>
                            <Text style={{ fontSize: 7, marginTop: 2 }}>Limpieza: {data.barras_remolque.limpieza} | Cabezales: {data.barras_remolque.cabezales} ({data.barras_remolque.cabezalesEstado})</Text>
                        </View>
                        <View style={styles.detailBox}>
                            <Text style={styles.metaLabel}>Escaleras y Hamburguesera</Text>
                            <Text style={styles.metaValue}>Escaleras: {data.barras_remolque.escalerasCantidad} ({data.barras_remolque.escalerasEstado})</Text>
                            <Text style={{ fontSize: 7, marginTop: 2 }}>Hamburguesera: {data.barras_remolque.hamburgueseraLimpieza} / Llantas: {data.barras_remolque.hamburgueseraLlantas}</Text>
                        </View>
                    </View>
                </View>

                {/* FIRMAS Y CIERRE */}
                <View style={styles.footer}>
                    <View style={styles.signatureRow}>
                        <View style={styles.signBox}>
                            {data.firmas?.[0] && (
                                <Image style={styles.signImg} src={`https://tudominio.com/storage/${data.firmas[0].path}`} />
                            )}
                            <Text style={styles.bold}>{data.nombre_entrega}</Text>
                            <Text style={styles.metaLabel}>Entrega Turno</Text>
                        </View>
                        <View style={styles.signBox}>
                            <View style={{ height: 40 }} />
                            <Text style={styles.bold}>{data.nombre_recibe || '________________'}</Text>
                            <Text style={styles.metaLabel}>Recibe Turno</Text>
                        </View>
                    </View>
                    <Text style={{ textAlign: 'center', fontSize: 6, color: COLORS.MUTED, marginTop: 15 }}>
                        Este es un documento oficial de EOLO PLUS. La falsificación de datos en bitácoras de rampa es una falta grave.
                        Generado el: {new Date(data.created_at).toLocaleString()}
                    </Text>
                </View>
            </Page>
        </Document>
    );
};

export default ReportePDF;
