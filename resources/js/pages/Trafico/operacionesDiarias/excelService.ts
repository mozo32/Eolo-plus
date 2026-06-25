import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type Operacion = {
    id: number;
    tipo?: string | null;
    matricula?: string | null;
    equipo?: string | null;
    fecha?: string | null;
    hora?: string | null;
    fecha_hora?: string | null;
    lugar?: string | null;
    tipo_operacion?: string | null;
    pax?: number | string | null;
    equipaje?: number | string | null;
    tipo_cliente?: string | null;
    mantenimiento_csae?: boolean | number | null;
    fecha_hora_csae?: string | null;
    fecha_hora_llegada_csae?: string | null;
    fecha_hora_salida_csae?: string | null;
};

type FilaOperacion = {
    llegada: Operacion | null;
    salida: Operacion | null;
};

const parseStringToDate = (dateString?: string | null): Date | null => {
    if (!dateString) return null;

    const texto = String(dateString).trim();

    const formatoLatino = texto.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
    );

    if (formatoLatino) {
        const day = Number(formatoLatino[1]);
        const month = Number(formatoLatino[2]) - 1;
        const year = Number(formatoLatino[3]);
        let hours = Number(formatoLatino[4]);
        const minutes = Number(formatoLatino[5]);
        const seconds = Number(formatoLatino[6] ?? 0);
        const ampm = formatoLatino[7]?.toUpperCase();

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const date = new Date(year, month, day, hours, minutes, seconds);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    const formatoBaseDatos = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/
    );

    if (formatoBaseDatos) {
        const year = Number(formatoBaseDatos[1]);
        const month = Number(formatoBaseDatos[2]) - 1;
        const day = Number(formatoBaseDatos[3]);
        const hours = Number(formatoBaseDatos[4]);
        const minutes = Number(formatoBaseDatos[5]);
        const seconds = Number(formatoBaseDatos[6] ?? 0);

        const date = new Date(year, month, day, hours, minutes, seconds);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
};

const formatearFechaHoraExcel = (date: Date | null): number | string => {
    if (!date) return "";

    const excelEpoch = Date.UTC(1899, 11, 30);

    const fechaLocalComoUtc = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    );

    return (fechaLocalComoUtc - excelEpoch) / 86400000;
};

const obtenerFechaOperacion = (operacion?: Operacion | null): Date | null => {
    if (!operacion) return null;

    const fechaFormateada = parseStringToDate(operacion.fecha_hora);

    if (fechaFormateada) {
        return fechaFormateada;
    }

    if (!operacion.fecha || !operacion.hora) {
        return null;
    }

    const fecha = String(operacion.fecha).split('T')[0];
    const hora = String(operacion.hora);

    return parseStringToDate(`${fecha} ${hora}`);
};

const obtenerMatriculaKey = (operacion: Operacion) => {
    const matricula = String(operacion.matricula ?? '').trim().toUpperCase();

    if (matricula) {
        return matricula;
    }

    return `SIN-MATRICULA-${operacion.id}`;
};

const agruparOperaciones = (registros: Operacion[]): FilaOperacion[] => {
    const operacionesOrdenadas = [...registros].sort((a, b) => {
        const fechaA = obtenerFechaOperacion(a)?.getTime() ?? 0;
        const fechaB = obtenerFechaOperacion(b)?.getTime() ?? 0;

        if (fechaA !== fechaB) {
            return fechaA - fechaB;
        }

        return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

    const filas: FilaOperacion[] = [];
    const llegadasPendientes = new Map<string, FilaOperacion[]>();

    operacionesOrdenadas.forEach((operacion) => {
        const tipo = String(operacion.tipo ?? '').trim().toLowerCase();
        const key = obtenerMatriculaKey(operacion);

        if (tipo === 'llegada') {
            const fila: FilaOperacion = {
                llegada: operacion,
                salida: null,
            };

            filas.push(fila);

            const pendientes = llegadasPendientes.get(key) ?? [];
            pendientes.push(fila);
            llegadasPendientes.set(key, pendientes);

            return;
        }

        if (tipo === 'salida') {
            const pendientes = llegadasPendientes.get(key) ?? [];
            const llegadaDisponible = pendientes.shift();

            if (llegadaDisponible) {
                llegadaDisponible.salida = operacion;
                llegadasPendientes.set(key, pendientes);
            } else {
                filas.push({
                    llegada: null,
                    salida: operacion,
                });
            }
        }
    });

    return filas.sort((a, b) => {
        const fechaA = obtenerFechaOperacion(a.llegada ?? a.salida)?.getTime() ?? 0;
        const fechaB = obtenerFechaOperacion(b.llegada ?? b.salida)?.getTime() ?? 0;

        return fechaA - fechaB;
    });
};

const formatearEstancia = (
    fechaEntrada: Date | null,
    fechaSalida: Date | null,
    mensajeEntradaPendiente = 'Llegada pendiente',
    mensajeSalidaPendiente = 'Salida pendiente'
): string => {
    if (!fechaEntrada && fechaSalida) {
        return mensajeEntradaPendiente;
    }

    if (fechaEntrada && !fechaSalida) {
        return mensajeSalidaPendiente;
    }

    if (!fechaEntrada || !fechaSalida) {
        return '';
    }

    const diferencia = fechaSalida.getTime() - fechaEntrada.getTime();

    if (diferencia < 0) {
        return 'Revisar fechas';
    }

    const minutosTotales = Math.floor(diferencia / 60000);
    const pernoctas = Math.floor(minutosTotales / 1440);
    const minutosRestantes = minutosTotales % 1440;
    const horas = Math.floor(minutosRestantes / 60);
    const minutos = minutosRestantes % 60;

    const textoPernoctas = pernoctas === 1 ? '1 pernocta' : `${pernoctas} pernoctas`;

    return `${textoPernoctas}, ${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')} hrs`;
};

const obtenerFechaCsaeEntrada = (fila: FilaOperacion): Date | null => {
    const valor =
        fila.llegada?.fecha_hora_llegada_csae ??
        fila.llegada?.fecha_hora_csae ??
        fila.salida?.fecha_hora_llegada_csae ??
        fila.salida?.fecha_hora_csae ??
        null;

    return parseStringToDate(valor);
};

const obtenerFechaCsaeSalida = (fila: FilaOperacion): Date | null => {
    const valor =
        fila.salida?.fecha_hora_salida_csae ??
        fila.llegada?.fecha_hora_salida_csae ??
        null;

    return parseStringToDate(valor);
};

const valorNumero = (valor: number | string | null | undefined) => {
    if (valor === null || valor === undefined || valor === '') {
        return 0;
    }

    const numero = Number(valor);
    return Number.isNaN(numero) ? valor : numero;
};

export const exportarOperacionesAExcel = async (
    registros: Operacion[],
    filtros: any = {}
) => {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Eolo Plus';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Reporte de Operaciones', {
        views: [
            {
                state: 'frozen',
                xSplit: 3,
                ySplit: 5,
            },
        ],
    });

    const filas = agruparOperaciones(registros);

    const totalColumns = 21;

    const headers = [
        'ID',
        'MATRÍCULA',
        'EQUIPO',
        'ID LLEGADA',
        'FECHA-HORA LLEGADA',
        'ORIGEN',
        'TIPO DE OPERACIÓN',
        'PAX',
        'EQP',
        'ID SALIDA',
        'FECHA-HORA SALIDA',
        'DESTINO',
        'TIPO DE OPERACIÓN',
        'PAX',
        'EQP',
        'TIPO DE CLIENTE',
        'ESTANCIA',
        'MANTENIMIENTO CSAE',
        'FECHA-HORA LLEGADA CSAE',
        'FECHA-HORA SALIDA CSAE',
        'ESTANCIA CSAE',
    ];

    const border: Partial<ExcelJS.Borders> = {
        top: {
            style: 'thin',
            color: { argb: 'FFCBD5E1' },
        },
        left: {
            style: 'thin',
            color: { argb: 'FFCBD5E1' },
        },
        bottom: {
            style: 'thin',
            color: { argb: 'FFCBD5E1' },
        },
        right: {
            style: 'thin',
            color: { argb: 'FFCBD5E1' },
        },
    };

    const alignment: Partial<ExcelJS.Alignment> = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
    };

    const baseHeaderFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCE6F1' },
    };

    const arrivalHeaderFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9FBE5' },
    };

    const departureHeaderFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE0E0' },
    };

    const csaeHeaderFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E3F3' },
    };

    const baseBodyFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
    };

    const arrivalBodyFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' },
    };

    const departureBodyFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' },
    };

    const csaeBodyFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7F4FC' },
    };

    worksheet.mergeCells(1, 1, 1, totalColumns);

    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = 'REPORTE DETALLADO DE OPERACIONES DIARIAS';
    titleCell.font = {
        name: 'Arial',
        size: 16,
        bold: true,
        color: { argb: 'FF0369A1' },
    };
    titleCell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
    };

    worksheet.getRow(1).height = 34;

    const fechaGeneracion = new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    worksheet.mergeCells(2, 1, 2, totalColumns);

    const fechaCell = worksheet.getCell(2, 1);
    fechaCell.value = `Fecha de reporte: ${fechaGeneracion}`;
    fechaCell.font = {
        size: 10,
        color: { argb: 'FF475569' },
    };
    fechaCell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
    };

    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 8;

    worksheet.mergeCells(4, 4, 4, 9);
    worksheet.mergeCells(4, 10, 4, 15);
    worksheet.mergeCells(4, 18, 4, 21);

    const llegadaGroup = worksheet.getCell(4, 4);
    llegadaGroup.value = 'LLEGADAS';
    llegadaGroup.fill = arrivalHeaderFill;
    llegadaGroup.font = {
        bold: true,
        size: 11,
        color: { argb: 'FF166534' },
    };
    llegadaGroup.alignment = alignment;
    llegadaGroup.border = border;

    const salidaGroup = worksheet.getCell(4, 10);
    salidaGroup.value = 'SALIDAS';
    salidaGroup.fill = departureHeaderFill;
    salidaGroup.font = {
        bold: true,
        size: 11,
        color: { argb: 'FFB91C1C' },
    };
    salidaGroup.alignment = alignment;
    salidaGroup.border = border;

    const csaeGroup = worksheet.getCell(4, 18);
    csaeGroup.value = 'CSAE';
    csaeGroup.fill = csaeHeaderFill;
    csaeGroup.font = {
        bold: true,
        size: 11,
        color: { argb: 'FF5B3F8C' },
    };
    csaeGroup.alignment = alignment;
    csaeGroup.border = border;

    const headerRow = worksheet.getRow(5);
    headerRow.height = 42;

    headers.forEach((header, index) => {
        const columnNumber = index + 1;
        const cell = headerRow.getCell(columnNumber);

        cell.value = header;
        cell.border = border;
        cell.alignment = alignment;
        cell.font = {
            bold: true,
            size: 9,
            color: { argb: 'FF0F172A' },
        };

        if (columnNumber >= 4 && columnNumber <= 9) {
            cell.fill = arrivalHeaderFill;
            cell.font = {
                bold: true,
                size: 9,
                color: { argb: 'FF166534' },
            };
        } else if (columnNumber >= 10 && columnNumber <= 15) {
            cell.fill = departureHeaderFill;
            cell.font = {
                bold: true,
                size: 9,
                color: { argb: 'FFB91C1C' },
            };
        } else if (columnNumber >= 18 && columnNumber <= 21) {
            cell.fill = csaeHeaderFill;
            cell.font = {
                bold: true,
                size: 9,
                color: { argb: 'FF5B3F8C' },
            };
        } else {
            cell.fill = baseHeaderFill;
        }
    });

    const columnWidths = [
        9,
        15,
        12,
        12,
        21,
        14,
        18,
        8,
        8,
        12,
        21,
        14,
        18,
        8,
        8,
        17,
        24,
        18,
        22,
        22,
        22,
    ];

    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    worksheet.getColumn(5).numFmt = 'dd/mm/yyyy hh:mm';
    worksheet.getColumn(11).numFmt = 'dd/mm/yyyy hh:mm';
    worksheet.getColumn(19).numFmt = 'dd/mm/yyyy hh:mm';
    worksheet.getColumn(20).numFmt = 'dd/mm/yyyy hh:mm';

    filas.forEach((fila, index) => {
        const llegada = fila.llegada;
        const salida = fila.salida;

        const fechaLlegada = obtenerFechaOperacion(llegada);
        const fechaSalida = obtenerFechaOperacion(salida);
        const fechaCsaeEntrada = obtenerFechaCsaeEntrada(fila);
        const fechaCsaeSalida = obtenerFechaCsaeSalida(fila);

        const mantenimientoCsae = Boolean(
            llegada?.mantenimiento_csae ||
            salida?.mantenimiento_csae ||
            fechaCsaeEntrada ||
            fechaCsaeSalida
        );

        const values = [
            index + 1,
            llegada?.matricula ?? salida?.matricula ?? '',
            llegada?.equipo ?? salida?.equipo ?? '',
            llegada?.id ?? '',
            formatearFechaHoraExcel(fechaLlegada),
            llegada?.lugar ?? '',
            llegada?.tipo_operacion ?? '',
            llegada ? valorNumero(llegada.pax) : '',
            llegada ? valorNumero(llegada.equipaje) : '',
            salida?.id ?? '',
            formatearFechaHoraExcel(fechaSalida),
            salida?.lugar ?? '',
            salida?.tipo_operacion ?? '',
            salida ? valorNumero(salida.pax) : '',
            salida ? valorNumero(salida.equipaje) : '',
            llegada?.tipo_cliente ?? salida?.tipo_cliente ?? '',
            formatearEstancia(fechaLlegada, fechaSalida),
            mantenimientoCsae ? 'SI' : 'NO',
            formatearFechaHoraExcel(fechaCsaeEntrada),
            formatearFechaHoraExcel(fechaCsaeSalida),
            mantenimientoCsae ? formatearEstancia(fechaCsaeEntrada, fechaCsaeSalida) : '',
        ];

        const rowNumber = index + 6;
        const row = worksheet.getRow(rowNumber);

        row.height = 25;

        values.forEach((value, valueIndex) => {
            const columnNumber = valueIndex + 1;
            const cell = row.getCell(columnNumber);

            cell.value = value;

            if ([5, 11, 19, 20].includes(columnNumber) && typeof value === 'number') {
                cell.numFmt = 'dd/mm/yyyy hh:mm';
            }

            cell.border = border;
            cell.alignment = alignment;
            cell.font = {
                size: 9,
                color: { argb: 'FF0F172A' },
            };

            if (columnNumber >= 4 && columnNumber <= 9) {
                cell.fill = arrivalBodyFill;
            } else if (columnNumber >= 10 && columnNumber <= 15) {
                cell.fill = departureBodyFill;
            } else if (columnNumber >= 18 && columnNumber <= 21) {
                cell.fill = csaeBodyFill;
            } else {
                cell.fill = baseBodyFill;
            }
        });

        if (!llegada && salida) {
            const estanciaCell = row.getCell(17);
            estanciaCell.font = {
                size: 9,
                bold: true,
                color: { argb: 'FFB91C1C' },
            };
            estanciaCell.fill = departureHeaderFill;
        }

        if (llegada && !salida) {
            const estanciaCell = row.getCell(17);
            estanciaCell.font = {
                size: 9,
                bold: true,
                color: { argb: 'FFB91C1C' },
            };
            estanciaCell.fill = departureHeaderFill;
        }

        if (mantenimientoCsae && fechaCsaeEntrada && !fechaCsaeSalida) {
            const estanciaCsaeCell = row.getCell(21);
            estanciaCsaeCell.font = {
                size: 9,
                bold: true,
                color: { argb: 'FFB91C1C' },
            };
        }
    });

    worksheet.autoFilter = {
        from: {
            row: 5,
            column: 1,
        },
        to: {
            row: 5,
            column: totalColumns,
        },
    };

    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.25,
            right: 0.25,
            top: 0.4,
            bottom: 0.4,
            header: 0.2,
            footer: 0.2,
        },
    };

    worksheet.pageSetup.printArea = `A1:U${Math.max(6, filas.length + 5)}`;

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const fechaHoy = new Date().toLocaleDateString('en-CA');

    saveAs(blob, `Reporte_Operaciones_${fechaHoy}.xlsx`);
};
