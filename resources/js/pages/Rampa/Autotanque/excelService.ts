import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const parseFechaExcel = (value: any) => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
        return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), 0));
    }
    const texto = String(value).trim();
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/);
    if (match) {
        const [, y, m, d, h = '00', min = '00'] = match;
        return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), 0));
    }
    return null;
};

const parseNumero = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;
    const numero = Number(String(value).replace(/,/g, '').replace(/\s/g, ''));
    return isNaN(numero) ? 0 : numero;
};

export const exportarAutotanqueAExcel = async (registros: any[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Autotanque');

    worksheet.mergeCells('A1:L1');
    const mainTitle = worksheet.getCell('A1');
    mainTitle.value = 'REPORTE DE ENTREGA DE TURNO - AUTOTANQUE';
    mainTitle.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    mainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    const headers = [
        'N°',
        'RESPONSABLE INICIO',
        'FECHA INICIO',
        'CM INICIAL',
        'LITROS INICIAL',
        'TOTALIZADOR INI',
        'RESPONSABLE CIERRE',
        'FECHA CIERRE',
        'CM CIERRE',
        'LITROS CIERRE',
        'TOTALIZADOR CIERRE',
        'DIFERENCIA (LTS)'
    ];

    const startRow = 3;
    const headerRow = worksheet.getRow(startRow);
    headerRow.values = headers;
    headerRow.height = 25;

    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    worksheet.columns = [
        { width: 6 },
        { width: 25 },
        { width: 18 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 25 },
        { width: 18 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 18 }
    ];

    registros.forEach((item, index) => {
        const row = worksheet.addRow([
            index + 1,
            item.nombre?.toUpperCase() || 'N/A',
            parseFechaExcel(item.fecha),
            parseNumero(item.cmIni),
            parseNumero(item.litrosIni),
            parseNumero(item.totalizadorIni),
            item.nombreCierre?.toUpperCase() || 'PENDIENTE',
            parseFechaExcel(item.fechaCierre),
            parseNumero(item.cmCierre),
            parseNumero(item.litrosCierre),
            parseNumero(item.totalizadorCierre),
            parseNumero(item.diferenciaFinal)
        ]);

        row.height = 22;

        row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNumber === 3 || colNumber === 8) {
                cell.numFmt = 'dd/mm/yy hh:mm';
            }

            if ([4, 5, 6, 9, 10, 11, 12].includes(colNumber)) {
                cell.numFmt = '#,##0';
            }

            if (colNumber === 12) {
                const valor = parseNumero(item.diferenciaFinal);
                if (valor < 0) {
                    cell.font = { color: { argb: 'FFDC2626' }, bold: true };
                }
            }
        });
    });

    worksheet.autoFilter = {
        from: { row: startRow, column: 1 },
        to: { row: startRow, column: headers.length }
    };

    worksheet.views = [{ state: 'frozen', ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fechaHoy = new Date().toISOString().split('T')[0];
    saveAs(blob, `Reporte_Autotanque_${fechaHoy}.xlsx`);
};
