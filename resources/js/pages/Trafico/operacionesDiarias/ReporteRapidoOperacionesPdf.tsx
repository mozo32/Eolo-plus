import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
} from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { pdfOperacionesDiariasApi } from '@/stores/apiOperacionesDiarias';
import { fechaHoy } from '@/lib/fechaHoy';

export type FiltrosReporte = {
    buscar?: string;
    tipo?: string;
    fechaInicio?: string;
    fechaFin?: string;
    periodo?: string;
    equipo?: string;
    lugar?: string;
    tipo_operacion?: string;
    pax?: string;
    eqp?: string;
    cliente?: string;
};

export type FilaResumen = {
    fecha: string;
    fecha_original?: string;
    transito: number;
    guarda: number;
    aerotaxi: number;
    handling: number;
    mantenimiento: number;
    total_pax_dia: number;
};

export type TotalesResumen = {
    transito: number;
    guarda: number;
    aerotaxi: number;
    handling: number;
    mantenimiento: number;
    total_operaciones: number;
    total_pax_dia: number;
};

/**
 * Las operaciones de una fila son la suma de sus cinco tipos. Se calcula aqui, a partir de las
 * mismas columnas que el documento enseña, para que no pueda darse el caso de que los numeros de
 * la fila digan una cosa y su total diga otra. `FilaResumen` NO lleva este campo a proposito: es
 * un derivado, no un dato que venga del servidor.
 */
export const operacionesDeLaFila = (fila: FilaResumen): number =>
    Number(fila.transito || 0) +
    Number(fila.guarda || 0) +
    Number(fila.aerotaxi || 0) +
    Number(fila.handling || 0) +
    Number(fila.mantenimiento || 0);

const styles = StyleSheet.create({
    page: {
        paddingTop: 70,
        paddingHorizontal: 55,
        paddingBottom: 45,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 25,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        color: '#000000',
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        color: '#111111',
        textTransform: 'uppercase',
        marginBottom: 110,
    },
    table: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#000000',
        borderStyle: 'solid',
    },
    row: {
        flexDirection: 'row',
        width: '100%',
    },
    headerCell: {
        backgroundColor: '#365C9A',
        borderRightWidth: 1,
        borderRightColor: '#000000',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    headerCellLast: {
        backgroundColor: '#365C9A',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    headerText: {
        fontSize: 10.5,
        color: '#ffffff',
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    bodyCellFecha: {
        backgroundColor: '#B8C9E6',
        borderRightWidth: 1,
        borderRightColor: '#000000',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        minHeight: 24,
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    bodyCell: {
        borderRightWidth: 1,
        borderRightColor: '#000000',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        minHeight: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodyCellLast: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        minHeight: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodyTextFecha: {
        fontSize: 11.5,
        color: '#003B70',
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
    },
    bodyText: {
        fontSize: 10.5,
        color: '#003B70',
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
    },
    totalCellFecha: {
        backgroundColor: '#D7E0F1',
        borderRightWidth: 1,
        borderRightColor: '#000000',
        minHeight: 52,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    totalCell: {
        backgroundColor: '#D7E0F1',
        borderRightWidth: 1,
        borderRightColor: '#000000',
        minHeight: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalCellLast: {
        backgroundColor: '#D7E0F1',
        minHeight: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalText: {
        fontSize: 10.5,
        color: '#003B70',
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    // Los anchos suman 100 exacto. Al entrar la octava columna se reparte de nuevo: la fecha
    // cede la mayor parte porque tenia holgura, y el resto cede un punto cada una.
    colFecha: {
        width: '18%',
    },
    colTransito: {
        width: '11%',
    },
    colGuarda: {
        width: '10%',
    },
    colAerotaxi: {
        width: '12%',
    },
    colHandling: {
        width: '11%',
    },
    colMantenimiento: {
        width: '13%',
    },
    colTotalOperaciones: {
        width: '14%',
    },
    colTotal: {
        width: '11%',
    },
});

const dias: Record<number, string> = {
    0: 'DOMINGO',
    1: 'LUNES',
    2: 'MARTES',
    3: 'MIERCOLES',
    4: 'JUEVES',
    5: 'VIERNES',
    6: 'SABADO',
};

const meses: Record<number, string> = {
    0: 'ENERO',
    1: 'FEBRERO',
    2: 'MARZO',
    3: 'ABRIL',
    4: 'MAYO',
    5: 'JUNIO',
    6: 'JULIO',
    7: 'AGOSTO',
    8: 'SEPTIEMBRE',
    9: 'OCTUBRE',
    10: 'NOVIEMBRE',
    11: 'DICIEMBRE',
};

const parseFechaLocal = (fecha?: string | null) => {
    if (!fecha) return null;

    const base = String(fecha).includes('T')
        ? String(fecha).split('T')[0]
        : String(fecha).split(' ')[0];

    const [y, m, d] = base.split('-').map(Number);

    if (!y || !m || !d) return null;

    return new Date(y, m - 1, d);
};

const textoFechaLarga = (fecha?: string | null) => {
    const date = parseFechaLocal(fecha);

    if (!date) return '';

    return `${dias[date.getDay()]} ${String(date.getDate()).padStart(2, '0')} DE ${meses[date.getMonth()]} DE ${date.getFullYear()}`;
};

const textoPeriodo = (filtros: FiltrosReporte, filas: FilaResumen[]) => {
    let inicio = filtros.fechaInicio || filas[0]?.fecha_original || '';
    let fin = filtros.fechaFin || filas[filas.length - 1]?.fecha_original || inicio;

    if (!inicio && !fin) return '';

    if (!fin) fin = inicio;

    if (inicio === fin) {
        return textoFechaLarga(inicio);
    }

    return `DEL ${textoFechaLarga(inicio)} AL ${textoFechaLarga(fin)}`;
};

const calcularTotales = (filas: FilaResumen[]): TotalesResumen => {
    return filas.reduce(
        (acc, fila) => {
            acc.transito += Number(fila.transito || 0);
            acc.guarda += Number(fila.guarda || 0);
            acc.aerotaxi += Number(fila.aerotaxi || 0);
            acc.handling += Number(fila.handling || 0);
            acc.mantenimiento += Number(fila.mantenimiento || 0);
            acc.total_operaciones += operacionesDeLaFila(fila);
            acc.total_pax_dia += Number(fila.total_pax_dia || 0);
            return acc;
        },
        {
            transito: 0,
            guarda: 0,
            aerotaxi: 0,
            handling: 0,
            mantenimiento: 0,
            total_operaciones: 0,
            total_pax_dia: 0,
        }
    );
};

const ReporteRapidoOperacionesDocument = ({
    filas,
    totales,
    filtros,
}: {
    filas: FilaResumen[];
    totales: TotalesResumen;
    filtros: FiltrosReporte;
}) => {
    return (
        <Document>
            <Page size="LETTER" orientation="portrait" style={styles.page}>
                <Text style={styles.title}>Resumen Semanal de Operaciones</Text>

                <Text style={styles.subtitle}>{textoPeriodo(filtros, filas)}</Text>

                <View style={styles.table}>
                    <View style={styles.row}>
                        <View style={[styles.headerCell, styles.colFecha]}>
                            <Text style={styles.headerText}>Fecha</Text>
                        </View>

                        <View style={[styles.headerCell, styles.colTransito]}>
                            <Text style={styles.headerText}>Transito</Text>
                        </View>

                        <View style={[styles.headerCell, styles.colGuarda]}>
                            <Text style={styles.headerText}>Guarda</Text>
                        </View>

                        <View style={[styles.headerCell, styles.colAerotaxi]}>
                            <Text style={styles.headerText}>Aerotaxi</Text>
                        </View>

                        <View style={[styles.headerCell, styles.colHandling]}>
                            <Text style={styles.headerText}>Handling</Text>
                        </View>

                        <View style={[styles.headerCell, styles.colMantenimiento]}>
                            <Text style={styles.headerText}>Mantenimiento</Text>
                        </View>

                        <View style={[styles.headerCell, styles.colTotalOperaciones]}>
                            <Text style={styles.headerText}>Total de{'\n'}Operaciones</Text>
                        </View>

                        <View style={[styles.headerCellLast, styles.colTotal]}>
                            <Text style={styles.headerText}>Total{'\n'}Pax por{'\n'}Dia</Text>
                        </View>
                    </View>

                    {filas.map((fila, index) => (
                        <View style={styles.row} key={`${fila.fecha}-${index}`}>
                            <View style={[styles.bodyCellFecha, styles.colFecha]}>
                                <Text style={styles.bodyTextFecha}>{fila.fecha}</Text>
                            </View>

                            <View style={[styles.bodyCell, styles.colTransito]}>
                                <Text style={styles.bodyText}>{fila.transito}</Text>
                            </View>

                            <View style={[styles.bodyCell, styles.colGuarda]}>
                                <Text style={styles.bodyText}>{fila.guarda}</Text>
                            </View>

                            <View style={[styles.bodyCell, styles.colAerotaxi]}>
                                <Text style={styles.bodyText}>{fila.aerotaxi}</Text>
                            </View>

                            <View style={[styles.bodyCell, styles.colHandling]}>
                                <Text style={styles.bodyText}>{fila.handling}</Text>
                            </View>

                            <View style={[styles.bodyCell, styles.colMantenimiento]}>
                                <Text style={styles.bodyText}>{fila.mantenimiento}</Text>
                            </View>

                            <View style={[styles.bodyCell, styles.colTotalOperaciones]}>
                                <Text style={styles.bodyText}>{operacionesDeLaFila(fila)}</Text>
                            </View>

                            <View style={[styles.bodyCellLast, styles.colTotal]}>
                                <Text style={styles.bodyText}>{fila.total_pax_dia}</Text>
                            </View>
                        </View>
                    ))}

                    <View style={styles.row}>
                        <View style={[styles.totalCellFecha, styles.colFecha]}>
                            <Text style={styles.totalText}>Total{'\n'}General</Text>
                        </View>

                        <View style={[styles.totalCell, styles.colTransito]}>
                            <Text style={styles.totalText}>{totales.transito}</Text>
                        </View>

                        <View style={[styles.totalCell, styles.colGuarda]}>
                            <Text style={styles.totalText}>{totales.guarda}</Text>
                        </View>

                        <View style={[styles.totalCell, styles.colAerotaxi]}>
                            <Text style={styles.totalText}>{totales.aerotaxi}</Text>
                        </View>

                        <View style={[styles.totalCell, styles.colHandling]}>
                            <Text style={styles.totalText}>{totales.handling}</Text>
                        </View>

                        <View style={[styles.totalCell, styles.colMantenimiento]}>
                            <Text style={styles.totalText}>{totales.mantenimiento}</Text>
                        </View>

                        <View style={[styles.totalCell, styles.colTotalOperaciones]}>
                            <Text style={styles.totalText}>{totales.total_operaciones}</Text>
                        </View>

                        <View style={[styles.totalCellLast, styles.colTotal]}>
                            <Text style={styles.totalText}>{totales.total_pax_dia}</Text>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export type ReporteRapidoPreparado = {
    blob: Blob;
    filas: FilaResumen[];
    totales: TotalesResumen;
};

const obtenerNombreArchivoReporteRapido = (filtros: FiltrosReporte = {}) => {
    const fechaInicio = filtros.fechaInicio || fechaHoy();
    const fechaFin = filtros.fechaFin || fechaInicio;

    return `Resumen_Semanal_Operaciones_${fechaInicio}_${fechaFin}.pdf`;
};

export const prepararReporteRapidoOperacionesPdf = async (
    filtros: FiltrosReporte = {}
): Promise<ReporteRapidoPreparado> => {
    const respuesta = await pdfOperacionesDiariasApi(filtros);

    const filas: FilaResumen[] = Array.isArray(respuesta)
        ? respuesta
        : respuesta?.data || [];

    if (!filas.length) {
        throw new Error('No hay registros para generar el reporte rápido.');
    }

    const totales: TotalesResumen = {
        ...(Array.isArray(respuesta)
            ? calcularTotales(filas)
            : respuesta?.totales || calcularTotales(filas)),
        // El total de operaciones se recalcula SIEMPRE aqui, incluso cuando los demas totales
        // vienen del servidor: ese campo no existe en su respuesta, y sin esto la celda del pie
        // saldria vacia. Ademas se suma de las mismas filas que el documento enseña, igual que el
        // total de cada renglon, asi que el pie no puede discrepar de la tabla.
        total_operaciones: filas.reduce((suma, fila) => suma + operacionesDeLaFila(fila), 0),
    };

    const blob = await pdf(
        <ReporteRapidoOperacionesDocument
            filas={filas}
            totales={totales}
            filtros={filtros}
        />
    ).toBlob();

    return {
        blob,
        filas,
        totales,
    };
};

export const descargarReporteRapidoOperacionesPdf = (
    blob: Blob,
    filtros: FiltrosReporte = {}
) => {
    saveAs(blob, obtenerNombreArchivoReporteRapido(filtros));
};

export const generarReporteRapidoOperacionesPdf = async (
    filtros: FiltrosReporte = {}
) => {
    const reporte = await prepararReporteRapidoOperacionesPdf(filtros);
    descargarReporteRapidoOperacionesPdf(reporte.blob, filtros);
};

export default generarReporteRapidoOperacionesPdf;
