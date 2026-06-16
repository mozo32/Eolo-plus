import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const parseStringToDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
        const parts = dateString.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)\s*(AM|PM)?/i);
        if (!parts) return null;

        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        const year = parseInt(parts[3], 10);
        let hours = parseInt(parts[4], 10);
        const minutes = parseInt(parts[5], 10);
        const seconds = parseInt(parts[6], 10);
        const ampm = parts[7]?.toUpperCase();

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const date = new Date(year, month, day, hours, minutes, seconds);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
};

export const exportarOperacionesAExcel = async (
    registros: any[],
    filtros: any = {}
) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Operaciones');

    const headers = [
        'ID',
        'TIPO',
        'MATRÍCULA',
        'EQUIPO',
        'FECHA-HORA',
        'ORIGEN/DESTINO',
        'TIPO DE OPERACIÓN',
        'PAX',
        'EQP',
        'TIPO DE CLIENTE',
        'MANTENIMIENTO CSAE',
        'FECHA-HORA CSAE'
    ];

    const totalColumns = 25; // A:Y
    const leftStartCol = 1;  // A
    const rightStartCol = 14; // N
    const spacerCol = 13; // M

    worksheet.mergeCells(1, 1, 1, totalColumns);
    const mainTitle = worksheet.getCell('A1');
    mainTitle.value = 'REPORTE DETALLADO DE OPERACIONES DIARIAS';
    mainTitle.font = {
        name: 'Arial Black',
        size: 16,
        color: { argb: 'FF0369A1' }
    };
    mainTitle.alignment = {
        horizontal: 'center',
        vertical: 'middle'
    };
    worksheet.getRow(1).height = 35;

    const fechaGeneracion = new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    worksheet.mergeCells(2, 1, 2, totalColumns);
    const fechaCell = worksheet.getCell('A2');
    fechaCell.value = `Fecha Reporte: ${fechaGeneracion}`;
    fechaCell.font = {
        size: 10,
        color: { argb: 'FF374151' }
    };
    fechaCell.alignment = {
        horizontal: 'left',
        vertical: 'middle'
    };
    worksheet.getRow(2).height = 20;

    worksheet.mergeCells(3, 1, 3, totalColumns);
    worksheet.getRow(3).height = 12;

    const baseBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const headerBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF00556F' } },
        left: { style: 'thin', color: { argb: 'FF00556F' } },
        bottom: { style: 'thin', color: { argb: 'FF00556F' } },
        right: { style: 'thin', color: { argb: 'FF00556F' } }
    };

    const baseAlignment: Partial<ExcelJS.Alignment> = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
    };

    const whiteFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
    };

    const purpleFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F0FA' }
    };

    const greenFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2FCE7' }
    };

    const redFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' }
    };

    const greenFont = {
        color: { argb: 'FF166534' },
        bold: true
    };

    const redFont = {
        color: { argb: 'FF991B1B' },
        bold: true
    };

    const tableTitleFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F2FE' }
    } as ExcelJS.Fill;

    const tableTitleFont = {
        bold: true,
        size: 13,
        color: { argb: 'FF003E51' }
    };

    const csaeFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9E5F3' }
    } as ExcelJS.Fill;

    const csaeFont = {
        bold: true,
        color: { argb: 'FF5B3F8C' },
        size: 11
    };

    const columnWidths = [8, 15, 18, 18, 28, 25, 25, 10, 10, 22, 20, 28];

    const aplicarAnchos = (startCol: number) => {
        columnWidths.forEach((width, index) => {
            worksheet.getColumn(startCol + index).width = width;
        });
    };

    aplicarAnchos(leftStartCol);
    aplicarAnchos(rightStartCol);
    worksheet.getColumn(spacerCol).width = 4;

    const prepararTabla = (
        titulo: string,
        startCol: number,
        tipo: 'llegada' | 'salida'
    ) => {
        const endCol = startCol + headers.length - 1;
        const titleRow = 4;
        const csaeRow = 5;
        const headerRowNumber = 6;

        worksheet.mergeCells(titleRow, startCol, titleRow, endCol);
        const titleCell = worksheet.getCell(titleRow, startCol);
        titleCell.value = titulo;
        titleCell.font = tableTitleFont;
        titleCell.fill = tableTitleFill;
        titleCell.alignment = {
            horizontal: 'center',
            vertical: 'middle'
        };
        titleCell.border = baseBorder;
        worksheet.getRow(titleRow).height = 24;

        worksheet.mergeCells(csaeRow, startCol + 10, csaeRow, startCol + 11);
        const csaeGroupCell = worksheet.getCell(csaeRow, startCol + 10);
        csaeGroupCell.value = 'CSAE';
        csaeGroupCell.font = csaeFont;
        csaeGroupCell.alignment = {
            horizontal: 'center',
            vertical: 'middle'
        };
        csaeGroupCell.fill = csaeFill;
        csaeGroupCell.border = baseBorder;

        const headerRow = worksheet.getRow(headerRowNumber);

        headers.forEach((header, index) => {
            const cell = headerRow.getCell(startCol + index);
            cell.value = header;

            if (index >= 10) {
                cell.fill = csaeFill;
                cell.font = csaeFont;
            } else {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: tipo === 'llegada'
                        ? { argb: 'FF166534' }
                        : { argb: 'FF991B1B' }
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true,
                    size: 11
                };
            }

            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };

            cell.border = headerBorder;
        });

        headerRow.height = 32;
    };

    prepararTabla('LLEGADAS', leftStartCol, 'llegada');
    prepararTabla('SALIDAS', rightStartCol, 'salida');

    const mapRegistro = (op: any) => {
        const fechaHoraObj = parseStringToDate(op.fecha_hora);
        const fechaHoraCsaeObj = parseStringToDate(op.fecha_hora_csae);

        return [
            op.id,
            op.tipo?.toUpperCase() || '',
            op.matricula || '',
            op.equipo || '',
            fechaHoraObj || op.fecha_hora || '',
            op.lugar || '',
            op.tipo_operacion || '',
            op.pax || 0,
            op.equipaje || 0,
            op.tipo_cliente || '',
            op.mantenimiento_csae ? 'SI' : 'NO',
            fechaHoraCsaeObj || op.fecha_hora_csae || ''
        ];
    };

    const llegadas = registros
        .filter((op) => op.tipo?.toLowerCase() === 'llegada')
        .map(mapRegistro);

    const salidas = registros
        .filter((op) => op.tipo?.toLowerCase() === 'salida')
        .map(mapRegistro);

    const pintarFilaTabla = (
        row: ExcelJS.Row,
        startCol: number,
        values: any[] | null,
        tipo: 'llegada' | 'salida'
    ) => {
        for (let i = 0; i < headers.length; i++) {
            const colNumber = startCol + i;
            const cell = row.getCell(colNumber);

            cell.value = values ? values[i] : '';
            cell.border = baseBorder;
            cell.alignment = baseAlignment;

            if ((i === 4 || i === 11) && cell.value instanceof Date) {
                cell.numFmt = 'dd/mm/yyyy hh:mm';
            }

            if (i >= 10) {
                cell.fill = purpleFill;
            } else if (i === 1) {
                cell.fill = tipo === 'llegada' ? greenFill : redFill;
                cell.font = tipo === 'llegada' ? greenFont : redFont;
            } else {
                cell.fill = whiteFill;
            }
        }
    };

    const startDataRow = 7;
    const maxRows = Math.max(llegadas.length, salidas.length);

    for (let i = 0; i < maxRows; i++) {
        const row = worksheet.getRow(startDataRow + i);
        row.height = 22;

        pintarFilaTabla(row, leftStartCol, llegadas[i] || null, 'llegada');
        pintarFilaTabla(row, rightStartCol, salidas[i] || null, 'salida');

        row.commit();
    }

    worksheet.views = [
        {
            state: 'frozen',
            ySplit: 6
        }
    ];

    worksheet.autoFilter = {
        from: {
            row: 6,
            column: 1
        },
        to: {
            row: 6,
            column: 12
        }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fechaHoy = new Date().toLocaleDateString('en-CA');
    saveAs(blob, `Reporte_Operaciones_${fechaHoy}.xlsx`);
};
