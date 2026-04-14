import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportarOperacionesAExcel = async (registros: any[], filtros: any = {}) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Operaciones');

    worksheet.mergeCells('A1:N1');
    const mainTitle = worksheet.getCell('A1');
    mainTitle.value = 'REPORTE DETALLADO DE OPERACIONES DIARIAS';
    mainTitle.font = { name: 'Arial Black', size: 16, color: { argb: 'FF0369A1' } };
    mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    worksheet.mergeCells('A3:N3');
    const filterCell = worksheet.getCell('A3');
    filterCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    filterCell.alignment = { horizontal: 'left' };
    worksheet.getRow(3).height = 20;

    const startRow = 5;
    const headers = [
        'ID', 'TIPO', 'MATRÍCULA', 'EQUIPO', 'FECHA', 'HORA',
        'ORIGEN/DESTINO', 'TIPO DE OPERACIÓN', 'PAX', 'EQP', 'TIPO DE CLIENTE', 'TIPO DE MOVIMIENTO', 'RESPONSABLE', 'VALIDACIONES'
    ];

    const headerRow = worksheet.getRow(startRow);
    headerRow.values = headers;
    headerRow.height = 30;

    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF003E51' }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF00556F' } },
            left: { style: 'thin', color: { argb: 'FF00556F' } },
            bottom: { style: 'thin', color: { argb: 'FF00556F' } },
            right: { style: 'thin', color: { argb: 'FF00556F' } }
        };
    });

    const columnWidths = [8, 12, 15, 15, 15, 10, 20, 20, 8, 8, 20, 20, 20, 35];
    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    registros.forEach((op) => {
        const fechaObj = new Date(op.fecha);
        const fechaFormateada = `${fechaObj.getUTCDate()}/${fechaObj.getUTCMonth() + 1}/${fechaObj.getUTCFullYear()}`;

        const rowData = [
            op.id,
            op.tipo?.toUpperCase() || '',
            op.matricula,
            op.equipo,
            fechaFormateada,
            op.hora,
            op.lugar,
            op.tipo_operacion,
            op.pax,
            op.equipaje,
            op.tipo_cliente,
            op.impulso || 'N/A',
            op.nombre || 'N/A',
            Array.isArray(op.validaciones) ? op.validaciones.join(' - ') : (op.validaciones || 'Ninguna')
        ];

        const row = worksheet.addRow(rowData);

        row.eachCell((cell, colNumber) => {
            if (colNumber === 2) {
                const esLlegada = op.tipo?.toLowerCase() === 'llegada';
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: esLlegada ? 'DCFCE7' : 'FEE2E2' }
                };
                cell.font = { color: { argb: esLlegada ? '166534' : '991B1B' }, bold: true };
            } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
            }

            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fechaHoy = new Date().toISOString().split('T')[0];
    saveAs(blob, `Reporte_Operaciones_${fechaHoy}.xlsx`);
};
