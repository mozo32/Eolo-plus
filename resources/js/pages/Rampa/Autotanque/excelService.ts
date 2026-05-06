import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportarAutotanqueAExcel = async (registros: any[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Autotanque');

    // 1. Título Principal
    worksheet.mergeCells('A1:L1');
    const mainTitle = worksheet.getCell('A1');
    mainTitle.value = 'REPORTE DE ENTREGA DE TURNO - AUTOTANQUE';
    mainTitle.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    mainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // 2. Encabezados adaptados a la data de Autotanque
    const headers = [
        'ID', 'RESPONSABLE INICIO', 'FECHA INICIO', 'CM INICIAL', 'LITROS INICIAL', 'TOTALIZADOR INI',
        'RESPONSABLE CIERRE', 'FECHA CIERRE', 'CM CIERRE', 'LITROS CIERRE', 'TOTALIZADOR CIERRE', 'DIFERENCIA (LTS)'
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
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });

    // 3. Configurar anchos de columna
    worksheet.columns = [
        { width: 8 }, { width: 25 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 18 },
        { width: 25 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 18 }, { width: 18 }
    ];

    // 4. Agregar los datos
    registros.forEach((item) => {
        const rowData = [
            item.id,
            item.nombre?.toUpperCase() || 'N/A',
            item.fecha || '',
            item.cmIni,
            parseFloat(item.litrosIni),
            item.totalizadorIni,
            item.nombreCierre?.toUpperCase() || 'PENDIENTE',
            item.fechaCierre || '',
            item.cmCierre,
            parseFloat(item.litrosCierre),
            item.totalizadorCierre,
            parseFloat(item.diferenciaFinal)
        ];

        const row = worksheet.addRow(rowData);

        // Estilo de celdas de datos
        row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Resaltar la diferencia negativa en rojo
            if (colNumber === 12) {
                const valor = parseFloat(item.diferenciaFinal);
                if (valor < 0) {
                    cell.font = { color: { argb: 'FFDC2626' }, bold: true };
                }
            }
        });
    });

    // 5. Generar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fechaHoy = new Date().toISOString().split('T')[0];
    saveAs(blob, `Reporte_Autotanque_${fechaHoy}.xlsx`);
};
