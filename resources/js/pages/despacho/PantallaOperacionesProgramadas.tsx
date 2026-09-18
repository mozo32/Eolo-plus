import { Head } from '@inertiajs/react';
import { AlertCircle, Moon, Plane, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import TablaOperacionesProgramadas from './operacionesProgramadas/TablaOperacionesProgramadas';
import { usePantallaProgramadas } from './operacionesProgramadas/usePantallaProgramadas';
import { usePantallaTema } from './operacionesProgramadas/usePantallaTema';

/**
 * Clases de la página por tema. El JSX es uno solo; aquí solo cambian colores.
 * Rojo/verde de las tablas y el cian del reloj se conservan en ambos.
 */
const TEMA = {
    oscuro: {
        pagina: 'bg-slate-950 text-white',
        encabezado: 'border-slate-800',
        iconoTitulo: 'bg-sky-500/20 text-sky-400',
        titulo: 'text-white',
        fecha: 'text-slate-400',
        reloj: 'text-sky-400',
        botonTema: 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-400',
        error: 'border-red-500/40 bg-red-500/10',
        errorIcono: 'text-red-400',
        errorTexto: 'text-red-300',
    },
    claro: {
        pagina: 'bg-slate-100 text-slate-900',
        encabezado: 'border-slate-300',
        iconoTitulo: 'bg-sky-100 text-sky-700',
        titulo: 'text-slate-900',
        fecha: 'text-slate-600',
        reloj: 'text-sky-700',
        botonTema: 'border-slate-300 bg-white text-slate-700 hover:border-sky-600 hover:text-sky-700',
        error: 'border-red-300 bg-red-50',
        errorIcono: 'text-red-600',
        errorTexto: 'text-red-700',
    },
} as const;

/** Fecha larga en español, con la zona horaria del proyecto. */
const fechaLarga = (): string =>
    new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date());

/** Hora local con segundos, para el reloj del encabezado. */
const horaLarga = (): string =>
    new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date());

/**
 * Vista pública de solo lectura para televisión.
 *
 * Sin sesión, sin AppLayout, sin sidebar y sin ningún control que modifique
 * información. Sus datos salen del endpoint público, que expone únicamente lo
 * que se muestra, y llegan en tiempo real por el canal público de la pantalla.
 * Una operación realizada o cancelada desaparece sola: el endpoint solo
 * devuelve las activas de hoy.
 */
export default function PantallaOperacionesProgramadas() {
    const { salidas, llegadas, cargando, error } = usePantallaProgramadas();
    const { tema, alternar, esClaro } = usePantallaTema();
    const t = TEMA[tema];

    const [reloj, setReloj] = useState(() => horaLarga());
    const [fecha, setFecha] = useState(() => fechaLarga());

    useEffect(() => {
        const intervalo = setInterval(() => {
            setReloj(horaLarga());
            setFecha(fechaLarga());
        }, 1000);

        return () => clearInterval(intervalo);
    }, []);

    return (
        <div className={`flex min-h-screen flex-col p-6 transition-colors duration-300 lg:p-8 ${t.pagina}`}>
            <Head title="Operaciones Programadas · Pantalla" />

            <header className={`mb-6 flex flex-col items-start justify-between gap-3 border-b-2 pb-5 lg:flex-row lg:items-center ${t.encabezado}`}>
                <div className="flex items-center gap-4">
                    <span className={`rounded-2xl p-3 ${t.iconoTitulo}`}>
                        <Plane size={40} />
                    </span>
                    <div>
                        <h1 className={`text-4xl font-black uppercase tracking-tight lg:text-5xl ${t.titulo}`}>
                            Operaciones Programadas
                        </h1>
                        <p className={`text-xl font-semibold capitalize lg:text-2xl ${t.fecha}`}>{fecha}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className={`font-mono text-5xl font-black tabular-nums lg:text-6xl ${t.reloj}`}>
                        {reloj}
                    </span>

                    {/* Preferencia local de la televisión; no toca el tema del resto del sistema. */}
                    <button
                        type="button"
                        onClick={alternar}
                        title={esClaro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
                        aria-label={esClaro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm transition-colors ${t.botonTema}`}
                    >
                        {esClaro ? <Moon size={28} /> : <Sun size={28} />}
                    </button>
                </div>
            </header>

            {error && (
                <div className={`mb-6 flex items-center gap-4 rounded-2xl border-2 p-5 ${t.error}`}>
                    <AlertCircle className={`shrink-0 ${t.errorIcono}`} size={32} />
                    <p className={`text-2xl font-bold ${t.errorTexto}`}>{error}</p>
                </div>
            )}

            {/* Salidas arriba, llegadas abajo, siempre. */}
            <main className="flex min-h-0 flex-1 flex-col gap-8">
                <TablaOperacionesProgramadas
                    tipo="salida"
                    operaciones={salidas}
                    cargando={cargando}
                    modoPantalla
                    temaPantalla={tema}
                />

                <TablaOperacionesProgramadas
                    tipo="llegada"
                    operaciones={llegadas}
                    cargando={cargando}
                    modoPantalla
                    temaPantalla={tema}
                />
            </main>
        </div>
    );
}
