import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const ExcelRemisiones = async (datos: any[]) => {
    const workbook = new ExcelJS.Workbook();

    const sheetVentas = workbook.addWorksheet('Ventas ASA');
    const sheetCompras = workbook.addWorksheet('Compras ASA');

    // 1. Columnas para VENTAS (Se mantiene igual)
    sheetVentas.columns = [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 12 },
        { header: 'MATRÍCULA', key: 'matricula', width: 12 },
        { header: 'SALIDA (LTS)', key: 'litros', width: 15 },
        { header: 'ORD. VTA', key: 'vta', width: 12 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE VENTA EOLO', key: 'precio_venta', width: 22 },
        { header: 'IMPORTE', key: 'importe', width: 18 },
        { header: 'CLIENTE', key: 'cliente', width: 25 },
        { header: 'FORMA DE PAGO', key: 'forma_pago', width: 15 },
        { header: 'MES DE REFERENCIA', key: 'mes', width: 18 },
        { header: 'ESTATUS', key: 'status', width: 12 },
    ];

    // 2. Columnas para COMPRAS (Actualizado según tu nueva consulta)
    sheetCompras.columns = [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 12 },
        { header: 'LITROS', key: 'litros', width: 15 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE COMPRA POR LT', key: 'precio_venta', width: 25 },
        { header: 'COSTO ASA', key: 'importe', width: 20 },
    ];

    const formatHeader = (ws: ExcelJS.Worksheet) => {
        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '003E51' } };
            cell.font = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    };

    formatHeader(sheetVentas);
    formatHeader(sheetCompras);

    datos.forEach((item) => {
        if (item.tipo === 'R') {
            sheetVentas.addRow({
                folio: item.folio,
                fecha: item.fecha,
                matricula: item.matricula,
                litros: Number(item.litros || 0),
                vta: item.vta,
                factura: item.factura,
                precio_venta: Number(item.precio_venta || 0),
                importe: Number(item.importe || 0),
                cliente: item.cliente,
                forma_pago: item.forma_pago,
                mes: item.mes,
                status: item.status === 'A' ? 'Activo' : item.status
            });
        } else {
            // MAPEO PARA COMPRAS (Tipo A)
            sheetCompras.addRow({
                folio: item.folio,
                fecha: item.fecha,
                litros: Number(item.litros || 0),
                factura: item.factura,
                precio_venta: Number(item.precio_venta || 0),
                importe: Number(item.importe || 0)
            });
        }
    });

    // Formatos numéricos para Ventas
    sheetVentas.getColumn('litros').numFmt = '#,##0.00';
    sheetVentas.getColumn('precio_venta').numFmt = '$#,##0.0000';
    sheetVentas.getColumn('importe').numFmt = '$#,##0.0000';

    // Formatos numéricos para Compras (Actualizados con las nuevas keys)
    sheetCompras.getColumn('litros').numFmt = '#,##0.00';
    sheetCompras.getColumn('precio_venta').numFmt = '$#,##0.0000';
    sheetCompras.getColumn('importe').numFmt = '$#,##0.0000';

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Reporte_ASA_${new Date().toISOString().split('T')[0]}.xlsx`);
};
