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

/**
 * El nombre corto de la pestaña: '2026-09' → 'SEP-2026'.
 *
 * Es la convención que ya usa `ExcelPernoctaDia`, y existe porque Excel corta
 * los nombres de hoja a 31 caracteres y prohíbe `: \ / ? * [ ]`. Dentro de la
 * hoja, el título de la fila 1 sigue siendo el largo —'SEPTIEMBRE 2026'—, que
 * es lo que el usuario lee.
 */
const nombreDeHoja = (mes: string): string => {
    const [anio, numero] = mes.split('-');

    return `${MESES[Number(numero) - 1].substring(0, 3)}-${anio}`;
};

/**
 * Los dos rellenos de la rejilla, los mismos que usa `ExcelPernoctaDia`.
 *
 * El ausente va en azul y no en rojo a propósito: una celda vacía de un día no
 * es una alarma, es un día en que el coche no estuvo. El rojo se reserva para
 * lo que de verdad va mal.
 */
const VERDE_PRESENTE = 'FFC6E0B4';

const AZUL_AUSENTE = 'FFBDD7EE';

const GRIS_BORDE = 'FF64748B';

/** 1 → 'A', 27 → 'AA'. Lo necesita la fórmula SUM del total. */
const numeroAColumnaExcel = (numero: number): string => {
    let resto = numero;
    let letras = '';

    while (resto > 0) {
        const modulo = (resto - 1) % 26;
        letras = String.fromCharCode(65 + modulo) + letras;
        resto = Math.floor((resto - modulo) / 26);
    }

    return letras;
};

/** Añade al libro una hoja con la rejilla de UN mes. */
function crearHojaMes(libro: ExcelJS.Workbook, rejilla: RejillaExcelEstacionamiento): void {
    const titulo = tituloDelMes(rejilla.mes);
    const totalColumnas = COLUMNAS_FIJAS.length + rejilla.dias + 1;

    const hoja = libro.addWorksheet(nombreDeHoja(rejilla.mes));

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
            const estuvo = presentes.has(dia);

            // Un 0 explícito y no una celda vacía: en blanco no se distingue «no
            // estuvo» de «nadie lo anotó», y el total suma sobre lo escrito.
            celda.value = estuvo ? 1 : 0;
            celda.font = { name: 'Arial', size: 9, color: { argb: 'FF000000' } };
            celda.alignment = { horizontal: 'center', vertical: 'middle' };
            celda.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: estuvo ? VERDE_PRESENTE : AZUL_AUSENTE },
            };
            celda.border = {
                top: { style: 'thin', color: { argb: GRIS_BORDE } },
                left: { style: 'thin', color: { argb: GRIS_BORDE } },
                bottom: { style: 'thin', color: { argb: GRIS_BORDE } },
                right: { style: 'thin', color: { argb: GRIS_BORDE } },
            };
        }

        /*
         * El total es una fórmula viva con su resultado precalculado, como en
         * Pernocta: si alguien corrige un día a mano en Excel, el total se
         * recalcula en vez de quedarse mintiendo.
         */
        const primeraLetra = numeroAColumnaExcel(COLUMNAS_FIJAS.length + 1);
        const ultimaLetra = numeroAColumnaExcel(COLUMNAS_FIJAS.length + rejilla.dias);
        const numeroDeFila = 3 + indice;

        const celdaTotal = renglon.getCell(totalColumnas);
        celdaTotal.value = {
            formula: `SUM(${primeraLetra}${numeroDeFila}:${ultimaLetra}${numeroDeFila})`,
            result: fila.total,
        };
        celdaTotal.font = { name: 'Arial', size: 10, bold: true };
        celdaTotal.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Fija el encabezado y las cinco columnas de identificación: al llegar al día 28 se
    // sigue viendo de qué placa es la fila.
    hoja.views = [{ state: 'frozen', xSplit: COLUMNAS_FIJAS.length, ySplit: 2 }];
}

/** '2026-01' y '2026-03' → 'estacionamiento-2026-01_a_2026-03.xlsx'. */
const nombreDelArchivo = (meses: string[]): string => {
    if (meses.length === 1) {
        return `estacionamiento-${meses[0]}.xlsx`;
    }

    const ordenados = [...meses].sort();

    return `estacionamiento-${ordenados[0]}_a_${ordenados[ordenados.length - 1]}.xlsx`;
};

/**
 * Un libro con una hoja por mes, en el orden en que llegan las rejillas.
 *
 * Varios meses no caben en una hoja plana porque las columnas SON los días del
 * mes: febrero tiene 28 y marzo 31, así que compartir encabezado obligaría a
 * mentir en uno de los dos. Una hoja por mes es lo que hace `ExcelPernoctaDia`
 * con el mismo problema.
 */
export async function descargarExcelEstacionamiento(
    rejillas: RejillaExcelEstacionamiento[],
): Promise<void> {
    const conFilas = rejillas.filter(rejilla => rejilla.filas.length > 0);

    if (conFilas.length === 0) {
        return;
    }

    const libro = new ExcelJS.Workbook();

    conFilas.forEach(rejilla => crearHojaMes(libro, rejilla));

    const buffer = await libro.xlsx.writeBuffer();

    saveAs(
        new Blob([buffer as ArrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        nombreDelArchivo(conFilas.map(rejilla => rejilla.mes)),
    );
}
