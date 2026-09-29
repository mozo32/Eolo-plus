/**
 * Formato y validación de importes y fechas de Facturación.
 *
 * Regla que gobierna todo este archivo: un campo vacío y un cero NO son lo
 * mismo. Cero es una tarifa válida (una cortesía); vacío es "sin tarifa" o,
 * en una matrícula, "hereda". Por eso nunca se usa `Number('')` (que da 0) ni
 * `||` / `!valor` para decidir si hay un importe.
 */

/** Máximo de las tarifas de estancia y aterrizaje (decimal 10,2 en el servidor). */
export const TARIFA_MAX = 99999999.99;

/** Máximo y mínimo de un precio de combustible (decimal 10,4; nunca cero). */
export const COMBUSTIBLE_MAX = 999999.9999;
export const COMBUSTIBLE_MIN = 0.0001;

type Monto = string | number | null | undefined;

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

/** Propuesta del precio Eolo a partir del ASA: ($asa + 0.50) * 1.15, redondeada a 4 decimales. */
export const AJUSTE_COMBUSTIBLE = 0.5;
export const MARGEN_COMBUSTIBLE = 1.15;

export function precioEoloSugerido(precioAsa: number): number {
    return Number(((precioAsa + AJUSTE_COMBUSTIBLE) * MARGEN_COMBUSTIBLE).toFixed(4));
}
