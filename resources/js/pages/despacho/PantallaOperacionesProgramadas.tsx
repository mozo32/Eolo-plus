import { Head } from '@inertiajs/react';
import { AlertCircle, Plane } from 'lucide-react';
import { useEffect, useState } from 'react';
import TablaOperacionesProgramadas from './operacionesProgramadas/TablaOperacionesProgramadas';
import { useOperacionesProgramadas } from './operacionesProgramadas/useOperacionesProgramadas';
import { useSesionViva } from './operacionesProgramadas/useSesionViva';

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
 * Vista de solo lectura para televisión.
 *
 * Sin AppLayout, sin sidebar y sin ningún control que modifique información.
 * Reutiliza el mismo hook que la pantalla administrativa, así que hereda gratis
 * el tiempo real, el filtro por operaciones activas —una realizada o cancelada
 * desaparece sola— y el cambio de día a medianoche.
 */
export default function PantallaOperacionesProgramadas() {
    // Sin selector de fecha: el hook se queda en el día local y avanza solo a
    // medianoche, porque nadie cambia la fecha a mano.
    const { salidas, llegadas, cargando, error, cargar } = useOperacionesProgramadas();

    const [reloj, setReloj] = useState(() => horaLarga());
    const [fecha, setFecha] = useState(() => fechaLarga());

    useEffect(() => {
        const intervalo = setInterval(() => {
            setReloj(horaLarga());
            setFecha(fechaLarga());
        }, 1000);

        return () => clearInterval(intervalo);
    }, []);

    // La televisión queda encendida todo el día: sin esto la sesión expira.
    useSesionViva(15, () => cargar(true));

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 p-6 text-white lg:p-8">
            <Head title="Operaciones Programadas · Pantalla" />

            <header className="mb-6 flex flex-col items-start justify-between gap-3 border-b-2 border-slate-800 pb-5 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4">
                    <span className="rounded-2xl bg-sky-500/20 p-3 text-sky-400">
                        <Plane size={40} />
                    </span>
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tight lg:text-5xl">
                            Operaciones Programadas
                        </h1>
                        <p className="text-xl font-semibold capitalize text-slate-400 lg:text-2xl">{fecha}</p>
                    </div>
                </div>

                <span className="font-mono text-5xl font-black tabular-nums text-sky-400 lg:text-6xl">
                    {reloj}
                </span>
            </header>

            {error && (
                <div className="mb-6 flex items-center gap-4 rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-5">
                    <AlertCircle className="shrink-0 text-red-400" size={32} />
                    <p className="text-2xl font-bold text-red-300">{error}</p>
                </div>
            )}

            {/* Salidas arriba, llegadas abajo, siempre. */}
            <main className="flex min-h-0 flex-1 flex-col gap-8">
                <TablaOperacionesProgramadas
                    tipo="salida"
                    operaciones={salidas}
                    cargando={cargando}
                    modoPantalla
                />

                <TablaOperacionesProgramadas
                    tipo="llegada"
                    operaciones={llegadas}
                    cargando={cargando}
                    modoPantalla
                />
            </main>
        </div>
    );
}
