import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { RejillaExcelEstacionamiento } from '@/stores/apiEstacionamientoSubterraneo';

/**
 * Las cinco columnas de identificación, en orden. El modal pinta esta misma lista, así
 * que la vista previa y el libro no pueden divergir.
 */
export const COLUMNAS_FIJAS: {
    clave: 'placas' | 'vehiculo' | 'color' | 'matricula' | 'responsable';
    titulo: string;
    ancho: number;
}[] = [
    { clave: 'placas', titulo: 'PLACAS', ancho: 14 },
    { clave: 'vehiculo', titulo: 'VEHÍCULO', ancho: 16 },
    { clave: 'color', titulo: 'COLOR', ancho: 12 },
    { clave: 'matricula', titulo: 'MATRÍCULA', ancho: 14 },
    { clave: 'responsable', titulo: 'RESPONSABLE', ancho: 24 },
];

const MESES = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
];

/** '2026-09' → 'SEPTIEMBRE 2026'. */
export const tituloDelMes = (mes: string): string => {
    const [anio, numero] = mes.split('-');

    return `${MESES[Number(numero) - 1]} ${anio}`;
};

export async function descargarExcelEstacionamiento(
    rejilla: RejillaExcelEstacionamiento,
): Promise<void> {
    const titulo = tituloDelMes(rejilla.mes);
    const totalColumnas = COLUMNAS_FIJAS.length + rejilla.dias + 1;

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet(titulo);

    COLUMNAS_FIJAS.forEach((columna, indice) => {
        hoja.getColumn(indice + 1).width = columna.ancho;
    });

    for (let dia = 1; dia <= rejilla.dias; dia++) {
        hoja.getColumn(COLUMNAS_FIJAS.length + dia).width = 4;
    }

    hoja.getColumn(totalColumnas).width = 8;

    hoja.mergeCells(1, 1, 1, totalColumnas);
    const celdaTitulo = hoja.getCell(1, 1);
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14 };
    celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
    hoja.getRow(1).height = 26;

    const encabezado = hoja.getRow(2);

    COLUMNAS_FIJAS.forEach((columna, indice) => {
        encabezado.getCell(indice + 1).value = columna.titulo;
    });

    for (let dia = 1; dia <= rejilla.dias; dia++) {
        encabezado.getCell(COLUMNAS_FIJAS.length + dia).value = dia;
    }

    encabezado.getCell(totalColumnas).value = 'TOTAL';

    // El estilo va celda por celda. Asignarlo al objeto Row lo emite como estilo de fila
    // (customFormat="1") y Excel pinta el relleno a lo ancho de toda la hoja, mucho más
    // allá de TOTAL. ExcelPernoctaDia hace lo mismo: solo la altura va en la fila.
    for (let columna = 1; columna <= totalColumnas; columna++) {
        const celda = encabezado.getCell(columna);
        celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        celda.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF003E51' },
        };
        celda.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    encabezado.height = 20;

    rejilla.filas.forEach((fila, indice) => {
        const renglon = hoja.getRow(3 + indice);

        COLUMNAS_FIJAS.forEach((columna, posicion) => {
            renglon.getCell(posicion + 1).value = fila[columna.clave] ?? '';
        });

        const presentes = new Set(fila.dias);

        for (let dia = 1; dia <= rejilla.dias; dia++) {
            const celda = renglon.getCell(COLUMNAS_FIJAS.length + dia);
            celda.value = presentes.has(dia) ? 1 : null;
            celda.alignment = { horizontal: 'center' };
        }

        const celdaTotal = renglon.getCell(totalColumnas);
        celdaTotal.value = fila.total;
        celdaTotal.font = { bold: true };
        celdaTotal.alignment = { horizontal: 'center' };
    });

    // Fija el encabezado y las cinco columnas de identificación: al llegar al día 28 se
    // sigue viendo de qué placa es la fila.
    hoja.views = [{ state: 'frozen', xSplit: COLUMNAS_FIJAS.length, ySplit: 2 }];

    const buffer = await libro.xlsx.writeBuffer();

    saveAs(
        new Blob([buffer as ArrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `estacionamiento-${rejilla.mes}.xlsx`,
    );
}
