import AppLayout from '@/layouts/app-layout';
import type { UsuarioAutenticado } from '@/pages/despacho/operacionesProgramadas/types';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { AlertCircle, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import EntregaModal from './relacionPlanta/EntregaModal';
import PrestamoModal from './relacionPlanta/PrestamoModal';
import TablaHistorico from './relacionPlanta/TablaHistorico';
import TarjetaGpu from './relacionPlanta/TarjetaGpu';
import { EQUIPO_GPU, puedeOperarPlanta } from './relacionPlanta/types';
import { useHistoricoPlanta } from './relacionPlanta/useHistoricoPlanta';
import { useRelacionPlanta } from './relacionPlanta/useRelacionPlanta';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Relación de planta' }];

/**
 * Control de préstamo de la GPU N.115: tarjeta con el estado actual arriba y
 * el histórico de préstamos abajo. Solo existe una planta, así que no hay
 * selector de equipo.
 */
export default function RelacionPlanta() {
    const { auth } = usePage<{ auth: { user: UsuarioAutenticado | null } }>().props;
    const puedeOperar = useMemo(() => puedeOperarPlanta(auth?.user), [auth?.user]);

    const gpu = useRelacionPlanta();
    const historico = useHistoricoPlanta();

    const [modal, setModal] = useState<'prestamo' | 'entrega' | null>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    const prestamoAbierto = gpu.actual;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Relación de planta" />
            <div className="min-h-screen bg-[#f3f4f6] p-6">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">Relación de planta</h2>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Control de préstamo · {EQUIPO_GPU}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`flex items-center gap-2 rounded border px-4 py-2 text-[10px] font-black transition-all ${
                                mostrarFiltros ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Filter size={14} />
                            <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                        </button>
                    </div>

                    {gpu.error && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                            <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                            <p className="text-sm font-medium text-red-700">{gpu.error}</p>
                        </div>
                    )}

                    <TarjetaGpu
                        actual={gpu.actual}
                        cargando={gpu.cargando}
                        puedeOperar={puedeOperar}
                        onPrestar={() => setModal('prestamo')}
                        onEntregar={() => setModal('entrega')}
                    />

                    <TablaHistorico historico={historico} mostrarFiltros={mostrarFiltros} />
                </div>
            </div>

            {modal === 'prestamo' && (
                <PrestamoModal
                    ultimoHorometroFin={gpu.ultimoHorometroFin}
                    onCerrar={() => setModal(null)}
                    onGuardar={async payload => {
                        const ok = await gpu.prestar(payload);
                        if (ok) historico.recargar();
                        return ok;
                    }}
                />
            )}

            {modal === 'entrega' && prestamoAbierto && (
                <EntregaModal
                    prestamo={prestamoAbierto}
                    onCerrar={() => setModal(null)}
                    onGuardar={async payload => {
                        const ok = await gpu.finalizar(prestamoAbierto.id, payload);
                        if (ok) historico.recargar();
                        return ok;
                    }}
                />
            )}
        </AppLayout>
    );
}
