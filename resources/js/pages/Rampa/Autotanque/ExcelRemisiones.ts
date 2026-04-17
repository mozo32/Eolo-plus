
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const ExcelRemisiones = async (datos: any[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Remisiones');

    worksheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 15 },
        { header: 'MATRÍCULA', key: 'matricula', width: 15 },
        { header: 'EQUIPO', key: 'aeronave_tipo', width: 10 },
        { header: 'CLIENTE', key: 'cliente', width: 25 },
        { header: 'TIPO CLIENTE', key: 'tipo_cliente', width: 15 },
        { header: 'PRODUCTO', key: 'producto', width: 15 },
        { header: 'CANTIDAD (LTS)', key: 'total_litros', width: 18 },
        { header: 'DESTINO', key: 'destino', width: 12 },
        { header: 'LLEGADA DE AUTOTANQUE', key: 'hora_llegada', width: 15 },
        { header: 'INICIO DE CARGA', key: 'hora_inicial', width: 15 },
        { header: 'FINAL DE CARGA', key: 'hora_final', width: 15 },
        { header: 'LECTURA INICIAL', key: 'lectura_inicial', width: 18 },
        { header: 'LECTURA FINAL', key: 'lectura_final', width: 18 },
        { header: 'UNIDAD', key: 'unidad', width: 20 },
        { header: 'OPERADOR', key: 'operador', width: 25 },
        { header: 'PAGO', key: 'forma_pago', width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '003E51' }
        };
        cell.font = {
            color: { argb: 'FFFFFF' },
            bold: true,
            size: 10
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    datos.forEach((item) => {
        const row = worksheet.addRow({
            id:item.id,
            folio: item.folio,
            fecha: item.fecha,
            matricula: item.matricula,
            aeronave_tipo: item.aeronave_tipo,
            cliente: item.cliente,
            tipo_cliente: item.tipo_cliente,
            producto: item.producto,
            total_litros: Math.round(Number(item.total_litros || 0)),
            destino: item.destino,
            hora_llegada: item.hora_llegada,
            hora_inicial: item.hora_inicial,
            hora_final: item.hora_final,
            lectura_inicial: Math.round(Number(item.lectura_inicial || 0)),
            lectura_final: Math.round(Number(item.lectura_final || 0)),
            unidad: item.unidad,
            operador: item.operador,
            forma_pago: item.forma_pago,
        });

        ['total_litros', 'lectura_inicial', 'lectura_final'].forEach(key => {
            const cell = row.getCell(key);
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '#,##0.00';
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const fechaArchivo = new Date().toISOString().split('T')[0];
    saveAs(blob, `Reporte_Remisiones_${fechaArchivo}.xlsx`);
};
