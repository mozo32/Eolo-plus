import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import RampaForm from './entregaTurnoR/RampaForm';
import { Plus, X } from 'lucide-react';
import TablaJefeArea from './entregaTurnoR/TablaJefeArea';

type Role = { slug: string; nombre: string; };
export type AuthUser = { id: number; name: string; email: string; isAdmin: boolean; roles: Role[]; };

export default function EntregaTurnoR() {
    const [reporteSeleccionado, setReporteSeleccionado] = useState<any>(null);
    const [mostrarNuevoForm, setMostrarNuevoForm] = useState(false);

    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;

    const cerrarModal = () => {
        setReporteSeleccionado(null);
        setMostrarNuevoForm(false);
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Entrega Turno Rampa' }]}>
            <Head title="Entrega Turno Rampa" />

            <div className="p-4">
                <TablaJefeArea
                    onSeleccionar={(reporte) => setReporteSeleccionado(reporte)}
                    onNuevoRegistro={() => setMostrarNuevoForm(true)}
                />
            </div>

            {(reporteSeleccionado || mostrarNuevoForm) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    {mostrarNuevoForm ? 'Registrar Entrega de Turno Rampa' : 'Editar / Firmar Reporte de Rampa'}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Módulo de Operaciones Aeroportuarias</p>
                            </div>
                            <button
                                onClick={cerrarModal}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar bg-slate-50">
                            <RampaForm
                                initialData={reporteSeleccionado}
                                onCancel={cerrarModal}
                            />
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
