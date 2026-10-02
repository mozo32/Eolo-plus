/**
 * Formato y validación de importes y fechas de Facturación.
 *
 * Regla que gobierna todo este archivo: un campo vacío y un cero NO son lo
 * mismo. Cero es una tarifa válida (una cortesía); vacío es "sin tarifa" o,
 * en una matrícula, "hereda". Por eso nunca se usa `Number('')` (que da 0) ni
 * `||` / `!valor` para decidir si hay un importe.
 */

import type { AjustePrecio } from '@/stores/apiFacturacionCatalogos';

/** Máximo de las tarifas de estancia y aterrizaje (decimal 10,2 en el servidor). */
export const TARIFA_MAX = 99999999.99;

/** Máximo y mínimo de un precio de combustible (decimal 10,4; nunca cero). */
export const COMBUSTIBLE_MAX = 999999.9999;
export const COMBUSTIBLE_MIN = 0.0001;

/** Máximo del precio de un servicio (decimal 10,4) y del margen (decimal 5,2). Cero es válido en los dos. */
export const PRECIO_SERVICIO_MAX = 999999.9999;
export const MARGEN_MAX = 999.99;

type Monto = string | number | null | undefined;

/**
 * Minúsculas y sin marcas diacríticas. El `unique` de un nombre corre en MySQL
 * con utf8mb4_unicode_ci, que ignora acentos y mayúsculas: "Helicoptero" choca
 * con "Helicóptero". La búsqueda debe encontrar lo mismo que rechaza el servidor.
 */
export const normalizarBusqueda = (texto: string): string =>
    texto
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim()
        .toLowerCase();

/** "$1,234.50", o "—" si no hay importe. Cero se muestra como "$0.00". */
export function formatearMonto(valor: Monto, decimalesMax = 2): string {
    if (valor === null || valor === undefined || valor === '') return '—';

    const numero = Number(valor);
    if (Number.isNaN(numero)) return '—';

    return `$${numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: decimalesMax })}`;
}

/** Texto de un importe listo para un campo de captura ("12.50"), o '' si no hay. */
export function montoATexto(valor: Monto): string {
    return valor === null || valor === undefined ? '' : String(valor);
}

export function esTextoVacio(texto: string): boolean {
    return texto.trim() === '';
}

/** Convierte lo tecleado a número. Devuelve null si está vacío o no es un importe válido. */
export function parsearMonto(texto: string): number | null {
    const limpio = texto.trim();
    if (limpio === '' || !/^(\d+\.?\d*|\.\d+)$/.test(limpio)) return null;

    return Number(limpio);
}

interface OpcionesMonto {
    /** Nombre del campo tal como se dice en el mensaje: "la tarifa de pernocta". */
    nombre: string;
    obligatorio: boolean;
    decimales: number;
    minimo: number;
    maximo: number;
}

/** Devuelve el mensaje de error, o null si el texto es válido (o vacío y opcional). */
export function validarMonto(texto: string, { nombre, obligatorio, decimales, minimo, maximo }: OpcionesMonto): string | null {
    if (esTextoVacio(texto)) return obligatorio ? `Captura ${nombre}.` : null;

    const numero = parsearMonto(texto);
    if (numero === null) return `${capitalizar(nombre)} debe ser un importe numérico, sin signos ni comas.`;

    const parteDecimal = texto.trim().split('.')[1] ?? '';
    if (parteDecimal.length > decimales) return `${capitalizar(nombre)} admite máximo ${decimales} decimales.`;

    if (numero < minimo) return minimo === 0 ? `${capitalizar(nombre)} no puede ser negativa.` : `${capitalizar(nombre)} debe ser de al menos ${minimo}.`;
    if (numero > maximo) return `${capitalizar(nombre)} es demasiado grande.`;

    return null;
}

const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

const FORMATO_FECHA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * dd/mm/aaaa en hora de México. El servidor serializa las fechas de vigencia
 * como instante UTC ("2026-09-28T06:00:00Z" es el 28 a las 00:00 de México), así
 * que no se puede cortar la cadena ni usar toISOString(): se convierte a la zona
 * de México para no correr un día.
 */
export function fechaMexico(valor: string | null | undefined): string {
    if (!valor) return '—';

    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '—';

    const [anio, mes, dia] = FORMATO_FECHA_MX.format(fecha).split('-');

    return `${dia}/${mes}/${anio}`;
}

/**
 * Propuesta del precio Eolo a partir del ASA: (ASA + ajuste) × margen, a 4
 * decimales. El ajuste y el margen los fija el servidor (`fact_configuracion`) y
 * llegan con el precio vigente; aquí no hay valores por omisión a propósito.
 */
export function precioEoloSugerido(precioAsa: number, formula: { ajuste: number; margen: number }): number {
    return Number(((precioAsa + formula.ajuste) * formula.margen).toFixed(4));
}

/** Los ajustes de precio tal como se le muestran a quien captura. Cambian lo que se cobra: cada uno dice qué hace. */
export const AJUSTES_PRECIO: { valor: AjustePrecio; titulo: string; descripcion: string }[] = [
    { valor: 'ninguno', titulo: 'Sin ajuste', descripcion: 'El precio se usa tal cual.' },
    { valor: 'mas_5', titulo: 'Más 5 %', descripcion: 'El precio se multiplica por 1.05.' },
    { valor: 'sin_iva', titulo: 'Sin IVA', descripcion: 'El precio se divide entre 1.16 para descontarle el IVA.' },
    { valor: 'comision_131', titulo: 'Comisión 131', descripcion: 'El precio se divide entre 1.31 y el resultado se multiplica por 1.15.' },
];

/** Quita los ceros sobrantes de un decimal del servidor para capturarlo: "1000.0000" es "1000", "12.5000" es "12.5". */
export function sinCerosFinales(valor: Monto): string {
    const texto = montoATexto(valor);

    return texto.includes('.') ? texto.replace(/\.?0+$/, '') : texto;
}

/** Redondeo a 2 decimales con la mitad hacia arriba, como `number_format` de PHP (toFixed fallaría en 1.005). */
function redondear2(valor: number): number {
    const texto = String(valor);
    // Un exponente ("8.6e-7") no admite el truco de desplazar el punto; a ese tamaño el resultado es 0.00 de todos modos.
    if (texto.includes('e')) return Number(valor.toFixed(2));

    return Number(`${Math.round(Number(`${texto}e2`))}e-2`);
}

/**
 * VISTA PREVIA del importe de un servicio, para que quien captura vea el efecto
 * del margen y del ajuste. No es la cifra oficial: la calcula el servidor.
 *
 * AUTORIDAD: `App\Support\ImporteServicio::calcular()` (app/Support/ImporteServicio.php); `FactServicio::importe()`
 * solo delega en ella. El IVA de la prefactura no se calcula aquí: su fórmula es `FactPrefactura::calcularIva()`.
 * Esta función es una copia de la fórmula del importe: quien cambie una tiene que cambiar la otra.
 *
 *   ajustado = según el ajuste: ninguno → precio; mas_5 → precio × 1.05;
 *              sin_iva → precio ÷ 1.16; comision_131 → p1 = precio ÷ 1.31, p1 × 0.15 + p1
 *   conMargen = ajustado + ajustado × margen ÷ 100
 *   importe = conMargen × cantidad, a dos decimales
 *
 * Un ajuste desconocido lanza, igual que el servidor: cobrar sin ajuste en silencio sería peor que fallar.
 */
export function importeVistaPrevia(precio: number, margen: number, ajuste: AjustePrecio, cantidad = 1): number {
    let ajustado: number;

    switch (ajuste) {
        case 'ninguno':
            ajustado = precio;
            break;
        case 'mas_5':
            ajustado = precio * 1.05;
            break;
        case 'sin_iva':
            ajustado = precio / 1.16;
            break;
        case 'comision_131': {
            const precio1 = precio / 1.31;
            ajustado = precio1 * 0.15 + precio1;
            break;
        }
        default:
            throw new Error(`ajuste_precio desconocido: '${String(ajuste)}'`);
    }

    const conMargen = ajustado + (ajustado * margen) / 100;

    return redondear2(conMargen * cantidad);
}

/**
 * VISTA PREVIA de la comisión Amex, para que quien cobra vea el cargo antes de
 * confirmarlo. No es la cifra oficial: la calcula el servidor.
 *
 * AUTORIDAD: `App\Support\ComisionAmex::calcular()` (app/Support/ComisionAmex.php). Esta función es
 * una copia de esa fórmula: quien cambie una tiene que cambiar la otra.
 *
 *   base     = monto / ((1 + iva) × 1.06)
 *   comisión = base × 0.06
 *
 * Y aun así puede diferir por centavos de lo que queda: al registrar, el servidor AJUSTA la comisión
 * (`PagosPrefactura::comisionQueCuadra()`, hasta 5 centavos) para que el total de la prefactura caiga exacto
 * en lo que se carga a la tarjeta. Ese ajuste depende de los totales y NO se copia aquí; por eso esto es una
 * estimación y la pantalla lo dice. La cifra que cuenta es la que devuelve el servidor.
 *
 * null si el monto o la tasa no son números utilizables (vacío no es cero: no se estima nada).
 */
export function comisionVistaPrevia(monto: string, tasaIva: string | null): number | null {
    const m = parsearMonto(monto);
    const t = tasaIva === null || tasaIva.trim() === '' ? NaN : Number(tasaIva);

    if (m === null || !Number.isFinite(t)) return null;

    const divisor = (1 + t) * 1.06;

    return divisor <= 0 ? null : redondear2((m * 0.06) / divisor);
}

/** true si el importe del servidor (texto decimal) es mayor que cero. Solo compara: no suma ni resta nada. null y vacío no son positivos. */
export function esMontoPositivo(valor: Monto): boolean {
    if (valor === null || valor === undefined || valor === '') return false;

    const numero = Number(valor);

    return !Number.isNaN(numero) && numero > 0;
}

/**
 * Fecha y hora que el servidor guarda SIN zona ("2026-09-30 14:30:00"): se muestran tal cual, sin pasar por `Date`,
 * que las interpretaría en la zona del navegador y correría la hora. "30/09/2026 14:30", o "—" si no hay.
 */
export function fechaHoraSinZona(valor: string | null | undefined): string {
    const partes = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(valor ?? '');

    return partes ? `${partes[3]}/${partes[2]}/${partes[1]} ${partes[4]}:${partes[5]}` : '—';
}

/** De "2026-09-30 14:30:00" al valor de un `<input type="datetime-local">` ("2026-09-30T14:30"); '' si no hay. */
export function aCampoFechaHora(valor: string | null | undefined): string {
    const partes = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(valor ?? '');

    return partes ? `${partes[1]}T${partes[2]}` : '';
}

/** Del `<input type="datetime-local">` a lo que recibe el servidor ("2026-09-30 14:30:00"); null si está vacío. */
export function deCampoFechaHora(texto: string): string | null {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto) ? `${texto.replace('T', ' ')}:00` : null;
}

/**
 * Los cargos de estancia (pernocta y los dos tránsitos) los pone «Recalcular estancia» con la tarifa de la matrícula; el
 * precio del catálogo es relleno. Por eso no se agregan a mano y, en un renglón, se marcan: el recálculo los reemplaza.
 */
export const esConceptoDeEstancia = (concepto: string | null | undefined): boolean => typeof concepto === 'string' && concepto.startsWith('estancia_');

/** "0.1600" es "16 %". */
export function formatearTasa(tasa: string | null | undefined): string {
    if (tasa === null || tasa === undefined || tasa === '' || Number.isNaN(Number(tasa))) return '—';

    return `${(Number(tasa) * 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })} %`;
}

/**
 * "2026-09-30" en hora de México, a partir de lo que serializa el servidor para una fecha (instante UTC, o ya "aaaa-mm-dd").
 * Es la forma de armar el valor de un campo de fecha sin correr un día; null si no hay una fecha válida.
 */
export function fechaIsoMexico(valor: string | null | undefined): string | null {
    if (!valor) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;

    const fecha = new Date(valor);

    return Number.isNaN(fecha.getTime()) ? null : FORMATO_FECHA_MX.format(fecha);
}
