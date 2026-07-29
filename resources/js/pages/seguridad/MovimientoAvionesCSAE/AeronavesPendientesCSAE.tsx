import {
    AlertCircle,
    CalendarDays,
    Clock3,
    Plane,
    RefreshCw,
    Route,
    Truck,
    X,
} from 'lucide-react';

import type {
    AeronavePendienteCSAE,
} from '@/stores/apiMovimientoCSAE';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    aeronaves: AeronavePendienteCSAE[];
    loading?: boolean;
    error?: string | null;
    onReload?: () => void;
}

export default function AeronavesPendientesCSAE({
    isOpen,
    onClose,
    aeronaves,
    loading = false,
    error = null,
    onReload,
}: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[130]">
            {/* Fondo */}
            <button
                type="button"
                aria-label="Cerrar aeronaves pendientes"
                onClick={onClose}
                className="absolute inset-0 h-full w-full cursor-default bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300"
            />

            {/* Panel lateral */}
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
                {/* Encabezado */}
                <div className="border-b border-orange-200 bg-orange-50 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-white text-orange-600 shadow-sm">
                                <AlertCircle size={20} />
                            </div>

                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                                    Aeronaves pendientes
                                </h3>

                                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-orange-600">
                                    Sin salida registrada de CSAE
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {onReload && (
                                <button
                                    type="button"
                                    onClick={onReload}
                                    disabled={loading}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-orange-100 hover:text-orange-600 disabled:opacity-50"
                                    title="Actualizar pendientes"
                                >
                                    <RefreshCw
                                        size={18}
                                        className={loading ? 'animate-spin' : ''}
                                    />
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-orange-100 hover:text-orange-600"
                                title="Cerrar"
                            >
                                <X size={19} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg border border-orange-200 bg-white px-4 py-3">
                        <div>
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Total pendiente
                            </span>

                            <span className="text-2xl font-black text-slate-800">
                                {aeronaves.length}
                            </span>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                            <Plane size={21} />
                        </div>
                    </div>
                </div>

                {/* Contenido */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                            <RefreshCw
                                size={28}
                                className="mb-3 animate-spin text-orange-500"
                            />

                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Cargando aeronaves...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                            <AlertCircle
                                size={30}
                                className="mb-3 text-red-500"
                            />

                            <p className="text-[10px] font-black uppercase tracking-wider text-red-600">
                                No fue posible cargar los datos
                            </p>

                            <p className="mt-2 text-[10px] font-medium text-red-500">
                                {error}
                            </p>

                            {onReload && (
                                <button
                                    type="button"
                                    onClick={onReload}
                                    className="mt-4 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-[10px] font-black uppercase text-white transition-colors hover:bg-red-700"
                                >
                                    <RefreshCw size={13} />
                                    Reintentar
                                </button>
                            )}
                        </div>
                    ) : aeronaves.length === 0 ? (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                                <Plane size={24} />
                            </div>

                            <p className="text-[11px] font-black uppercase tracking-tight text-slate-700">
                                Sin aeronaves pendientes
                            </p>

                            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Todas cuentan con salida registrada
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {aeronaves.map((aeronave) => (
                                <article
                                    key={aeronave.id}
                                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-orange-200 hover:shadow-md"
                                >
                                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-orange-600">
                                                <Plane size={17} />
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-tight text-slate-800">
                                                    {aeronave.matricula || 'SIN MATRÍCULA'}
                                                </h4>

                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                    {aeronave.tipo_aeronave || 'Tipo no registrado'}
                                                </p>
                                            </div>
                                        </div>

                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase text-orange-600">
                                            <AlertCircle
                                                size={11}
                                                className="animate-pulse"
                                            />
                                            Pendiente
                                        </span>
                                    </div>

                                    <div className="space-y-3 p-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                                                <div className="mb-1 flex items-center gap-1.5 text-slate-400">
                                                    <CalendarDays size={12} />

                                                    <span className="text-[8px] font-black uppercase tracking-wider">
                                                        Entrada
                                                    </span>
                                                </div>

                                                <p className="text-[10px] font-bold text-slate-700">
                                                    {aeronave.fecha_entrada || '—'}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                                                <div className="mb-1 flex items-center gap-1.5 text-slate-400">
                                                    <Clock3 size={12} />

                                                    <span className="text-[8px] font-black uppercase tracking-wider">
                                                        Hora
                                                    </span>
                                                </div>

                                                <p className="text-[10px] font-bold text-slate-700">
                                                    {aeronave.hora_entrada || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                                <Truck
                                                    size={13}
                                                    className="shrink-0 text-indigo-500"
                                                />

                                                <span className="font-bold">
                                                    {aeronave.transportista ||
                                                        'Sin transportista'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                                <Route
                                                    size={13}
                                                    className="shrink-0 text-indigo-500"
                                                />

                                                <span className="font-bold">
                                                    {aeronave.como_llega ||
                                                        'Forma de llegada no registrada'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 px-3 py-2">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-orange-500">
                                                Tiempo en CSAE
                                            </span>

                                            <span className="text-[10px] font-black text-orange-700">
                                                {aeronave.tiempo_en_csae ||
                                                    'No disponible'}
                                            </span>
                                        </div>

                                        {aeronave.observaciones_entrada && (
                                            <div>
                                                <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-slate-400">
                                                    Observaciones de entrada
                                                </span>

                                                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-medium leading-relaxed text-slate-600">
                                                    {aeronave.observaciones_entrada}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-200 bg-white p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Cerrar panel
                    </button>
                </div>
            </aside>
        </div>
    );
}
