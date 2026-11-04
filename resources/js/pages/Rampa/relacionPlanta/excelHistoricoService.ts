import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { obtenerHistoricoPlantaApi, type PaginaHistorico } from '@/stores/apiRelacionPlanta';
import { fechaCorta, formatearHoras, horasAHHMM, type FiltrosHistorico, type MetaPaginacion, type Prestamo } from './types';

/**
 * Las columnas del reporte, en orden, y las mismas ocho que la tabla del
 * histórico. Se declara una sola vez y se exporta para que lo que se ve en
 * pantalla y lo que se descarga no puedan divergir.
 */
export const COLUMNAS_EXCEL_HISTORICO: {
    clave: keyof FilaExcelHistorico;
    titulo: string;
    ancho: number;
}[] = [
    { clave: 'numero', titulo: '#', ancho: 6 },
    { clave: 'fecha', titulo: 'Fecha', ancho: 14 },
    { clave: 'empresa', titulo: 'Empresa', ancho: 28 },
    { clave: 'matricula', titulo: 'Matrícula', ancho: 14 },
    { clave: 'horometroInicio', titulo: 'Horóm. inicial', ancho: 15 },
    { clave: 'horometroFin', titulo: 'Horóm. final', ancho: 15 },
    { clave: 'tiempo', titulo: 'Tiempo (h)', ancho: 12 },
    { clave: 'tiempoHHMM', titulo: 'Tiempo (h:mm)', ancho: 14 },
    { clave: 'estado', titulo: 'Estado', ancho: 13 },
];

export interface FilaExcelHistorico {
    numero: number;
    fecha: string;
    empresa: string;
    matricula: string;
    horometroInicio: string;
    horometroFin: string;
    /** Horas decimales como NÚMERO, para que se puedan sumar en la hoja. */
    tiempo: number | string;
    tiempoHHMM: string;
    estado: string;
}

/**
 * El máximo que el endpoint acepta.
 *
 * `RelacionPlantaController::historico` valida `per_page` contra
 * `[10, 20, 50, 100]` y cualquier otro valor lo baja a 20 **en silencio**, así
 * que pedir «todas» de un golpe daría páginas de 20 sin avisar.
 */
const POR_PAGINA = 100;

/**
 * Tope de filas de una exportación.
 *
 * Sin él, exportar sin filtros con años de historial serían cientos de
 * peticiones. Cuando se alcanza, la descarga sale con lo que cabe y quien la
 * pidió recibe el aviso de que acote el filtro.
 */
const TOPE_FILAS = 5000;

export interface ResultadoExportacion {
    filas: FilaExcelHistorico[];
    /** El tope recortó el resultado: hay más filas de las que caben. */
    truncado: boolean;
}

/** `dd/mm/aaaa` y la hora del equipo no entran: el nombre lleva el día. */
const nombreDelArchivo = (): string => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');

    return `relacion-planta-${hoy.getFullYear()}-${mes}-${dia}.xlsx`;
};

/** Una fila del Excel desde un préstamo, con el formato que usa la tabla. */
const aFilaExcel = (prestamo: Prestamo, numero: number): FilaExcelHistorico => ({
    numero,
    fecha: fechaCorta(prestamo.fecha),
    empresa: prestamo.empresa,
    matricula: prestamo.matricula,
    horometroInicio: formatearHoras(prestamo.horometro_inicio),
    horometroFin: formatearHoras(prestamo.horometro_fin),
    tiempo: prestamo.tiempo === null ? '—' : Number(prestamo.tiempo),
    tiempoHHMM: prestamo.tiempo === null ? '—' : horasAHHMM(prestamo.tiempo),
    estado: prestamo.status === 'en_uso' ? 'En uso' : 'Finalizado',
});

/**
 * Laravel pagina de dos formas: con las claves de la paginación arriba, al
 * lado de `data`, o metidas en un `meta`. Hoy este endpoint devuelve la
 * primera, pero leer una sola de las dos es frágil.
 */
type RespuestaPaginada = PaginaHistorico & { meta?: Partial<MetaPaginacion> };

/** El número si es uno utilizable; `null` si viene ausente, cero o basura. */
const numeroPositivo = (valor: unknown): number | null => {
    const numero = Number(valor);

    return Number.isFinite(numero) && numero > 0 ? numero : null;
};

/**
 * Trae TODAS las filas que casan con los filtros, recorriendo páginas.
 *
 * El histórico se pagina en el servidor, así que lo que hay en pantalla es una
 * página: exportar solo eso daría veinte filas cuando el filtro casa con
 * cientos, y la diferencia no se vería hasta abrir el archivo.
 *
 * El recorrido NO se guía por `last_page`. Si ese campo llega `undefined` —
 * porque el servidor paginó metiendo las claves en `meta`— el bucle se cortaba
 * en la primera página, y encima `truncado` salía `false`: la exportación se
 * quedaba corta en silencio. Ahora se para cuando ya se juntaron todas las
 * filas que el servidor dice que hay, o cuando una página viene incompleta.
 *
 * El tamaño con el que se mide «incompleta» es el que el servidor DIJO que
 * usó, no el que se pidió: `RelacionPlantaController::historico` baja a 20 en
 * silencio cualquier `per_page` que no esté en su lista, así que comparar
 * contra el pedido daría por corta una página que está llena.
 *
 * Está separada de la descarga a propósito: la vista previa necesita las filas
 * ANTES de que exista el archivo, y así lo que se enseña y lo que se descarga
 * son literalmente el mismo arreglo.
 */
export async function traerFilasHistorico(filtros: FiltrosHistorico): Promise<ResultadoExportacion> {
    const prestamos: Prestamo[] = [];
    let pagina = 1;
    let truncado = false;

    for (;;) {
        const respuesta = (await obtenerHistoricoPlantaApi(filtros, pagina, POR_PAGINA)) as RespuestaPaginada;
        const bloque = respuesta.data ?? [];
        const meta = respuesta.meta ?? respuesta;
        const total = numeroPositivo(meta.total);
        const tamanoDePagina = numeroPositivo(meta.per_page) ?? POR_PAGINA;

        prestamos.push(...bloque);

        const quedanPaginas = total !== null ? prestamos.length < total : bloque.length > 0 && bloque.length >= tamanoDePagina;

        if (!quedanPaginas) {
            break;
        }

        if (prestamos.length >= TOPE_FILAS) {
            truncado = true;
            break;
        }

        pagina += 1;
    }

    return {
        filas: prestamos.map((prestamo, indice) => aFilaExcel(prestamo, indice + 1)),
        truncado,
    };
}

/** Construye el `.xlsx` y lo descarga, a partir de filas ya traídas. */
export async function descargarExcelHistorico(filas: FilaExcelHistorico[]): Promise<void> {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Relación de planta');

    hoja.columns = COLUMNAS_EXCEL_HISTORICO.map(columna => ({
        header: columna.titulo,
        key: columna.clave,
        width: columna.ancho,
    }));

    filas.forEach(fila => {
        const valores: Record<string, unknown> = {};

        COLUMNAS_EXCEL_HISTORICO.forEach(columna => {
            valores[columna.clave] = fila[columna.clave] ?? '';
        });

        hoja.addRow(valores);
    });

    const encabezado = hoja.getRow(1);

    // Celda a celda, no sobre el objeto Row: ExcelJS emite un estilo de fila
    // como `customFormat="1"`, y entonces Excel pinta el relleno oscuro a lo
    // ancho de toda la hoja, mucho más allá de la última columna. La altura sí
    // es propiedad de la fila.
    COLUMNAS_EXCEL_HISTORICO.forEach((_, indice) => {
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
        to: { row: 1, column: COLUMNAS_EXCEL_HISTORICO.length },
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
