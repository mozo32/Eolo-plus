import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import RampaForm from './entregaTurnoR/RampaForm';
import { Loader2, Plus, ClipboardList } from 'lucide-react';
import TablaJefeArea from './entregaTurnoR/TablaJefeArea';
import axios from 'axios';

type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
};

export default function EntregaTurnoR() {
    const [reporteSeleccionado, setReporteSeleccionado] = useState<any>(null);
    const [mostrarNuevoForm, setMostrarNuevoForm] = useState(false);
    const [loading, setLoading] = useState(true);

    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;

    const esJefeArea = user?.roles.some(rol => rol.slug === 'jefe_area');
    const esAdmin = user?.isAdmin || user?.roles.some(rol => rol.slug === 'admin');


    const seleccionarReporteParaFirmar = (reporte: any) => {
        setReporteSeleccionado(reporte);
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Entrega Turno' }]}>
            <div className="p-4 space-y-6">
                {(reporteSeleccionado || mostrarNuevoForm) ? (
                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                setReporteSeleccionado(null);
                                setMostrarNuevoForm(false);
                            }}
                            className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2 transition-colors"
                        >
                            ← Volver a la lista de pendientes
                        </button>
                        <RampaForm initialData={reporteSeleccionado} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button
                                onClick={() => setMostrarNuevoForm(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                <Plus size={20} />
                                NUEVO REGISTRO
                            </button>
                        </div>
                        <TablaJefeArea onSeleccionar={seleccionarReporteParaFirmar} />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
