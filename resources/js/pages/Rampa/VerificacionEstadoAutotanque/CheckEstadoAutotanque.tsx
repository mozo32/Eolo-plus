import Swal from 'sweetalert2';
import React, { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { CheckCircle2, ArrowRight, Layout } from 'lucide-react';
import { SeccionChecklist } from './SeccionChecklist';
import { SeccionVehiculo, type DatosVehiculo } from "./SeccionVehiculo";
import { SeccionFirmas } from './SeccionFirmas';
import { guardarInspeccion, fetchInspeccionPorTurno } from '@/stores/apiInspeccionAutoTanque';
import { reporteEntregaTurno } from '@/routes';

interface CheckEstadoProps { data?: any; onSuccess?: () => void; }

const DATOS_VEHICULO_INICIALES: DatosVehiculo = { km: "", combustible: "50", suministroCombustible: { suministrado: "", hora: "", litros: "", horometro: "" } };

const SECCIONES_CHECK = [
    { titulo: "Vehículo General", items: ["Faros delanteros y Luces Traseras", "Luces intermitentes", "Llantas y Rines", "Llanta de refacción", "Espejos laterales", "Limpiadores"] },
    { titulo: "Tanque y Suministro", items: ["Bomba y Manguera", "Boquilla 'Single point'", "Unidad de filtrado", "Líneas de conducción", "Gabinete de Manómetros", "Tapa boca hombre"] },
    { titulo: "Seguridad", items: ["Banderines", "Carrete y Cable de tierra", "Interruptor maestro", "Extintores", "Rombo de seguridad", "Alarma de reversa"] }
];

const TOTAL_DRENES = 6;
const ITEMS_COMBUSTIBLE = ["Toma de Muestra de Combustible", "Prueba de claridad y Brillantez", "Presencia de Sólidos y/o agua de forma visual"];

const NOMBRES_DRENES_VALIDACION: Record<number, string> = {
    1: "Delantero del tanque", 2: "Strainer", 3: "Succión auxiliar", 4: "Trasero del tanque", 5: "Entrada a elementos filtrantes", 6: "Salida de elementos filtrantes"
};

const crearLlaveCombustible = (item: string, numDren: number) => {
    const nombreDren = NOMBRES_DRENES_VALIDACION[numDren] || `${numDren}`;
    return `${item} - Dren ${nombreDren.toLowerCase()}`;
};

type Role = { slug: string; nombre: string; };
export type AuthUser = {
    id: number; name: string; email: string; isAdmin: boolean; roles: Role[];
    departamentos: { id: number; nombre: string; subdepartamentos: { id: number; nombre: string; route: string; }[]; }[];
};

export const CheckEstadoAutotanque = ({ data: dataProp, onSuccess }: CheckEstadoProps) => {
    const turnoId = dataProp?.data?.turno?.id || dataProp?.id;
    const [cargando, setCargando] = useState(false);
    const [firmasCargadas, setFirmasCargadas] = useState<Record<string, string>>({});
    const [tabActiva, setTabActiva] = useState('checklist');
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [datosVehiculo, setDatosVehiculo] = useState<DatosVehiculo>(DATOS_VEHICULO_INICIALES);
    const [marcasDanos, setMarcasDanos] = useState<any[]>([]);
    const [fotos, setFotos] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;

    const checklistCompleto = (() => {
        const checklistGeneralCompleto = SECCIONES_CHECK.every(seccion => seccion.items.every(item => Boolean(respuestas[item])));
        const combustibleCompleto = Array.from({ length: TOTAL_DRENES }, (_, i) => i + 1).every(numDren => {
            const tomaKey = crearLlaveCombustible("Toma de Muestra de Combustible", numDren);
            const claridadKey = crearLlaveCombustible("Prueba de claridad y Brillantez", numDren);
            const solidosKey = crearLlaveCombustible("Presencia de Sólidos y/o agua de forma visual", numDren);
            const toma = respuestas[tomaKey];
            if (!toma) return false;
            if (toma === "No") return true;
            return Boolean(respuestas[claridadKey]) && Boolean(respuestas[solidosKey]);
        });
        return checklistGeneralCompleto && combustibleCompleto;
    })();

    const vehiculoCompleto = datosVehiculo.km.length > 0;
    const todoListo = checklistCompleto && vehiculoCompleto;

    useEffect(() => {
        const cargarDatosExistentes = async () => {
            if (!turnoId) return;
            setCargando(true);
            try {
                const data = await fetchInspeccionPorTurno(turnoId);
                if (data) {
                    setRespuestas(data.checklist || {});
                    const suministroGuardado = data.suministro_combustible ?? data.suministroCombustible ?? {};
                    setDatosVehiculo({
                        km: data.km?.toString() || "",
                        combustible: data.combustible?.toString() || "50",
                        suministroCombustible: {
                            suministrado: suministroGuardado.suministrado ?? "",
                            hora: suministroGuardado.hora ?? "",
                            litros: suministroGuardado.litros?.toString() ?? "",
                            horometro: suministroGuardado.horometro?.toString() ?? "",
                        },
                    });
                    setMarcasDanos(data.danos || []);
                    setFirmasCargadas(data.firmas_db || {});
                    if (data.evidencias && data.evidencias.length > 0) setPreviews(data.evidencias.map((ev: any) => ev.url));
                }
            } catch (error) {
                console.error("Error cargando inspección previa:", error);
            } finally {
                setCargando(false);
            }
        };
        cargarDatosExistentes();
    }, [turnoId]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const finalizarInspeccion = async (datosFirmas: any) => {
        try {
            Swal.fire({ title: "Guardando...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            const nuevasEvidenciasBase64 = await Promise.all(fotos.map(foto => fileToBase64(foto)));
            const dataLog = {
                turno_id: turnoId,
                fecha: new Date().toLocaleDateString('en-CA'),
                operador: user?.name,
                checklist: respuestas,
                km: datosVehiculo.km,
                combustible: datosVehiculo.combustible,
                suministro_combustible: {
                    suministrado: datosVehiculo.suministroCombustible.suministrado,
                    horometro: datosVehiculo.suministroCombustible.horometro,
                    hora: datosVehiculo.suministroCombustible.hora,
                    litros: datosVehiculo.suministroCombustible.litros,
                },
                danos: marcasDanos,
                firmas: datosFirmas,
                evidencias: nuevasEvidenciasBase64,
            };
            await guardarInspeccion(dataLog);
            setRespuestas({});
            setDatosVehiculo(DATOS_VEHICULO_INICIALES);
            setMarcasDanos([]);
            setFotos([]);
            setTabActiva('checklist');
            Swal.fire({ icon: "success", title: "Completado con éxito", text: "La inspección ha sido enviada correctamente." }).then(() => {
                if (onSuccess) onSuccess();
                else router.get(reporteEntregaTurno());
            });
        } catch (error: any) {
            Swal.fire({ icon: "error", title: "Error", text: error?.message || "Error al procesar" });
        }
    };

    const manejarSiguiente = () => {
        if (tabActiva === 'checklist') setTabActiva('vehiculo');
        else if (tabActiva === 'vehiculo') setTabActiva('firmas');
    };

    if (cargando) return <div className="max-w-4xl mx-auto bg-white p-10 text-center font-bold text-slate-500">Cargando inspección...</div>;

    return (
        <div className="max-w-4xl mx-auto bg-white pb-10 font-sans text-slate-700">
            <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Layout size={20} /></div>
                    <div><h1 className="text-lg font-bold tracking-tight text-slate-800">Inspección #{turnoId}</h1></div>
                </div>
                <div className="bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-emerald-700 uppercase">Protocolo Activo</span>
                </div>
            </header>
            <nav className="flex p-4 gap-2">
                <StepButton label="Revisión" active={tabActiva === 'checklist'} done={checklistCompleto} onClick={() => setTabActiva('checklist')} />
                <StepButton label="Bitácora" active={tabActiva === 'vehiculo'} done={vehiculoCompleto} onClick={() => setTabActiva('vehiculo')} />
                <StepButton label="Firmas" active={tabActiva === 'firmas'} done={todoListo} onClick={() => setTabActiva('firmas')} />
            </nav>
            <main className="p-4 md:p-6 min-h-[400px]">
                <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100 shadow-inner">
                    {tabActiva === 'checklist' && (
                        <SeccionChecklist
                            secciones={SECCIONES_CHECK}
                            itemsCombustible={ITEMS_COMBUSTIBLE}
                            totalDrenes={TOTAL_DRENES}
                            respuestas={respuestas}
                            onToggle={(item, val) => setRespuestas(prev => {
                                const next = { ...prev };
                                if (!val) delete next[item];
                                else next[item] = val;
                                return next;
                            })}
                            fotos={fotos}
                            setFotos={setFotos}
                            previews={previews}
                            setPreviews={setPreviews}
                        />
                    )}
                    {tabActiva === 'vehiculo' && <SeccionVehiculo datos={datosVehiculo} onChange={setDatosVehiculo} />}
                    {tabActiva === 'firmas' && <SeccionFirmas estaCompleto={todoListo} marcas={marcasDanos} setMarcas={setMarcasDanos} onGuardar={finalizarInspeccion} firmasExistentes={firmasCargadas} />}
                </div>
                <div className="mt-8 px-2">
                    {tabActiva !== 'firmas' && (
                        <button onClick={manejarSiguiente} className="w-full py-4 rounded-xl font-bold text-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-blue-600 text-white shadow-lg hover:bg-blue-700">
                            CONTINUAR A {tabActiva === 'checklist' ? 'BITÁCORA' : 'FIRMAS'} <ArrowRight size={18} />
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
};

const StepButton = ({ label, active, done, onClick }: any) => (
    <button onClick={onClick} className={`flex-1 py-3 px-2 rounded-xl transition-all flex items-center justify-center gap-2 border-2 ${active ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'bg-transparent border-transparent text-slate-400'}`}>
        {done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500' : 'bg-slate-300'}`}></div>}
        <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
);
