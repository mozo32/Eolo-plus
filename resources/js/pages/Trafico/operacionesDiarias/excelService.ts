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

    worksheet.mergeCells('A1:L1');
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

    worksheet.mergeCells('A2:L2');
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

    worksheet.mergeCells('A3:L3');
    worksheet.getRow(3).height = 20;

    worksheet.mergeCells('K4:L4');
    const csaeGroupCell = worksheet.getCell('K4');
    csaeGroupCell.value = 'CSAE';
    csaeGroupCell.font = {
        bold: true,
        color: { argb: 'FF5B3F8C' },
        size: 11
    };
    csaeGroupCell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
    };
    csaeGroupCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9E5F3' }
    };
    csaeGroupCell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };

    const startRow = 5;
    const headers = [
        'ID', 'TIPO', 'MATRÍCULA', 'EQUIPO', 'FECHA-HORA', 'ORIGEN/DESTINO',
        'TIPO DE OPERACIÓN', 'PAX', 'EQP', 'TIPO DE CLIENTE', 'MANTENIMIENTO CSAE', 'FECHA-HORA CSAE'
    ];

    const headerRow = worksheet.getRow(startRow);
    headerRow.values = headers;
    headerRow.height = 30;

    headerRow.eachCell((cell) => {
        if (Number(cell.col) >= 11 && Number(cell.col) <= 12) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E5F3' } };
            cell.font = { color: { argb: 'FF5B3F8C' }, bold: true, size: 11 };
        } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003E51' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF00556F' } },
            left: { style: 'thin', color: { argb: 'FF00556F' } },
            bottom: { style: 'thin', color: { argb: 'FF00556F' } },
            right: { style: 'thin', color: { argb: 'FF00556F' } }
        };
    });

    const columnWidths = [8, 15, 18, 18, 28, 25, 25, 10, 10, 22, 20, 28];
    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    const baseBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const baseAlignment: Partial<ExcelJS.Alignment> = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
    };

    const whiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    const purpleFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F0FA' } };
    const greenFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2FCE7' } };
    const redFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

    const greenFont = { color: { argb: 'FF166534' }, bold: true };
    const redFont = { color: { argb: 'FF991B1B' }, bold: true };

    const rowsData = registros.map((op) => {
        const fechaHoraObj = parseStringToDate(op.fecha_hora);
        const fechaHoraCsaeObj = parseStringToDate(op.fecha_hora_csae);

        return {
            esLlegada: op.tipo?.toLowerCase() === 'llegada',
            values: [
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
            ]
        };
    });

    rowsData.forEach((rowDataDef) => {
        const row = worksheet.addRow(rowDataDef.values);

        for (let colNumber = 1; colNumber <= 12; colNumber++) {
            const cell = row.getCell(colNumber);

            cell.border = baseBorder;
            cell.alignment = baseAlignment;

            if (colNumber === 5 || colNumber === 12) {
                if (cell.value instanceof Date) {
                    cell.numFmt = 'dd/mm/yyyy hh:mm:ss AM/PM';
                }
            }

            if (colNumber === 11 || colNumber === 12) {
                cell.fill = purpleFill;
            } else if (colNumber === 2) {
                cell.fill = rowDataDef.esLlegada ? greenFill : redFill;
                cell.font = rowDataDef.esLlegada ? greenFont : redFont;
            } else {
                cell.fill = whiteFill;
            }
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fechaHoy = new Date().toLocaleDateString('en-CA');
    saveAs(blob, `Reporte_Operaciones_${fechaHoy}.xlsx`);
};
