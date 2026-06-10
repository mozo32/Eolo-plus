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

    // 2. Encabezados
    const headers = [
        'N°', 'RESPONSABLE INICIO', 'FECHA INICIO', 'CM INICIAL', 'LITROS INICIAL', 'TOTALIZADOR INI',
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
        { width: 6 }, { width: 25 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 18 },
        { width: 25 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 18 }, { width: 18 }
    ];

    // 4. Agregar los datos
    // Modificación: Creación de fechas reales y formateo dinámico
    registros.forEach((item, index) => {
        // Convertir strings de fecha a objetos Date nativos si existen
        const fechaInicioDate = item.fecha ? new Date(item.fecha) : '';
        const fechaCierreDate = item.fechaCierre ? new Date(item.fechaCierre) : '';

        const rowData = [
            index + 1, // Consecutivo autoincrementable en vez de item.id
            item.nombre?.toUpperCase() || 'N/A',
            fechaInicioDate, // Pasamos el objeto Date
            item.cmIni,
            parseFloat(item.litrosIni) || 0,
            item.totalizadorIni,
            item.nombreCierre?.toUpperCase() || 'PENDIENTE',
            fechaCierreDate, // Pasamos el objeto Date
            item.cmCierre,
            parseFloat(item.litrosCierre) || 0,
            item.totalizadorCierre,
            parseFloat(item.diferenciaFinal) || 0
        ];

        const row = worksheet.addRow(rowData);

        // Estilo de celdas de datos
        row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Formatear las columnas de FECHA (Columna 3 y Columna 8)
            if (colNumber === 3 || colNumber === 8) {
                if (cell.value instanceof Date) {
                    // Formato Excel para que sea reconocido como Fecha y Hora filtrable
                    cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
                }
            }

            // Resaltar la diferencia negativa en rojo (Columna 12)
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
