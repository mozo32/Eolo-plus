/**
 * «Hoy» del proyecto, en formato YYYY-MM-DD, en UN solo sitio.
 *
 * Se calcula con la zona de México y NUNCA con la del equipo ni con UTC:
 *   - recortar a diez caracteres el `toISOString()` de «ahora» es UTC, y se adelanta un día
 *     desde las 18:00 (19:00 en horario de verano) de México;
 *   - `toLocaleDateString` con `en-CA` o `sv-SE` usa la zona del equipo, y un equipo que no
 *     esté en hora de México da otro día.
 * Una prueba (`tests/Feature/FechaHoyTest.php`) impide que esos idiomas vuelvan.
 *
 * LA FUENTE ES EL SERVIDOR. `HandleInertiaRequests` publica la prop `hoy` con el día que el
 * servidor considera hoy, que es el mismo reloj con el que `DentroDeLaVentana` valida. Si el
 * navegador y el servidor discreparan sobre qué día es hoy, el formulario ofrecería una fecha
 * que el servidor rechaza con 422: tomándolo del servidor coinciden por construcción.
 *
 * Esta función no es un hook a propósito: se llama desde inicializadores de estado, ayudantes
 * de módulo y archivos que no son componentes, donde `usePage()` no se puede usar. Por eso
 * guarda el valor en el módulo: `iniciarFechaHoy()` lo siembra con la página inicial y se
 * refresca solo con cada navegación de Inertia.
 *
 * El día del servidor es un ANCLA, no una foto fija. Se guarda cuántos días separan al
 * servidor del reloj del equipo en el momento de recibirlo (casi siempre cero) y a partir de
 * ahí el reloj sigue corriendo: una pestaña que pasa abierta la medianoche —un turno de noche
 * no sale de la misma pantalla— cambia de día sola, sin esperar a la siguiente navegación.
 * Si no hubiera prop (una página sin el middleware, la primera carga antes de iniciar), se
 * cae en `Intl` con `America/Mexico_City`.
 */

const ZONA = 'America/Mexico_City';
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 86_400_000;

const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** Cuántos días hay que sumar al día de México según el reloj del equipo para dar el del servidor. */
let desfaseEnDias = 0;

const aMs = (dia: string): number => {
    const [anio, mes, d] = dia.split('-').map(Number);

    return Date.UTC(anio, mes - 1, d);
};

const sumarDias = (dia: string, dias: number): string =>
    new Date(aMs(dia) + dias * MS_POR_DIA).toISOString().slice(0, 10);

/**
 * Toma el `hoy` del servidor como ancla. Lo que no sea un `YYYY-MM-DD` se ignora: el
 * desfase anterior (o el reloj del equipo) sigue valiendo.
 */
export function anclarFechaHoy(hoyDelServidor: unknown): void {
    if (typeof hoyDelServidor !== 'string' || !DIA.test(hoyDelServidor)) {
        return;
    }

    desfaseEnDias = Math.round((aMs(hoyDelServidor) - aMs(formato.format(new Date()))) / MS_POR_DIA);
}

type PaginaConHoy = { props?: { hoy?: unknown } } | null | undefined;

/**
 * Siembra el ancla con la página inicial y se suscribe a las navegaciones de Inertia
 * (`inertia:navigate` se dispara en `document` tras cada visita, también las parciales,
 * con las props ya fusionadas). Se llama una vez, desde `app.tsx`.
 */
export function iniciarFechaHoy(): void {
    if (typeof document === 'undefined') {
        return;
    }

    try {
        const inicial = document.getElementById('app')?.dataset.page;

        if (inicial) {
            anclarFechaHoy((JSON.parse(inicial) as PaginaConHoy)?.props?.hoy);
        }
    } catch {
        // Sin ancla se usa el reloj del equipo en la zona de México, que es el respaldo.
    }

    document.addEventListener('inertia:navigate', (evento) => {
        anclarFechaHoy(((evento as CustomEvent<{ page?: PaginaConHoy }>).detail?.page)?.props?.hoy);
    });
}

/** El día de hoy (`YYYY-MM-DD`) según el servidor, o según México si aún no hay ancla. */
export function fechaHoy(): string {
    const dia = formato.format(new Date());

    return desfaseEnDias === 0 ? dia : sumarDias(dia, desfaseEnDias);
}
