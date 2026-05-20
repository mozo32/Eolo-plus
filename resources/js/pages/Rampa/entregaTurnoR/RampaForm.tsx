import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { ChevronRight, ChevronLeft, Send, CheckCircle2, ClipboardList, TriangleAlert, Plane, Wrench } from 'lucide-react';
import VehiculosSection from './secciones/VehiculosSection';
import EquiposApoyoSection from './secciones/EquiposApoyoSection';
import GpuInspectionSection from './secciones/GpuInspectionSection';
import RampaExtrasSection from './secciones/RampaExtrasSection';
import RampaSignaturesSection from './secciones/RampaSignaturesSection';
import { actualizarEntregaTurnoRApi, guardarEntregaTurnoRApi, buscarUsuariosRampaApi } from '@/stores/apiEntregaTurnoR';
import { getStepErrors } from './validacionEntregaTurnoR';

interface RampaFormProps {
    initialData?: any;
    onCancel?: () => void;
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
interface SuministroAgua {
    matricula: string;
    cantidad: string;
}
interface VehiculoData {
    opacity?: any;
    limpieza: string;
    nivel?: string;
    llantas: string;
    frenos?: string;
    obs: string;
    luces?: string;
    estado?: 'Operativo' | 'Mantenimiento' | '';
    kilometraje?: string;
    suministros?: SuministroAgua[];
}

const RampaForm: React.FC<RampaFormProps> = ({ initialData, onCancel }) => {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const totalSteps = 4;

    // Estados para el autocompletado de encargado de turno
    const [sugerenciasJefe, setSugerenciasJefe] = useState<any[]>([]);
    const [showDropdownJefe, setShowDropdownJefe] = useState(false);
    const dropdownJefeRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        encabezado: { fecha: new Date().toLocaleDateString('en-CA'), jefeTurno: "" },
        comunicaciones: {
            radiosVHF: "0",
            vhfOperativos: "0",
            radiosUHF: "0",
            uhfOperativos: "0",
            observaciones: ""
        }
    });

    const [vehiculos, setVehiculos] = useState<Record<string, VehiculoData>>({
        nissan012: { limpieza: "", nivel: "0", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo", kilometraje: "" },
        nissan015: { limpieza: "", nivel: "0", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo", kilometraje: "" },
        tractor018: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        lektro003: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        lektro007: { limpieza: "", nivel: "", llantas: "", frenos: "", luces: "", obs: "", estado: "Operativo" },
        aguasNegras008: { limpieza: "", llantas: "", obs: "", estado: "Operativo" },
        aguaPotable: { limpieza: "", llantas: "", obs: "", estado: "Operativo", suministros: [] }
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

    // Cierra el menú desplegable si se hace click en otra zona de la pantalla
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownJefeRef.current && !dropdownJefeRef.current.contains(event.target as Node)) {
                setShowDropdownJefe(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Lógica de búsqueda reactiva con Debounce para el Encargado de Turno
    useEffect(() => {
        const query = formData.encabezado.jefeTurno;
        if (!query.trim() || query.length < 2) {
            setSugerenciasJefe([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            try {
                const data = await buscarUsuariosRampaApi(query);
                setSugerenciasJefe(data || []);
            } catch (error) {
                console.error("Error al buscar encargados:", error);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [formData.encabezado.jefeTurno]);

    useEffect(() => {
        const tieneDatos = initialData && Object.keys(initialData).length > 0;
        if (!tieneDatos) {
            setStep(1);
            return;
        }
        if (initialData.encabezado || initialData.comunicaciones) {
            setFormData(prev => ({
                ...prev,
                encabezado: initialData.encabezado || prev.encabezado,
                comunicaciones: initialData.comunicaciones || prev.comunicaciones
            }));
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
                const mapping: Record<string, { estadoKey: keyof FirmasState, dataKey: string }> = {
                    'quien_entrega': { estadoKey: 'entrega', dataKey: 'nombre_entrega' },
                    'jefe_rampa': { estadoKey: 'jefe', dataKey: 'nombre_jefe_area' },
                    'quien_recibe': { estadoKey: 'recibe', dataKey: 'nombre_recibe' }
                };
                const config = mapping[rol];
                if (config) {
                    const nombreReal = (initialData as any)[config.dataKey] || f.tag || "";
                    nuevasFirmas[config.estadoKey] = {
                        nombre: nombreReal,
                        firma: f.path ? `/storage/${f.path}` : ""
                    };
                }
            });
            setFirmas(nuevasFirmas);
        }
        if (initialData.id) setStep(1);
    }, [initialData]);

    const handleNext = (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        const errors = getStepErrors(step, formData, vehiculos, barrasRemolque, gpus, carritoGolf, aeronaves, firmas);
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
        if (step < totalSteps) setStep(prev => prev + 1);
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
            Swal.fire({ title: "Procesando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
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
                    <div>
                        {step === 1 && (
                            <div className="space-y-10 animate-in fade-in duration-500">
                                <header className="bg-blue-900 text-white p-6 rounded-t-3xl flex justify-between items-center shadow-lg">
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-widest">EOLO</h1>
                                        <p className="text-sm opacity-80 uppercase">Entrega de Turno - Rampa</p>
                                    </div>
                                    <ClipboardList size={40} className="opacity-90" />
                                </header>
                                <div className="px-2 space-y-8">
                                    <h2 className="text-blue-800 font-bold border-b-2 border-blue-100 mb-4 pb-1">Datos Generales</h2>
                                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-400 ml-2 tracking-wider">Fecha</label>
                                            <input
                                                type="date"
                                                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 border border-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50/50 transition-all"
                                                value={formData.encabezado.fecha}
                                                onChange={e => handleUpdate(setFormData, 'encabezado', 'fecha', e.target.value)}
                                            />
                                        </div>

                                        {/* GRUPO OPTIMIZADO CON AUTOCOMPLETADO DE ENCARGADO DE TURNO */}
                                        <div ref={dropdownJefeRef} className="space-y-2 relative">
                                            <label className="text-[11px] font-bold text-slate-400 ml-2 tracking-wider">Encargado de Turno</label>
                                            <input
                                                type="text"
                                                placeholder="Nombre completo"
                                                onFocus={() => setShowDropdownJefe(true)}
                                                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 border border-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50/50 transition-all"
                                                value={formData.encabezado.jefeTurno}
                                                onChange={e => {
                                                    const valor = e.target.value;
                                                    handleUpdate(setFormData, 'encabezado', 'jefeTurno', valor);
                                                    handleUpdate(setFirmas, 'jefe', 'nombre', valor);
                                                    setShowDropdownJefe(true);
                                                }}
                                            />

                                            {/* Dropdown flotante de usuarios */}
                                            {showDropdownJefe && sugerenciasJefe.length > 0 && (
                                                <ul className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl mt-1 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                                                    {sugerenciasJefe.map((usuario: any) => (
                                                        <li
                                                            key={usuario.id}
                                                            onClick={() => {
                                                                handleUpdate(setFormData, 'encabezado', 'jefeTurno', usuario.name);
                                                                handleUpdate(setFirmas, 'jefe', 'nombre', usuario.name);
                                                                setShowDropdownJefe(false);
                                                            }}
                                                            className="px-5 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors uppercase"
                                                        >
                                                            {usuario.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </section>
                                    <section className="space-y-6 pt-4">
                                        <h2 className="text-blue-800 font-bold border-b-2 border-blue-100 mb-4 pb-1">Comunicaciones</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">Radios VHF</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Total</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-full p-3 bg-white rounded-xl font-bold text-slate-700 outline-none border border-slate-200 focus:border-blue-500 transition-all"
                                                            value={formData.comunicaciones.radiosVHF}
                                                            onChange={e => handleUpdate(setFormData, 'comunicaciones', 'radiosVHF', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-green-500 ml-1 uppercase">Operativos</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-full p-3 bg-white rounded-xl font-bold text-green-700 outline-none border border-green-200 focus:border-green-500 transition-all"
                                                            value={formData.comunicaciones.vhfOperativos}
                                                            onChange={e => handleUpdate(setFormData, 'comunicaciones', 'vhfOperativos', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                {Number(formData.comunicaciones.radiosVHF) - Number(formData.comunicaciones.vhfOperativos) > 0 && (
                                                    <p className="text-[10px] font-bold text-red-500 animate-pulse px-1 flex items-center gap-1">
                                                        <TriangleAlert size={12} /> {Number(formData.comunicaciones.radiosVHF) - Number(formData.comunicaciones.vhfOperativos)} radio(s) con falla
                                                    </p>
                                                )}
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">Radios UHF</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Total</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-full p-3 bg-white rounded-xl font-bold text-slate-700 outline-none border border-slate-200 focus:border-blue-500 transition-all"
                                                            value={formData.comunicaciones.radiosUHF}
                                                            onChange={e => handleUpdate(setFormData, 'comunicaciones', 'radiosUHF', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-green-500 ml-1 uppercase">Operativos</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-full p-3 bg-white rounded-xl font-bold text-green-700 outline-none border border-green-200 focus:border-green-500 transition-all"
                                                            value={formData.comunicaciones.uhfOperativos}
                                                            onChange={e => handleUpdate(setFormData, 'comunicaciones', 'uhfOperativos', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                {Number(formData.comunicaciones.radiosUHF) - Number(formData.comunicaciones.uhfOperativos) > 0 && (
                                                    <p className="text-[10px] font-bold text-red-500 animate-pulse px-1">
                                                        <TriangleAlert /> {Number(formData.comunicaciones.radiosUHF) - Number(formData.comunicaciones.uhfOperativos)} radio(s) con falla
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-400 ml-2 tracking-wider uppercase">Observaciones</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Detalle fallas de radios o novedades generales..."
                                                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-medium text-slate-700 border border-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50/50 transition-all"
                                                value={formData.comunicaciones.observaciones}
                                                onChange={e => handleUpdate(setFormData, 'comunicaciones', 'observaciones', e.target.value)}
                                            />
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                        {step === 2 && <VehiculosSection vehiculos={vehiculos} onChange={(id, f, v) => handleUpdate(setVehiculos, id, f, v)} />}
                        {step === 3 && (
                            <div>
                                <header className="bg-blue-900 text-white p-6 rounded-t-lg flex justify-between items-center">
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-widest">CONTROL DE HERRAMIENTAS DE APOYO Y GPUS</h1>
                                        <p className="text-sm opacity-80">ESTADO TÉCNICO Y OPERATIVO DE HERRAMIENTAS DE APOYO Y GPUS</p>
                                    </div>
                                    <Wrench size={40} />
                                </header>
                                <div className="p-6 space-y-8">
                                    <EquiposApoyoSection data={barrasRemolque} onChange={(f, v) => handleUpdate(setBarrasRemolque, null, f, v)} />
                                    <GpuInspectionSection data={gpus} onChange={(id, f, v) => handleUpdate(setGpus, id, f, v)} />
                                </div>
                            </div>
                        )}
                        {step === 4 && (
                            <div className="space-y-8 animate-in slide-in-from-right duration-500">
                                <header className="bg-blue-900 text-white p-6 rounded-t-lg flex justify-between items-center">
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-widest">CONTROL DE AERONAVES Y CARRITO DE GOLF</h1>
                                        <p className="text-sm opacity-80">ESTADO TÉCNICO Y OPERATIVO DE AERONAVES Y CARRITO DE GOLF</p>
                                    </div>
                                    <Plane size={40} />
                                </header>
                                <div className="p-6 space-y-8">
                                    <RampaExtrasSection carrito={carritoGolf} aeronaves={aeronaves} onChangeCarrito={(id, f, v) => handleUpdate(setCarritoGolf, id, f, v)} onChangeAeronaves={(f, v) => handleUpdate(setAeronaves, null, f, v)} />
                                    <RampaSignaturesSection data={firmas} onUpdate={(role: string, field: string, value: any) => handleUpdate(setFirmas, role, field, value)} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-50 p-6 flex justify-between border-t border-slate-100 rounded-b-[2.5rem]">
                        <button
                            type="button"
                            onClick={() => {
                                if (step === 1) {
                                    onCancel && onCancel();
                                } else {
                                    setStep(s => s - 1);
                                }
                            }}
                            className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-all"
                        >
                            <ChevronLeft className="inline mr-1" />
                            {step === 1 ? 'Cancelar' : 'Anterior'}
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
