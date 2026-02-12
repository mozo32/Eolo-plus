import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import RampaForm from './entregaTurnoR/RampaForm';
import { AlertCircle, Loader2 } from 'lucide-react';
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
    const [entregaPendiente, setEntregaPendiente] = useState<any>(null);
    const [reporteSeleccionado, setReporteSeleccionado] = useState<any>(null); // Nuevo estado
    const [loading, setLoading] = useState(true);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;

    const esJefeArea = user?.roles.some(rol => rol.slug === 'jefe_area');

    useEffect(() => {
        const checkPendingRepo = async () => {
            try {
                // Esta consulta es la que ya tenías para operativos
                const response = await axios.get('/api/EntregaTurnoR/entrega-turno-rampa');
                if (response.data) {
                    setEntregaPendiente(response.data);
                }
            } catch (error) {
                console.error("Error al consultar entregas pendientes", error);
            } finally {
                setLoading(false);
            }
        };
        checkPendingRepo();
    }, []);

    // Función que recibirá la tabla para avisar al padre qué reporte cargar
    const seleccionarReporteParaFirmar = (reporte: any) => {
        setReporteSeleccionado(reporte);
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <AppLayout breadcrumbs={[{ title: 'Entrega Turno' }]}>
            <div className="p-4 space-y-6">

                {esJefeArea ? (
                    reporteSeleccionado ? (
                        <div className="space-y-4">
                            <button
                                onClick={() => setReporteSeleccionado(null)}
                                className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2"
                            >
                                ← Volver a la lista de pendientes
                            </button>
                            <RampaForm initialData={reporteSeleccionado} />
                        </div>
                    ) : (
                        <TablaJefeArea onSeleccionar={seleccionarReporteParaFirmar} />
                    )
                ) : (
                    <RampaForm initialData={entregaPendiente} />
                )}
            </div>
        </AppLayout>
    );
}
