import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { ChevronRight, ChevronLeft, Send, CheckCircle2 } from 'lucide-react';
import VehiculosSection from './secciones/VehiculosSection';
import EquiposApoyoSection from './secciones/EquiposApoyoSection';
import GpuInspectionSection from './secciones/GpuInspectionSection';
import RampaExtrasSection from './secciones/RampaExtrasSection';
import RampaSignaturesSection from './secciones/RampaSignaturesSection';
import { actualizarEntregaTurnoRApi, guardarEntregaTurnoRApi } from '@/stores/apiEntregaTurnoR';
import { getStepErrors } from './validacionEntregaTurnoR';

interface RampaFormProps {
    initialData?: any;
}
interface FirmaData {
    nombre: string;
    firma: string | null;
}

interface FirmasState {
    entrega: FirmaData;
    jefe: FirmaData;
    recibe: FirmaData;
}
interface VehiculoData {
    limpieza: string;
    nivel?: string;
    llantas: string;
    frenos?: string;
    obs: string;
    luces?: string;
    estado?: 'Operativo' | 'Mantenimiento' | '';
}
const RampaForm: React.FC<RampaFormProps> = ({ initialData }) => {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const totalSteps = 4;

    const [formData, setFormData] = useState({
        encabezado: { fecha: new Date().toISOString().split('T')[0], jefeTurno: "" },
        comunicaciones: { radios: "", radioFrecuencia: "", radiosFuncionando: true }
    });

    const [vehiculos, setVehiculos] = useState<Record<string, VehiculoData>>({
        nissan012: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        nissan015: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        tractor005: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        lektro003: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        lektro007: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        aguasNegras008: { limpieza: "", llantas: "", obs: "", estado: "Operativo" },
        aguaPotable: { limpieza: "", llantas: "", obs: "", estado: "Operativo" }
    });

    const [barrasRemolque, setBarrasRemolque] = useState({
        total: "", limpieza: "", estado: "", cabezales: "", cabezalesEstado: "",
        escalerasCantidad: "", escalerasEstado: "", hamburgueseraLimpieza: "", hamburgueseraLlantas: ""
    });

    const [gpus, setGpus] = useState({
        gpu115: { limpia: "", horometro: "", enchufe: "", llantas: "", cableado: "", obs: "" },
        hobart600: { limpia: "", numPlantas: "", enchufe: "", llantas: "", obs: "" },
        foxtronics: { limpia: "", numPlantas: "", enchufe: "", llantas: "", obs: "" }
    });

    const [carritoGolf, setCarritoGolf] = useState({
        "005": { limpieza: "", carga: "0", llantas: "", luces: "", frenos: "", obs: "", estado: "Operativo" }
    });

    const [aeronaves, setAeronaves] = useState({
        hangar1: "", hangar2: "", plataforma_h1: "", plataforma_h2: ""
    });

    const [firmas, setFirmas] = useState<FirmasState>({
        entrega: { nombre: "", firma: null },
        jefe: { nombre: "", firma: null },
        recibe: { nombre: "", firma: null }
    });
    useEffect(() => {
        const tieneDatos = initialData && Object.keys(initialData).length > 0;
        if (!tieneDatos) {
            setStep(1);
            return;
        }
        if (initialData) {
            if (initialData.encabezado || initialData.comunicaciones) {
                setFormData({
                    encabezado: initialData.encabezado || formData.encabezado,
                    comunicaciones: initialData.comunicaciones || formData.comunicaciones
                });
            }
            if (initialData.vehiculos) setVehiculos(initialData.vehiculos);
            if (initialData.barras_remolque) setBarrasRemolque(initialData.barras_remolque);
            if (initialData.gpus) setGpus(initialData.gpus);
            if (initialData.carrito_golf) setCarritoGolf(initialData.carrito_golf);
            if (initialData.aeronaves) setAeronaves(initialData.aeronaves);
            if (initialData.firmas && Array.isArray(initialData.firmas)) {
                const nuevasFirmas: FirmasState = { ...firmas };

                initialData.firmas.forEach((f: any) => {
                    const rol = f.pivot.rol;
                    const mapping: Record<string, keyof FirmasState> = {
                        'quien_entrega': 'entrega',
                        'jefe_rampa': 'jefe',
                        'quien_recibe': 'recibe'
                    };

                    const estadoKey = mapping[rol];
                    if (estadoKey) {
                        nuevasFirmas[estadoKey] = {
                            nombre: f.pivot.tag || "",
                            firma: `/storage/${f.path}`
                        };
                    }
                });

                setFirmas(nuevasFirmas);
            }
        }
        if (initialData.id) {
            setStep(1);
        }

    }, [initialData]);

    const handleNext = (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        const errors = getStepErrors(
            step,
            formData,
            vehiculos,
            barrasRemolque,
            gpus,
            carritoGolf,
            aeronaves,
            firmas
        );
        if (errors.length > 0) {
            Swal.fire({
                title: 'Campos pendientes',
                html: `<div style="text-align: left;">
                        <p>Completa lo siguiente para continuar:</p>
                        <ul style="color: #e11d48; font-size: 0.9em; font-weight: bold; margin-top: 10px;">
                            ${errors.map(err => `<li>• ${err}</li>`).join('')}
                        </ul>
                       </div>`,
                icon: 'warning',
                confirmButtonColor: '#2563eb'
            });
            return;
        }
        if (step < totalSteps) {
            setStep(prev => prev + 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = getStepErrors(step, formData, vehiculos, barrasRemolque, gpus, carritoGolf, aeronaves, firmas);

        if (errors.length > 0) {
            handleNext();
            return;
        }

        const form = { formData, vehiculos, barrasRemolque, gpus, carritoGolf, aeronaves, firmas };

        const result = await Swal.fire({
            title: initialData ? '¿Actualizar reporte?' : '¿Confirmar envío?',
            text: "El reporte se guardará de forma permanente",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0f172a',
            confirmButtonText: 'Sí, enviar reporte',
            cancelButtonText: 'Revisar datos'
        });

        if (result.isConfirmed) {
            setSaving(true);
            Swal.fire({
                title: "Procesando...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                if (initialData?.id) {
                    await actualizarEntregaTurnoRApi(initialData.id, form);
                } else {
                    await guardarEntregaTurnoRApi(form);
                }

                await Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    text: 'El reporte de rampa ha sido registrado correctamente.',
                    confirmButtonColor: '#0f172a',
                });

                window.location.reload();

            } catch (error: any) {
                console.error("Error al enviar:", error);
                Swal.fire({
                    icon: "error",
                    title: "Error al guardar",
                    text: error?.response?.data?.message || error?.message || "No se pudo conectar con el servidor",
                });
            } finally {
                setSaving(false);
            }
        }
    };

    const handleUpdate = (setter: any, id: string | null, field: string, value: any) => {
        setter((prev: any) => {
            if (id) return { ...prev, [id]: { ...prev[id], [field]: value } };
            return { ...prev, [field]: value };
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 px-4">
                    <div className="flex justify-between mb-2">
                        {['Inicio', 'Vehículos', 'Apoyo', 'Final'].map((label, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border text-slate-400'}`}>
                                    {step > i + 1 ? <CheckCircle2 size={16} /> : i + 1}
                                </div>
                                <span className={`text-[9px] mt-1 uppercase font-black ${step === i + 1 ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
                    <div className="p-6 md:p-10">
                        {step === 1 && (
                            <div className="space-y-10 animate-in fade-in duration-500">
                                <section className="space-y-6">
                                    <h2 className="text-2xl font-black italic uppercase text-slate-800">Datos Generales</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Fecha</label>
                                            <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 border border-transparent focus:border-blue-500 transition-all" value={formData.encabezado.fecha} onChange={e => handleUpdate(setFormData, 'encabezado', 'fecha', e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Jefe de Turno</label>
                                            <input type="text" placeholder="Nombre completo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 border border-transparent focus:border-blue-500 transition-all" value={formData.encabezado.jefeTurno} onChange={e => handleUpdate(setFormData, 'encabezado', 'jefeTurno', e.target.value)} />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <h2 className="text-2xl font-black italic uppercase text-slate-800 border-t pt-8">Comunicaciones</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" placeholder="Cant. Radios Interinos " className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500" value={formData.comunicaciones.radios} onChange={e => handleUpdate(setFormData, 'comunicaciones', 'radios', e.target.value)} />
                                        <input type="number" placeholder="Cant. Radios Frecuencia" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500" value={formData.comunicaciones.radioFrecuencia} onChange={e => handleUpdate(setFormData, 'comunicaciones', 'radioFrecuencia', e.target.value)} />
                                    </div>
                                    <button type="button" onClick={() => handleUpdate(setFormData, 'comunicaciones', 'radiosFuncionando', !formData.comunicaciones.radiosFuncionando)}
                                        className={`w-full p-4 rounded-2xl font-black border-2 transition-all ${formData.comunicaciones.radiosFuncionando ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        ESTADO DE RADIOS: {formData.comunicaciones.radiosFuncionando ? "OPERATIVO" : "CON FALLAS"}
                                    </button>
                                </section>
                            </div>
                        )}

                        {step === 2 && <VehiculosSection vehiculos={vehiculos} onChange={(id, f, v) => handleUpdate(setVehiculos, id, f, v)} />}

                        {step === 3 && (
                            <div className="space-y-8 animate-in slide-in-from-right duration-500">
                                <EquiposApoyoSection data={barrasRemolque} onChange={(f, v) => handleUpdate(setBarrasRemolque, null, f, v)} />
                                <GpuInspectionSection data={gpus} onChange={(id, f, v) => handleUpdate(setGpus, id, f, v)} />
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-8 animate-in slide-in-from-right duration-500">
                                <RampaExtrasSection carrito={carritoGolf} aeronaves={aeronaves} onChangeCarrito={(id, f, v) => handleUpdate(setCarritoGolf, id, f, v)} onChangeAeronaves={(f, v) => handleUpdate(setAeronaves, null, f, v)} />
                                <RampaSignaturesSection data={firmas} onUpdate={(role: string, field: string, value: any) => handleUpdate(setFirmas, role, field, value)} />
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 p-6 flex justify-between border-t border-slate-100 rounded-b-[2.5rem]">
                        <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 1} className={`px-6 py-3 font-bold transition-all ${step === 1 ? 'invisible' : 'text-slate-500 hover:text-slate-800'}`}>
                            <ChevronLeft className="inline mr-1" /> Anterior
                        </button>

                        {step < totalSteps ? (
                            <button type="button" onClick={handleNext} className="px-8 py-3 rounded-2xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all">
                                Siguiente <ChevronRight className="inline ml-1" />
                            </button>
                        ) : (
                            <button type="submit" disabled={saving} className="px-10 py-3 rounded-2xl font-bold bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50">
                                {initialData ? 'Actualizar Reporte' : 'Enviar Reporte'} <Send className="inline ml-2" size={18} />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RampaForm;
