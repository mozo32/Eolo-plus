import { useEffect, useState } from 'react';
import {
    CalendarDays,
    Car,
    Clock3,
    MapPin,
    TriangleAlert,
    UserRound,
    X,
} from 'lucide-react';

import {
    obtenerVehiculosMasDeCincoDias,
    VehiculoAlerta,
} from '@/stores/apiEstacionamientoSubterraneo';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onTotalChange?: (total: number) => void;
}

const VehiculosEstacionados = ({
    isOpen,
    onClose,
    onTotalChange,
}: Props) => {
    const [vehiculos, setVehiculos] = useState<VehiculoAlerta[]>([]);
    const [fechaCorte, setFechaCorte] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let componenteActivo = true;

        const cargarVehiculos = async () => {
            try {
                setLoading(true);
                setError('');

                const response = await obtenerVehiculosMasDeCincoDias();

                if (!componenteActivo) return;

                setVehiculos(response.vehiculos || []);
                setFechaCorte(response.fecha_corte);
                onTotalChange?.(response.total || 0);
            } catch (error) {
                if (!componenteActivo) return;

                console.error(error);

                setVehiculos([]);
                setFechaCorte(null);
                setError(
                    error instanceof Error
                        ? error.message
                        : 'No fue posible cargar los vehículos',
                );

                onTotalChange?.(0);
            } finally {
                if (componenteActivo) {
                    setLoading(false);
                }
            }
        };

        cargarVehiculos();

        return () => {
            componenteActivo = false;
        };
    }, [isOpen, onTotalChange]);

    useEffect(() => {
        if (!isOpen) return;

        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        const overflowAnterior = document.body.style.overflow;

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', cerrarConEscape);

        return () => {
            document.body.style.overflow = overflowAnterior;
            document.removeEventListener('keydown', cerrarConEscape);
        };
    }, [isOpen, onClose]);

    const formatearFecha = (fecha?: string | null) => {
        if (!fecha) return 'N/A';

        const fechaNormalizada = fecha.includes('T')
            ? fecha
            : `${fecha}T00:00:00`;

        return new Date(fechaNormalizada).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[160]">
            <button
                type="button"
                aria-label="Cerrar panel"
                onClick={onClose}
                className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-[2px] animate-in fade-in duration-300"
            />

            <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-[#f3f4f6] shadow-2xl animate-in slide-in-from-right-full duration-300">
                {/* Encabezado */}
                <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-red-100 text-red-600">
                                <TriangleAlert size={23} />
                            </div>

                            <div>
                                <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">
                                    Vehículos con alerta
                                </h2>

                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Más de 5 días consecutivos
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            title="Cerrar"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Resumen */}
                <div className="shrink-0 px-5 pt-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Total de alertas
                            </span>

                            <div className="mt-1 flex items-center gap-2">
                                <Car size={18} className="text-red-500" />

                                <span className="text-2xl font-black text-slate-800">
                                    {vehiculos.length}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Fecha de revisión
                            </span>

                            <div className="mt-1 flex items-center gap-2">
                                <CalendarDays
                                    size={18}
                                    className="shrink-0 text-indigo-500"
                                />

                                <span className="text-[11px] font-black capitalize text-slate-800">
                                    {formatearFecha(fechaCorte)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contenido */}
                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5">
                    {loading ? (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

                            <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Consultando vehículos...
                            </span>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 text-center">
                            <TriangleAlert
                                size={36}
                                className="mb-3 text-red-500"
                            />

                            <p className="text-sm font-bold text-red-700">
                                {error}
                            </p>
                        </div>
                    ) : vehiculos.length === 0 ? (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-center">
                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <Car size={28} />
                            </div>

                            <h3 className="text-sm font-black uppercase text-slate-700">
                                Sin vehículos en alerta
                            </h3>

                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                                No hay vehículos con más de cinco días
                                consecutivos registrados.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {vehiculos.map((vehiculo) => (
                                <article
                                    key={vehiculo.id}
                                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                                >
                                    <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Car
                                                size={17}
                                                className="text-red-600"
                                            />

                                            <span className="text-sm font-black uppercase text-slate-800">
                                                {vehiculo.placas}
                                            </span>
                                        </div>

                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white">
                                            <Clock3 size={12} />
                                            {vehiculo.dias_estacionado} días
                                        </span>
                                    </div>

                                    <div className="space-y-4 p-4">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                Vehículo
                                            </span>

                                            <p className="text-sm font-bold text-slate-700">
                                                {vehiculo.vehiculo || 'N/A'}

                                                {vehiculo.color && (
                                                    <span className="font-medium text-slate-500">
                                                        {' '}
                                                        · {vehiculo.color}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="flex items-start gap-2">
                                                <UserRound
                                                    size={15}
                                                    className="mt-0.5 shrink-0 text-indigo-500"
                                                />

                                                <div>
                                                    <span className="block text-[9px] font-black uppercase text-slate-400">
                                                        Responsable
                                                    </span>

                                                    <span className="text-[11px] font-bold text-slate-700">
                                                        {vehiculo.responsable ||
                                                            'N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <MapPin
                                                    size={15}
                                                    className="mt-0.5 shrink-0 text-emerald-500"
                                                />

                                                <div>
                                                    <span className="block text-[9px] font-black uppercase text-slate-400">
                                                        Matrícula
                                                    </span>

                                                    <span className="text-[11px] font-bold text-slate-700">
                                                        {vehiculo.matricula ||
                                                            'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">
                                                    Inicio de permanencia
                                                </span>

                                                <span className="text-[11px] font-bold capitalize text-slate-700">
                                                    {formatearFecha(
                                                        vehiculo.fecha_inicio,
                                                    )}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">
                                                    Último registro
                                                </span>

                                                <span className="text-[11px] font-bold capitalize text-slate-700">
                                                    {formatearFecha(
                                                        vehiculo.fecha_ultimo_registro,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
};

export default VehiculosEstacionados;
