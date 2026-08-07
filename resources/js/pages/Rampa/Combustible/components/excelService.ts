import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MESES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
] as const;

const NOMBRES_DRENES: Record<number, string> = {
    1: 'Delantero del tanque',
    2: 'Strainer',
    3: 'Succión auxiliar',
    4: 'Trasero del tanque',
    5: 'Entrada a elementos filtrantes',
    6: 'Salida de elementos filtrantes'
};

export const INSPECCIONES_EXCEL_COLORS = {
    title: '1F4E79',
    header: '2F5597',
    monthText: '1F4E79',
    monthFill: 'E8F1FA',
    border: 'E5E7EB',
    white: 'FFFFFF'
} as const;

export const COMBUSTIBLE_EXCEL = {
    nombre: 'Combustible',
    titulo: 'REPORTE DE INSPECCIONES DE COMBUSTIBLE',
    headers: ['ID', 'MES', 'FECHA', 'PRUEBA REALIZADA', 'RESULTADO'],
    widths: [10, 15, 25, 30, 30]
} as const;

export const AUTOTANQUE_INSPECCIONES_EXCEL = {
    nombre: 'Autotanque',
    titulo: 'REPORTE DE INSPECCIONES AUTOTANQUE',
    headers: [
        'ID',
        'MES',
        'FECHA',
        'NOMBRE DEL DREN',
        'TOMA MUESTRA',
        'CLARIDAD',
        'SÓLIDOS/AGUA'
    ],
    widths: [10, 15, 25, 30, 22, 28, 28]
} as const;

export interface DetalleCombustibleExcel {
    prueba: string;
    resultado: string;
}

export interface DetalleAutotanqueInspeccionExcel {
    nombreDren: string;
    tomaMuestra: string;
    claridad: string;
    solidosAgua: string;
}

export interface InspeccionAgrupadaExcel<TDetalle> {
    id: number | string;
    mes: string;
    fecha: Date | null;
    detalles: TDetalle[];
}

export interface SeccionMesExcel<TDetalle> {
    mes: string;
    inspecciones: InspeccionAgrupadaExcel<TDetalle>[];
}

export interface ReporteInspeccionesExcel {
    blob: Blob;
    generado: string;
    combustible: {
        secciones: SeccionMesExcel<DetalleCombustibleExcel>[];
        totalInspecciones: number;
        totalFilas: number;
    };
    autotanque: {
        secciones: SeccionMesExcel<DetalleAutotanqueInspeccionExcel>[];
        totalInspecciones: number;
        totalFilas: number;
    };
}

const toArgb = (hex: string) => `FF${hex}`;

const parsearFechaSegura = (value: any): Date | null => {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(Date.UTC(
            value.getFullYear(),
            value.getMonth(),
            value.getDate(),
            value.getHours(),
            value.getMinutes(),
            0
        ));
    }

    const texto = String(value).trim();
    const match = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/
    );

    if (match) {
        const [, anio, mes, dia, hora = '00', minuto = '00'] = match;

        return new Date(Date.UTC(
            Number(anio),
            Number(mes) - 1,
            Number(dia),
            Number(hora),
            Number(minuto),
            0
        ));
    }

    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) return null;

    return new Date(Date.UTC(
        fecha.getFullYear(),
        fecha.getMonth(),
        fecha.getDate(),
        fecha.getHours(),
        fecha.getMinutes(),
        0
    ));
};

const obtenerMes = (fecha: any): string => {
    const fechaSegura = parsearFechaSegura(fecha);
    return fechaSegura ? MESES[fechaSegura.getUTCMonth()] : '';
};

export const formatearFechaInspeccionExcel = (fecha: Date | null): string => {
    if (!fecha) return '';

    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const anio = fecha.getUTCFullYear();
    const hora = String(fecha.getUTCHours()).padStart(2, '0');
    const minuto = String(fecha.getUTCMinutes()).padStart(2, '0');

    return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
};

const estiloTitulo = (cell: ExcelJS.Cell) => {
    cell.font = {
        bold: true,
        size: 16,
        color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.white) }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.title) }
    };
};

const estiloHeader = (cell: ExcelJS.Cell) => {
    cell.font = {
        bold: true,
        color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.white) },
        size: 11
    };
    cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.header) }
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
};

const estiloFila = (cell: ExcelJS.Cell) => {
    const colorBorde = { argb: toArgb(INSPECCIONES_EXCEL_COLORS.border) };

    cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
    };
    cell.border = {
        top: { style: 'thin', color: colorBorde },
        left: { style: 'thin', color: colorBorde },
        bottom: { style: 'thin', color: colorBorde },
        right: { style: 'thin', color: colorBorde }
    };
};

const aplicarFormatoFecha = (cell: ExcelJS.Cell) => {
    if (cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy hh:mm';
    }
};

const combinarCeldasPorId = (
    worksheet: ExcelJS.Worksheet,
    filaInicio: number,
    filaFin: number,
    columnasACombinar: number[] = [1, 2, 3]
) => {
    let inicioGrupo = 0;
    let idActual: any = null;

    const esFilaDeDatos = (fila: number) => {
        const valorId = worksheet.getCell(fila, 1).value;

        return valorId !== null &&
            valorId !== undefined &&
            valorId !== '' &&
            !Number.isNaN(Number(valorId));
    };

    const cerrarGrupo = (finGrupo: number) => {
        if (inicioGrupo > 0 && inicioGrupo < finGrupo) {
            columnasACombinar.forEach((columna) => {
                worksheet.mergeCells(inicioGrupo, columna, finGrupo, columna);

                const celda = worksheet.getCell(inicioGrupo, columna);
                celda.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true
                };
                celda.border = {
                    top: {
                        style: 'thin',
                        color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.border) }
                    },
                    left: {
                        style: 'thin',
                        color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.border) }
                    },
                    bottom: {
                        style: 'thin',
                        color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.border) }
                    },
                    right: {
                        style: 'thin',
                        color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.border) }
                    }
                };
            });
        }
    };

    for (let fila = filaInicio; fila <= filaFin + 1; fila++) {
        if (fila > filaFin || !esFilaDeDatos(fila)) {
            cerrarGrupo(fila - 1);
            inicioGrupo = 0;
            idActual = null;
            continue;
        }

        const idFila = worksheet.getCell(fila, 1).value;

        if (inicioGrupo === 0) {
            inicioGrupo = fila;
            idActual = idFila;
            continue;
        }

        if (idFila !== idActual) {
            cerrarGrupo(fila - 1);
            inicioGrupo = fila;
            idActual = idFila;
        }
    }
};

const agruparPorMes = (registros: any[]): Map<string, any[]> => {
    const grupos = new Map<string, any[]>();

    registros.forEach((item) => {
        const mes = obtenerMes(item.fecha);
        const grupo = grupos.get(mes) ?? [];
        grupo.push(item);
        grupos.set(mes, grupo);
    });

    return grupos;
};

const crearSeccionesCombustible = (
    registros: any[]
): SeccionMesExcel<DetalleCombustibleExcel>[] =>
    Array.from(agruparPorMes(registros).entries()).map(([mes, items]) => ({
        mes,
        inspecciones: items.map((item) => ({
            id: item.id,
            mes,
            fecha: parsearFechaSegura(item.fecha),
            detalles: (Array.isArray(item.imagenes) ? item.imagenes : []).map(
                (imagen: any) => ({
                    prueba: imagen.pivot?.tag || '',
                    resultado: imagen.pivot?.observacion || ''
                })
            )
        }))
    }));

const crearSeccionesAutotanque = (
    registros: any[]
): SeccionMesExcel<DetalleAutotanqueInspeccionExcel>[] =>
    Array.from(agruparPorMes(registros).entries()).map(([mes, items]) => ({
        mes,
        inspecciones: items.map((item) => {
            const detalles: DetalleAutotanqueInspeccionExcel[] = [];

            for (let indice = 1; indice <= 6; indice++) {
                const tomaMuestra =
                    item[`toma_muestra_combustible_dren_${indice}`] || '';
                const tomaEsNo =
                    String(tomaMuestra).trim().toLowerCase() === 'no';

                detalles.push({
                    nombreDren: NOMBRES_DRENES[indice]
                        ? `Dren ${indice}: ${NOMBRES_DRENES[indice]}`
                        : `Dren ${indice}`,
                    tomaMuestra,
                    claridad: tomaEsNo
                        ? 'No se realizaron pruebas'
                        : item[`prueba_claridad_brillantez_dren_${indice}`] || '',
                    solidosAgua: tomaEsNo
                        ? 'No se realizaron pruebas'
                        : item[`presencia_solidos_agua_dren_${indice}`] || ''
                });
            }

            return {
                id: item.id,
                mes,
                fecha: parsearFechaSegura(item.fecha),
                detalles
            };
        })
    }));

const aplicarEstiloMes = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
        cell.font = {
            bold: true,
            color: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.monthText) }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: toArgb(INSPECCIONES_EXCEL_COLORS.monthFill) }
        };
    });
};

const prepararEncabezado = (
    worksheet: ExcelJS.Worksheet,
    titulo: string,
    ultimaColumna: string,
    headers: readonly string[],
    generado: string
) => {
    worksheet.mergeCells(`A1:${ultimaColumna}1`);
    const title = worksheet.getCell('A1');
    title.value = titulo;
    estiloTitulo(title);

    worksheet.mergeCells(`A2:${ultimaColumna}2`);
    worksheet.getCell('A2').value = `Generado: ${generado}`;

    const headerRow = worksheet.addRow([...headers]);
    headerRow.eachCell(estiloHeader);
};

const agregarCombustible = (
    worksheet: ExcelJS.Worksheet,
    secciones: SeccionMesExcel<DetalleCombustibleExcel>[]
) => {
    secciones.forEach((seccion) => {
        const groupRow = worksheet.addRow([`MES: ${seccion.mes}`]);
        aplicarEstiloMes(groupRow);

        seccion.inspecciones.forEach((inspeccion) => {
            inspeccion.detalles.forEach((detalle) => {
                const row = worksheet.addRow([
                    inspeccion.id,
                    inspeccion.mes,
                    inspeccion.fecha || '',
                    detalle.prueba,
                    detalle.resultado
                ]);

                row.eachCell({ includeEmpty: true }, estiloFila);
                aplicarFormatoFecha(row.getCell(3));
            });
        });
    });
};

const agregarAutotanque = (
    worksheet: ExcelJS.Worksheet,
    secciones: SeccionMesExcel<DetalleAutotanqueInspeccionExcel>[]
) => {
    secciones.forEach((seccion) => {
        const groupRow = worksheet.addRow([`MES: ${seccion.mes}`]);
        aplicarEstiloMes(groupRow);

        seccion.inspecciones.forEach((inspeccion) => {
            inspeccion.detalles.forEach((detalle) => {
                const row = worksheet.addRow([
                    inspeccion.id,
                    inspeccion.mes,
                    inspeccion.fecha || '',
                    detalle.nombreDren,
                    detalle.tomaMuestra,
                    detalle.claridad,
                    detalle.solidosAgua
                ]);

                row.eachCell({ includeEmpty: true }, estiloFila);
                aplicarFormatoFecha(row.getCell(3));
            });
        });
    });
};

const contarFilas = <TDetalle>(secciones: SeccionMesExcel<TDetalle>[]) =>
    secciones.reduce(
        (total, seccion) =>
            total + seccion.inspecciones.reduce(
                (subtotal, inspeccion) => subtotal + inspeccion.detalles.length,
                0
            ),
        0
    );

const contarInspecciones = <TDetalle>(
    secciones: SeccionMesExcel<TDetalle>[]
) => secciones.reduce(
    (total, seccion) => total + seccion.inspecciones.length,
    0
);

export const prepararInspeccionesExcel = async (
    registros: any[]
): Promise<ReporteInspeccionesExcel> => {
    const combustible = registros.filter(
        (registro) => registro.tipo === 'COMBUSTIBLE'
    );
    const autotanque = registros.filter(
        (registro) => registro.tipo === 'AUTOTANQUE'
    );
    const seccionesCombustible = crearSeccionesCombustible(combustible);
    const seccionesAutotanque = crearSeccionesAutotanque(autotanque);
    const generado = new Date().toLocaleString('es-MX', { hour12: false });
    const workbook = new ExcelJS.Workbook();

    const wsCombustible = workbook.addWorksheet(COMBUSTIBLE_EXCEL.nombre);
    prepararEncabezado(
        wsCombustible,
        COMBUSTIBLE_EXCEL.titulo,
        'E',
        COMBUSTIBLE_EXCEL.headers,
        generado
    );
    agregarCombustible(wsCombustible, seccionesCombustible);
    combinarCeldasPorId(
        wsCombustible,
        4,
        wsCombustible.lastRow?.number ?? 4,
        [1, 2, 3]
    );
    wsCombustible.columns = COMBUSTIBLE_EXCEL.widths.map((width) => ({ width }));
    wsCombustible.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3, column: COMBUSTIBLE_EXCEL.headers.length }
    };
    wsCombustible.views = [{ state: 'frozen', ySplit: 3 }];

    const wsAutotanque = workbook.addWorksheet(
        AUTOTANQUE_INSPECCIONES_EXCEL.nombre
    );
    prepararEncabezado(
        wsAutotanque,
        AUTOTANQUE_INSPECCIONES_EXCEL.titulo,
        'G',
        AUTOTANQUE_INSPECCIONES_EXCEL.headers,
        generado
    );
    agregarAutotanque(wsAutotanque, seccionesAutotanque);
    combinarCeldasPorId(
        wsAutotanque,
        4,
        wsAutotanque.lastRow?.number ?? 4,
        [1, 2, 3]
    );
    wsAutotanque.columns = AUTOTANQUE_INSPECCIONES_EXCEL.widths.map(
        (width) => ({ width })
    );
    wsAutotanque.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3, column: AUTOTANQUE_INSPECCIONES_EXCEL.headers.length }
    };
    wsAutotanque.views = [{ state: 'frozen', ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    return {
        blob,
        generado,
        combustible: {
            secciones: seccionesCombustible,
            totalInspecciones: contarInspecciones(seccionesCombustible),
            totalFilas: contarFilas(seccionesCombustible)
        },
        autotanque: {
            secciones: seccionesAutotanque,
            totalInspecciones: contarInspecciones(seccionesAutotanque),
            totalFilas: contarFilas(seccionesAutotanque)
        }
    };
};

export const descargarInspeccionesExcel = (blob: Blob): void => {
    saveAs(
        blob,
        `Inspecciones_${new Date().toISOString().split('T')[0]}.xlsx`
    );
};

export const exportarInspeccionesExcel = async (
    registros: any[]
): Promise<void> => {
    const reporte = await prepararInspeccionesExcel(registros);
    descargarInspeccionesExcel(reporte.blob);
};
