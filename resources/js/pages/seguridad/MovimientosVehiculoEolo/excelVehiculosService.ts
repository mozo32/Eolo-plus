import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FilaExcelVehiculo } from './types';

/**
 * Las columnas del reporte, en orden. La vista previa del modal pinta esta misma
 * lista, así que lo que se ve y lo que se descarga no pueden divergir.
 */
export const COLUMNAS_EXCEL_VEHICULOS: {
    clave: keyof FilaExcelVehiculo;
    titulo: string;
    ancho: number;
}[] = [
    { clave: 'vehiculo', titulo: 'Vehículo', ancho: 18 },
    { clave: 'numeroEconomico', titulo: 'N. económico', ancho: 14 },
    { clave: 'fechaHora', titulo: 'Fecha y hora', ancho: 18 },
    { clave: 'tipo', titulo: 'Tipo', ancho: 10 },
    { clave: 'chofer', titulo: 'Chofer', ancho: 22 },
    { clave: 'kilometraje', titulo: 'Kilometraje', ancho: 13 },
    { clave: 'gasolina', titulo: 'Gasolina', ancho: 11 },
    { clave: 'destino', titulo: 'Destino', ancho: 26 },
    { clave: 'autoriza', titulo: 'Autoriza', ancho: 22 },
    { clave: 'matricula', titulo: 'Matrícula', ancho: 13 },
    { clave: 'motivo', titulo: 'Motivo', ancho: 22 },
    { clave: 'observaciones', titulo: 'Observaciones', ancho: 34 },
];

const nombreDelArchivo = (): string => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');

    return `movimientos-vehiculos-${hoy.getFullYear()}-${mes}-${dia}.xlsx`;
};

export async function descargarExcelVehiculos(filas: FilaExcelVehiculo[]): Promise<void> {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Movimientos');

    hoja.columns = COLUMNAS_EXCEL_VEHICULOS.map(columna => ({
        header: columna.titulo,
        key: columna.clave,
        width: columna.ancho,
    }));

    filas.forEach(fila => {
        const valores: Record<string, unknown> = {};

        COLUMNAS_EXCEL_VEHICULOS.forEach(columna => {
            valores[columna.clave] = fila[columna.clave] ?? '';
        });

        hoja.addRow(valores);
    });

    const encabezado = hoja.getRow(1);

    // Celda a celda, no sobre el objeto Row: ExcelJS emite un estilo de fila como
    // `customFormat="1"`, y entonces Excel pinta el relleno oscuro a lo ancho de toda la
    // hoja, mucho más allá de la última columna. La altura sí es propiedad de la fila.
    COLUMNAS_EXCEL_VEHICULOS.forEach((_, indice) => {
        const celda = encabezado.getCell(indice + 1);

        celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        celda.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF003E51' },
        };
        celda.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    encabezado.height = 22;

    hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: COLUMNAS_EXCEL_VEHICULOS.length },
    };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await libro.xlsx.writeBuffer();

    saveAs(
        new Blob([buffer as ArrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        nombreDelArchivo(),
    );
}
