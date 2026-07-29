import { useEffect, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    LoaderCircle,
    Plane,
    Truck,
    X,
    type LucideIcon,
} from 'lucide-react';

import { fetchShowMovimientoCSAE } from '@/stores/apiMovimientoCSAE';

interface Props {
    id: number | null;
    onClose: () => void;
}

const getFirmaByRol = (detalle: any, rol: string) => {
    const firmas = Array.isArray(detalle?.firmas)
        ? detalle.firmas
        : [];

    return (
        firmas.find(
            (firma: any) =>
                firma?.rol === rol &&
                firma?.status !== 'I',
        ) ?? null
    );
};

const formatFecha = (
    fecha?: string | null,
): string => {
    if (!fecha) return '—';

    const normalizada = String(fecha)
        .replace(' ', 'T')
        .replace('Z', '');

    const [fechaParte] = normalizada.split('T');
    const [anio, mes, dia] = fechaParte.split('-');

    if (!anio || !mes || !dia) return fecha;

    return `${dia}/${mes}/${anio}`;
};

const formatHora = (
    fecha?: string | null,
): string => {
    if (!fecha) return '—';

    const normalizada = String(fecha)
        .replace(' ', 'T')
        .replace('Z', '');

    const [, horaParte = ''] =
        normalizada.split('T');

    return horaParte.slice(0, 5) || '—';
};

export default function VistaPreviaCsae({
    id,
    onClose,
}: Props) {
    const [detalle, setDetalle] =
        useState<any>(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setDetalle(null);
            setError(null);
            return;
        }

        let activo = true;

        const cargarVistaPrevia = async () => {
            try {
                setLoading(true);
                setError(null);

                const response =
                    await fetchShowMovimientoCSAE(id);

                const finalData = response?.data
                    ? response.data
                    : response;

                if (activo) {
                    setDetalle(finalData);
                }
            } catch (error: any) {
                console.error(
                    'Error al cargar vista previa:',
                    error,
                );

                if (activo) {
                    setError(
                        error?.message ||
                        'No se pudo cargar el registro',
                    );
                }
            } finally {
                if (activo) {
                    setLoading(false);
                }
            }
        };

        cargarVistaPrevia();

        return () => {
            activo = false;
        };
    }, [id]);

    if (!id) return null;

    const firmaEntrada = getFirmaByRol(
        detalle,
        'firma_entrada',
    );

    const firmaSalida = getFirmaByRol(
        detalle,
        'firma_salida',
    );

    const salio = Boolean(
        detalle?.fecha_hora_salida,
    );

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 md:p-6">
            <button
                type="button"
                aria-label="Cerrar vista previa"
                onClick={onClose}
                className="absolute inset-0 h-full w-full cursor-default bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300"
            />

            <div className="relative z-10 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Encabezado exterior */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 md:text-lg">
                            Vista previa del manifiesto
                        </h3>

                        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                            Movimiento de aeronave CSAE
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-100 p-3 custom-scrollbar md:p-6">
                    {loading ? (
                        <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl bg-white">
                            <LoaderCircle
                                size={34}
                                className="mb-3 animate-spin text-[#003E51]"
                            />

                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Cargando vista previa...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                            <AlertCircle
                                size={34}
                                className="mb-3 text-red-500"
                            />

                            <h4 className="text-sm font-black uppercase text-red-700">
                                No se pudo cargar
                            </h4>

                            <p className="mt-2 text-xs text-red-600">
                                {error}
                            </p>
                        </div>
                    ) : detalle ? (
                        <div className="relative mx-auto min-h-[760px] max-w-4xl overflow-hidden border-2 border-slate-800 bg-white p-5 shadow-xl md:p-8">
                            {/* Marca de agua */}
                            <div
                                className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.04]"
                                style={{
                                    backgroundImage:
                                        "url('/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg')",
                                    backgroundSize: '55%',
                                }}
                            />

                            <div className="relative z-10">
                                {/* Encabezado tipo PDF */}
                                <header className="mb-6 flex border-2 border-slate-900">
                                    <div className="flex w-28 shrink-0 items-center justify-center bg-[#003E51] px-4 py-6 text-white">
                                        <span className="text-xl font-black tracking-[0.25em]">
                                            EOLO
                                        </span>
                                    </div>

                                    <div className="flex-1 px-5 py-4">
                                        <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 md:text-lg">
                                            Manifiesto de movimiento
                                            de aeronave
                                        </h1>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                            <span>
                                                Folio: #CSAE-
                                                {detalle.id}
                                            </span>

                                            <span>
                                                Estado:{' '}
                                                {salio
                                                    ? 'Salida registrada'
                                                    : 'Pendiente de salida'}
                                            </span>
                                        </div>
                                    </div>
                                </header>

                                {/* Estado */}
                                <div
                                    className={`mb-6 flex items-center justify-between rounded-lg border px-4 py-3 ${
                                        salio
                                            ? 'border-emerald-200 bg-emerald-50'
                                            : 'border-orange-200 bg-orange-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {salio ? (
                                            <CheckCircle2
                                                size={20}
                                                className="text-emerald-600"
                                            />
                                        ) : (
                                            <AlertCircle
                                                size={20}
                                                className="animate-pulse text-orange-600"
                                            />
                                        )}

                                        <div>
                                            <span
                                                className={`block text-[10px] font-black uppercase tracking-widest ${
                                                    salio
                                                        ? 'text-emerald-700'
                                                        : 'text-orange-700'
                                                }`}
                                            >
                                                {salio
                                                    ? 'Movimiento completado'
                                                    : 'Aeronave en CSAE'}
                                            </span>

                                            <span className="text-[9px] font-bold text-slate-500">
                                                {salio
                                                    ? 'La entrada y salida están registradas'
                                                    : 'La aeronave aún no cuenta con salida'}
                                            </span>
                                        </div>
                                    </div>

                                    <Plane
                                        size={26}
                                        className={
                                            salio
                                                ? 'text-emerald-600'
                                                : 'text-orange-600'
                                        }
                                    />
                                </div>

                                {/* Datos aeronave */}
                                <section>
                                    <h2 className="mb-3 border-b-2 border-[#003E51] pb-1 text-[10px] font-black uppercase tracking-wider text-[#003E51]">
                                        Datos de la aeronave
                                    </h2>

                                    <div className="grid grid-cols-1 border-l border-t border-slate-800 sm:grid-cols-3">
                                        <InfoItem
                                            label="Matrícula"
                                            value={
                                                detalle.matricula ||
                                                'N/A'
                                            }
                                        />

                                        <InfoItem
                                            label="Tipo de aeronave"
                                            value={
                                                detalle.tipo_aeronave ||
                                                'N/A'
                                            }
                                        />

                                        <InfoItem
                                            label="Transportista o piloto"
                                            value={
                                                detalle.transportista ||
                                                'N/A'
                                            }
                                        />
                                    </div>
                                </section>

                                {/* Entrada */}
                                <section className="mt-6">
                                    <h2 className="mb-3 border-b-2 border-[#003E51] pb-1 text-[10px] font-black uppercase tracking-wider text-[#003E51]">
                                        Registro de entrada
                                    </h2>

                                    <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                           <DetailItem
                                                icon={CalendarDays}
                                                label="Fecha de entrada"
                                                value={formatFecha(detalle.fecha_hora_entrada)}
                                            />

                                            <DetailItem
                                                icon={Clock3}
                                                label="Hora de entrada"
                                                value={formatHora(detalle.fecha_hora_entrada)}
                                            />

                                            <DetailItem
                                                icon={Truck}
                                                label="Cómo llega"
                                                value={detalle.como_llega || 'N/A'}
                                            />
                                        </div>

                                        <div className="mt-4 border-t border-slate-200 pt-4">
                                            <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">
                                                Observaciones de entrada
                                            </span>

                                            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">
                                                {detalle.observaciones_entrada ||
                                                    'Sin observaciones.'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* Salida */}
                                <section className="mt-6">
                                    <h2 className="mb-3 border-b-2 border-[#003E51] pb-1 text-[10px] font-black uppercase tracking-wider text-[#003E51]">
                                        Registro de salida
                                    </h2>

                                    <div
                                        className={`rounded-lg border p-4 ${
                                            salio
                                                ? 'border-slate-300 bg-slate-50'
                                                : 'border-orange-200 bg-orange-50'
                                        }`}
                                    >
                                        {salio ? (
                                            <>
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <DetailItem
                                                        icon={
                                                            CalendarDays
                                                        }
                                                        label="Fecha de salida"
                                                        value={formatFecha(
                                                            detalle.fecha_hora_salida,
                                                        )}
                                                    />

                                                    <DetailItem
                                                        icon={
                                                            Clock3
                                                        }
                                                        label="Hora de salida"
                                                        value={formatHora(
                                                            detalle.fecha_hora_salida,
                                                        )}
                                                    />
                                                </div>

                                                <div className="mt-4 border-t border-slate-200 pt-4">
                                                    <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">
                                                        Observaciones
                                                        de salida
                                                    </span>

                                                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">
                                                        {detalle.observaciones_salida ||
                                                            'Sin observaciones.'}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <AlertCircle
                                                    size={22}
                                                    className="text-orange-600"
                                                />

                                                <div>
                                                    <p className="text-xs font-black uppercase text-orange-700">
                                                        Salida pendiente
                                                    </p>

                                                    <p className="mt-1 text-[10px] font-medium text-orange-600">
                                                        Aún no se registra
                                                        la fecha, hora ni
                                                        firma de salida.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Firmas */}
                                <section className="mt-10">
                                    <h2 className="mb-6 border-b-2 border-[#003E51] pb-1 text-[10px] font-black uppercase tracking-wider text-[#003E51]">
                                        Validaciones
                                    </h2>

                                    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
                                        <FirmaPreview
                                            label="Firma de entrada"
                                            url={
                                                firmaEntrada?.url ||
                                                null
                                            }
                                        />

                                        <FirmaPreview
                                            label="Firma de salida"
                                            url={
                                                firmaSalida?.url ||
                                                null
                                            }
                                        />
                                    </div>
                                </section>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Cerrar vista previa
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="border-b border-r border-slate-800 p-3">
            <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">
                {label}
            </span>

            <span className="mt-1 block text-xs font-black uppercase text-slate-800">
                {value}
            </span>
        </div>
    );
}

function DetailItem({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2 text-[#003E51] shadow-sm">
                <Icon size={16} />
            </div>

            <div>
                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">
                    {label}
                </span>

                <span className="mt-0.5 block text-xs font-bold text-slate-700">
                    {value}
                </span>
            </div>
        </div>
    );
}

function FirmaPreview({
    label,
    url,
}: {
    label: string;
    url: string | null;
}) {
    return (
        <div className="flex flex-col items-center">
            <div className="flex h-24 w-full items-end justify-center">
                {url ? (
                    <img
                        src={url}
                        alt={label}
                        className="max-h-24 max-w-[180px] object-contain"
                    />
                ) : (
                    <span className="mb-3 text-[9px] font-bold uppercase tracking-wider text-slate-300">
                        Sin firma
                    </span>
                )}
            </div>

            <div className="w-full border-t border-slate-800 pt-2 text-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    {label}
                </span>
            </div>
        </div>
    );
}
