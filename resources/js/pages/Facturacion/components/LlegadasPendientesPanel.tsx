import { type LlegadaOperacion } from '@/stores/apiFacturacionCatalogos';
import {
    AlertCircle,
    ChevronRight,
    Clock,
    MapPin,
    Plane,
    X,
} from 'lucide-react';
import { fechaMexico } from './formato';

interface Props {
    llegadas: LlegadaOperacion[];
    /** Todas las pendientes, aunque la lista venga recortada. */
    total: number;
    cargando: boolean;
    error: string | null;
    onCerrar: () => void;
    /** Abre el alta con esta llegada ya elegida. */
    onElegir: (llegada: LlegadaOperacion) => void;
    onReintentar: () => void;
}

/**
 * Panel lateral de llegadas sin prefactura.
 *
 * Mismo armazón que el de Operaciones Diarias —velo que cierra al pulsar y panel a la
 * derecha— para que quien use los dos módulos reconozca el gesto.
 *
 * Si hay más pendientes que tarjetas, se dice cuántas faltan en lugar de dibujarlas todas:
 * el número del botón ya es el de verdad, y una lista interminable no ayuda a nadie.
 */
export default function LlegadasPendientesPanel({
    llegadas,
    total,
    cargando,
    error,
    onCerrar,
    onElegir,
    onReintentar,
}: Props) {
    const ocultas = Math.max(0, total - llegadas.length);

    return (
        <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onCerrar}
            />

            <div className="relative flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl">
                <div className="border-b border-slate-200 bg-white p-6">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-red-100 p-2 text-red-600">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                Llegadas sin prefactura
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={onCerrar}
                            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Cerrar"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">
                        {total === 1 ? (
                            <>
                                Hay{' '}
                                <span className="font-semibold text-red-600">
                                    1
                                </span>{' '}
                                aeronave que llegó y no tiene prefactura.
                            </>
                        ) : (
                            <>
                                Hay{' '}
                                <span className="font-semibold text-red-600">
                                    {total}
                                </span>{' '}
                                aeronaves que llegaron y no tienen prefactura.
                            </>
                        )}
                    </p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {error !== null ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-slate-500">
                            <AlertCircle size={40} className="text-red-400" />
                            <p className="text-sm">{error}</p>
                            <button
                                type="button"
                                onClick={onReintentar}
                                className="text-[10px] font-black tracking-wider text-indigo-600 uppercase hover:text-indigo-800"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : cargando && llegadas.length === 0 ? (
                        <div className="space-y-3">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
                                />
                            ))}
                        </div>
                    ) : llegadas.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                            <Plane size={48} className="mb-4 opacity-20" />
                            <p>Todas las llegadas tienen prefactura</p>
                        </div>
                    ) : (
                        <>
                            {llegadas.map((llegada) => (
                                <button
                                    type="button"
                                    key={llegada.id}
                                    onClick={() => onElegir(llegada)}
                                    className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-red-300 hover:shadow-md"
                                >
                                    <div className="mb-3 flex items-start justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                                                Matrícula
                                            </span>
                                            <span className="text-lg font-black tracking-tight text-slate-700">
                                                {llegada.matricula}
                                            </span>
                                        </div>
                                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[10px] font-bold tracking-tighter text-emerald-700 uppercase">
                                            llegada
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-sm text-slate-600">
                                            <span className="flex items-center gap-1.5">
                                                <Clock
                                                    size={14}
                                                    className="text-slate-400"
                                                />
                                                {fechaMexico(llegada.fecha)} ·{' '}
                                                {llegada.hora.slice(0, 5)}
                                            </span>
                                            {llegada.lugar !== null &&
                                                llegada.lugar !== '' && (
                                                    <span className="flex items-center gap-1.5">
                                                        <MapPin
                                                            size={14}
                                                            className="text-slate-400"
                                                        />
                                                        {llegada.lugar}
                                                    </span>
                                                )}
                                        </div>
                                        <ChevronRight
                                            size={18}
                                            className="text-slate-300 transition-colors group-hover:text-red-400"
                                        />
                                    </div>
                                </button>
                            ))}

                            {ocultas > 0 && (
                                <p className="pt-2 text-center text-xs text-slate-400">
                                    y {ocultas} más. Se muestran las{' '}
                                    {llegadas.length} llegadas más recientes.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
