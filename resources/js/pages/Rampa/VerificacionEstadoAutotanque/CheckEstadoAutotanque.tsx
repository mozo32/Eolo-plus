import Swal from 'sweetalert2';
import React, { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { ClipboardCheck, Truck, PenTool, CheckCircle2, ArrowRight, Save, Layout } from 'lucide-react';
import { SeccionChecklist } from './SeccionChecklist';
import { SeccionVehiculo } from './SeccionVehiculo';
import { SeccionFirmas } from './SeccionFirmas';
import { guardarInspeccion } from '@/stores/apiInspeccionAutoTanque';
import { router } from '@inertiajs/react';
import { reporteEntregaTurno } from '@/routes';
const SECCIONES_CHECK = [
    {
        titulo: "Vehículo General",
        items: ["Faros delanteros y Luces Traseras", "Luces intermitentes", "Llantas y Rines", "Llanta de refacción", "Espejos laterales", "Limpiadores"]
    },
    {
        titulo: "Tanque y Suministro",
        items: ["Bomba y Manguera", "Boquilla 'Single point'", "Unidad de filtrado", "Líneas de conducción", "Gabinete de Manómetros", "Tapa boca hombre"]
    },
    {
        titulo: "Seguridad",
        items: ["Banderines", "Carrete y Cable de tierra", "Interruptor maestro", "Extintores", "Rombo de seguridad", "Alarma de reversa"]
    }
];

type Role = { slug: string; nombre: string; };
export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: { id: number; nombre: string; route: string; }[];
    }[];
};

export const CheckEstadoAutotanque = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const turnoId = urlParams.get('id');

    const [tabActiva, setTabActiva] = useState('checklist');
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [datosVehiculo, setDatosVehiculo] = useState({ km: '', combustible: '50' });
    const [marcasDanos, setMarcasDanos] = useState<any[]>([]);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;

    const totalItems = SECCIONES_CHECK.reduce((acc, s) => acc + s.items.length, 0);
    const checklistCompleto = Object.keys(respuestas).length === totalItems;
    const vehiculoCompleto = datosVehiculo.km.length > 0;
    const todoListo = checklistCompleto && vehiculoCompleto;

    const finalizarInspeccion = async(datosFirmas: any) => {
        const dataLog = {
            turno_id: turnoId,
            fecha: new Date().toLocaleDateString('en-CA'),
            operador: user?.name,
            checklist: respuestas,
            km: datosVehiculo.km,
            combustible: datosVehiculo.combustible,
            danos: marcasDanos,
            firmas: datosFirmas
        };

        try {
            Swal.fire({
                title: "Guardando...",
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false
            });

            await guardarInspeccion(dataLog);
            setRespuestas({});
            setDatosVehiculo({ km: '', combustible: '50' });
            setMarcasDanos([]);
            setTabActiva('checklist');

            Swal.fire({
                icon: "success",
                title: "Completado con éxito",
                text: "La inspección ha sido enviada correctamente."
            }).then(() => {
                // Opcional: Redirigir de vuelta al reporte después de guardar
                router.get(reporteEntregaTurno());
            });

        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al procesar"
            });
        }
    };

    const manejarSiguiente = () => {
        if (tabActiva === 'checklist') setTabActiva('vehiculo');
        else if (tabActiva === 'vehiculo') setTabActiva('firmas');
    };

    return (
        <div className="max-w-4xl mx-auto bg-white min-h-screen pb-10 font-sans text-slate-700">
            <header className="px-6 py-8 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Layout size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800">Inspección de Unidad</h1>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Protocolo de Seguridad</p>
                    </div>
                </div>
                <div className="bg-emerald-50 px-4 py-2 rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">En Línea</span>
                </div>
            </header>

            <nav className="flex p-4 gap-2">
                <StepButton
                    label="Revisión"
                    active={tabActiva === 'checklist'}
                    done={checklistCompleto}
                    onClick={() => setTabActiva('checklist')}
                />
                <StepButton
                    label="Bitácora"
                    active={tabActiva === 'vehiculo'}
                    done={vehiculoCompleto}
                    onClick={() => setTabActiva('vehiculo')}
                />
                <StepButton
                    label="Firmas"
                    active={tabActiva === 'firmas'}
                    done={todoListo}
                    onClick={() => setTabActiva('firmas')}
                />
            </nav>

            <main className="p-4 md:p-6 min-h-[500px]">
                <div className="bg-slate-50/50 rounded-[2.5rem] p-6 border border-slate-100 shadow-inner">
                    {tabActiva === 'checklist' && (
                        <SeccionChecklist
                            secciones={SECCIONES_CHECK}
                            respuestas={respuestas}
                            onToggle={(item, val) => setRespuestas({ ...respuestas, [item]: val })}
                        />
                    )}
                    {tabActiva === 'vehiculo' && (
                        <SeccionVehiculo
                            datos={datosVehiculo}
                            onChange={setDatosVehiculo}
                        />
                    )}
                    {tabActiva === 'firmas' && (
                        <SeccionFirmas
                            estaCompleto={todoListo}
                            marcas={marcasDanos}
                            setMarcas={setMarcasDanos}
                            onGuardar={finalizarInspeccion}
                        />
                    )}
                </div>

                <div className="mt-8 px-2">
                    {tabActiva !== 'firmas' && (
                        <button
                            onClick={manejarSiguiente}
                            className="w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-blue-600 text-white shadow-xl shadow-blue-100 hover:bg-blue-700"
                        >
                            CONTINUAR A {tabActiva === 'checklist' ? 'BITÁCORA' : 'FIRMAS'}
                            <ArrowRight size={20} />
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
};

const StepButton = ({ label, active, done, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3 px-2 rounded-2xl transition-all flex items-center justify-center gap-2 border-2 ${
            active ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'bg-transparent border-transparent text-slate-400'
        }`}
    >
        {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500' : 'bg-slate-300'}`}></div>}
        <span className="text-[11px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
);
