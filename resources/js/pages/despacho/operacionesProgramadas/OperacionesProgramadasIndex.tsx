import { usePage } from '@inertiajs/react';
import { pantallaProgramadas } from '@/routes';
import { AlertCircle, CalendarDays, Plus, ShieldBan, Tv } from 'lucide-react';
import { useMemo, useState } from 'react';
import AlertaRestricciones from './AlertaRestricciones';
import MatriculasRestringidasModal from './MatriculasRestringidasModal';
import OperacionProgramadaModal from './OperacionProgramadaModal';
import TablaOperacionesProgramadas from './TablaOperacionesProgramadas';
import { useMatriculasRestringidas } from './useMatriculasRestringidas';
import { useOperacionesProgramadas } from './useOperacionesProgramadas';
import {
    puedeAdministrarProgramadas,
    type OperacionProgramada,
    type TabProgramadas,
    type UsuarioAutenticado,
} from './types';

const TABS: { key: TabProgramadas; label: string }[] = [
    { key: 'ambas', label: 'Ambas' },
    { key: 'salidas', label: 'Salidas' },
    { key: 'llegadas', label: 'Llegadas' },
];

export default function OperacionesProgramadasIndex() {
    const { fecha, setFecha, tab, setTab, salidas, llegadas, cargando, error, cargar, eliminar } =
        useOperacionesProgramadas();

    const [modalAbierto, setModalAbierto] = useState(false);
    const [restriccionesAbiertas, setRestriccionesAbiertas] = useState(false);
    const [enEdicion, setEnEdicion] = useState<OperacionProgramada | null>(null);

    // Mismo criterio que aplica el middleware subdep en el backend.
    const { auth } = usePage<{ auth: { user: UsuarioAutenticado | null } }>().props;
    const puedeRestringir = useMemo(() => puedeAdministrarProgramadas(auth?.user), [auth?.user]);

    // Una sola instancia para toda la pantalla: la comparten el icono de alerta
    // y el modal, así no se duplican consultas ni listeners.
    const restricciones = useMatriculasRestringidas(true);

    const abrirNueva = () => {
        setEnEdicion(null);
        setModalAbierto(true);
    };

    const abrirEdicion = (operacion: OperacionProgramada) => {
        setEnEdicion(operacion);
        setModalAbierto(true);
    };

    const cerrarModal = () => {
        setModalAbierto(false);
        setEnEdicion(null);
    };

    const mostrarSalidas = tab === 'ambas' || tab === 'salidas';
    const mostrarLlegadas = tab === 'ambas' || tab === 'llegadas';

    return (
        <div className="space-y-6 p-4 md:p-6">
            <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-800 md:text-2xl">
                            Operaciones Programadas
                        </h1>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Planeación de llegadas y salidas · Despacho
                        </p>
                    </div>

                    <AlertaRestricciones restricciones={restricciones.restricciones} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                        <CalendarDays
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                        />
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-[#00677F] focus:ring-1 focus:ring-[#00677F] sm:w-auto"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={abrirNueva}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#00677F] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#00586D]"
                    >
                        <Plus size={18} />
                        Programar operación
                    </button>

                    {/* Se abre en otra pestaña para que este tablero siga abierto. */}
                    <a
                        href={pantallaProgramadas.url()}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir la vista de solo lectura para televisión"
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-[#00677F]"
                    >
                        <Tv size={18} />
                        Vista para pantalla
                    </a>

                    {puedeRestringir && (
                        <button
                            type="button"
                            onClick={() => setRestriccionesAbiertas(true)}
                            title="Administrar matrículas restringidas"
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-red-600"
                        >
                            <ShieldBan size={18} />
                            Restringir
                        </button>
                    )}
                </div>
            </header>

            <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1.5">
                {TABS.map(item => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={`rounded-xl px-5 py-2.5 text-xs font-bold uppercase transition-all md:text-sm ${
                            tab === item.key ? 'bg-white text-[#00677F] shadow-md' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                    <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {mostrarSalidas && (
                    <TablaOperacionesProgramadas
                        tipo="salida"
                        operaciones={salidas}
                        cargando={cargando}
                        onEditar={abrirEdicion}
                        onEliminar={eliminar}
                    />
                )}

                {mostrarLlegadas && (
                    <TablaOperacionesProgramadas
                        tipo="llegada"
                        operaciones={llegadas}
                        cargando={cargando}
                        onEditar={abrirEdicion}
                        onEliminar={eliminar}
                    />
                )}
            </div>

            {restriccionesAbiertas && (
                <MatriculasRestringidasModal
                    restricciones={restricciones}
                    onCerrar={() => setRestriccionesAbiertas(false)}
                />
            )}

            {modalAbierto && (
                <OperacionProgramadaModal
                    fecha={fecha}
                    operacion={enEdicion}
                    onCerrar={cerrarModal}
                    onGuardado={() => {
                        cerrarModal();
                        cargar();
                    }}
                />
            )}
        </div>
    );
}
