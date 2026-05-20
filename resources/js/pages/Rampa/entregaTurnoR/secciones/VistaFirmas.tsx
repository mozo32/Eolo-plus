import React, { useState } from 'react';
import { Save, Radio, Truck, Plane, Layout, Info, Link, ClipboardCheck, Wrench, Zap } from 'lucide-react';
import RampaSignaturesSection from './RampaSignaturesSection';
import { actualizarEntregaTurnoRFirmasApi } from '@/stores/apiEntregaTurnoR';
import Swal from 'sweetalert2';

interface VistaFirmasProps {
    reporteData: any;
    onClose: () => void;
    onSuccess: () => void;
}

const VistaFirmas: React.FC<VistaFirmasProps> = ({ reporteData, onClose, onSuccess }) => {

    const [firmasState, setFirmasState] = useState({
        entrega: {
            nombre: reporteData.nombre_entrega || "",
            firma: reporteData.firmas?.find((f: any) => f.pivot.rol === 'quien_entrega')?.path
                ? `/storage/${reporteData.firmas.find((f: any) => f.pivot.rol === 'quien_entrega').path}`
                : null
        },
        jefe: {
            nombre: reporteData.nombre_jefe_area || "",
            firma: reporteData.firmas?.find((f: any) => f.pivot.rol === 'jefe_rampa')?.path
                ? `/storage/${reporteData.firmas.find((f: any) => f.pivot.rol === 'jefe_rampa').path}`
                : null
        },
        recibe: {
            nombre: reporteData.nombre_recibe || "",
            firma: reporteData.firmas?.find((f: any) => f.pivot.rol === 'quien_recibe')?.path
                ? `/storage/${reporteData.firmas.find((f: any) => f.pivot.rol === 'quien_recibe').path}`
                : null
        }
    });

    const [loading, setLoading] = useState(false);

    const handleUpdate = (role: string, field: string, value: any) => {
        setFirmasState(prev => ({
            ...prev,
            [role]: { ...prev[role as keyof typeof prev], [field]: value }
        }));
    };

    const handleGuardar = async () => {
        setLoading(true);
        Swal.fire({ title: 'Guardando firmas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            await actualizarEntregaTurnoRFirmasApi(reporteData.id, { firmas: firmasState });
            Swal.fire('¡Éxito!', 'Firmas actualizadas.', 'success');
            onSuccess();
            onClose();
        } catch (error) {
            Swal.fire('Error', 'No se pudieron guardar las firmas.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const colors: any = {
            'Operativo': 'bg-emerald-500 text-white',
            'Mantenimiento': 'bg-amber-500 text-white',
            'Bien': 'bg-blue-500 text-white',
            'Mal': 'bg-rose-500 text-white',
            'Sucio': 'bg-slate-500 text-white',
            'Limpia': 'bg-emerald-500 text-white',
            'Limpio': 'bg-emerald-500 text-white',
            'Si': 'bg-emerald-500 text-white',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shadow-sm ${colors[status] || 'bg-slate-200 text-slate-600'}`}>
                {status || 'N/A'}
            </span>
        );
    };

    const herramientas = reporteData.barras_remolque || {};
    const gpuData = reporteData.gpus || {};
    const aeronavesData = reporteData.aeronaves || {};
    const carritoGolfData = reporteData.carrito_golf?.["005"] || {};

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                {/* 1. COMUNICACIONES & AERONAVES DE RESPALDO ANTERIOR */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-indigo-600 font-black text-[10px] uppercase tracking-tighter">
                            <Radio size={16} /> Comunicaciones y Radios
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">Radios VHF</p>
                                <p className="text-sm font-black">{reporteData.comunicaciones?.vhfOperativos}/{reporteData.comunicaciones?.radiosVHF}</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">Radios UHF</p>
                                <p className="text-sm font-black">{reporteData.comunicaciones?.uhfOperativos}/{reporteData.comunicaciones?.radiosUHF}</p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-indigo-600 font-black text-[10px] uppercase tracking-tighter">
                            <Plane size={16} /> Inventario de Aeronaves (Resumen)
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Hangar 1</p>
                                <p className="text-xs font-black text-slate-700">{aeronavesData.hangar1 || '0'}</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Hangar 2</p>
                                <p className="text-xs font-black text-slate-700">{aeronavesData.hangar2 || '0'}</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Plataforma H1</p>
                                <p className="text-xs font-black text-slate-700">{aeronavesData.plataforma_h1 || '0'}</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Plataforma H2</p>
                                <p className="text-xs font-black text-slate-700">{aeronavesData.plataforma_h2 || '0'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. VEHÍCULOS (DETALLE TÉCNICO - INTACTO) */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 font-black text-slate-700 text-xs uppercase tracking-widest italic">
                        <Truck size={18} /> Inspección Detallada de Unidades
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(reporteData.vehiculos || {}).map(([id, info]: any) => (
                            <div key={id} className={`bg-white rounded-3xl border-2 shadow-sm overflow-hidden ${info.estado === 'Mantenimiento' ? 'border-amber-100' : 'border-white'}`}>
                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-800 uppercase">{id.toUpperCase()}</span>
                                    <StatusBadge status={info.estado} />
                                </div>
                                <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                    <div className="text-[10px] flex justify-between items-center gap-1"><span className="text-slate-400 font-bold uppercase">Limpieza:</span> <StatusBadge status={info.limpieza} /></div>
                                    <div className="text-[10px] flex justify-between items-center gap-1"><span className="text-slate-400 font-bold uppercase">Llantas:</span> <StatusBadge status={info.llantas} /></div>
                                    <div className="text-[10px] flex justify-between items-center gap-1"><span className="text-slate-400 font-bold uppercase">Frenos:</span> <StatusBadge status={info.frenos} /></div>
                                    <div className="text-[10px] flex justify-between items-center gap-1"><span className="text-slate-400 font-bold uppercase">Luces:</span> <StatusBadge status={info.luces} /></div>
                                    <div className="text-[10px] col-span-2 pt-1 border-t border-slate-50 flex justify-between uppercase font-black">
                                        <span className="text-slate-400 uppercase">Km / Nivel:</span>
                                        <span className="text-indigo-600">{info.kilometraje || (info.nivel ? `${info.nivel}%` : '---')}</span>
                                    </div>
                                    {info.suministros?.map((s: any, idx: number) => (
                                        <div key={idx} className="col-span-2 bg-emerald-50 text-emerald-700 p-2 rounded-xl font-bold text-[9px] mt-1">
                                            SUMINISTRO: {s.matricula} | CANT: {s.cantidad}L
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. NUEVO DISEÑO CLARO: BARRAS Y GPUS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* BARRAS DE REMOLQUE Y ACCESORIOS */}
                    <div className="lg:col-span-5 bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-tighter border-b border-slate-100 pb-2">
                            <Wrench size={16} /> Herramientas de Apoyo
                        </div>
                        <div className="space-y-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-black text-slate-700 uppercase">Barras de Remolque</span>
                                    <span className="text-[10px] font-mono font-black text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">Total: {herramientas.total || 0}</span>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-[9px] font-medium text-slate-500">Limp: <StatusBadge status={herramientas.limpieza} /></span>
                                    <span className="text-[9px] font-medium text-slate-500">Físico: <StatusBadge status={herramientas.estado} /></span>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Cabezales</p>
                                    <p className="text-[9px] font-medium text-slate-400 mt-0.5">Estado: <StatusBadge status={herramientas.cabezalesEstado} /></p>
                                </div>
                                <span className="text-xs font-black text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">Cant: {herramientas.cabezales || 0}</span>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Escaleras</p>
                                    <p className="text-[9px] font-medium text-slate-400 mt-0.5">Estado: <StatusBadge status={herramientas.escalerasEstado} /></p>
                                </div>
                                <span className="text-xs font-black text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">Cant: {herramientas.escalerasCantidad || 0}</span>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-700 uppercase mb-1">Remolque de Equipaje</p>
                                <div className="flex gap-2">
                                    <span className="text-[9px] font-medium text-slate-500">Hig: <StatusBadge status={herramientas.hamburgueseraLimpieza} /></span>
                                    <span className="text-[9px] font-medium text-slate-500">Neumáticos: <StatusBadge status={herramientas.hamburgueseraLlantas} /></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* UNIDADES DE POTENCIA (GPUs - AJUSTADO COMPLETAMENTE CLARO) */}
                    <div className="lg:col-span-7 bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-tighter border-b border-slate-100 pb-2">
                            <Zap size={16} /> Unidades de Potencia (GPUs)
                        </div>
                        <div className="space-y-3">
                            {gpuData.gpu115 && (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded">GPU 115</span>
                                        <span className="text-[10px] font-mono font-black text-indigo-600">Horómetro: {gpuData.gpu115.horometro || 0} hrs</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[9px]">
                                        <span>Limpia: <StatusBadge status={gpuData.gpu115.limpia} /></span>
                                        <span>Enchufe: <StatusBadge status={gpuData.gpu115.enchufe} /></span>
                                        <span>Cableado: <StatusBadge status={gpuData.gpu115.cableado} /></span>
                                        <span>Llantas: <StatusBadge status={gpuData.gpu115.llantas} /></span>
                                    </div>
                                </div>
                            )}

                            {gpuData.hobart600 && (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded">HOBART 600</span>
                                        <span className="text-[10px] font-mono font-black text-slate-500">Nº Plantas: {gpuData.hobart600.numPlantas || 0}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[9px]">
                                        <span>Limpia: <StatusBadge status={gpuData.hobart600.limpia} /></span>
                                        <span>Enchufe: <StatusBadge status={gpuData.hobart600.enchufe} /></span>
                                        <span>Llantas: <StatusBadge status={gpuData.hobart600.llantas} /></span>
                                    </div>
                                </div>
                            )}

                            {gpuData.foxtronics && (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded">FOXTRONICS</span>
                                        <span className="text-[10px] font-mono font-black text-slate-500">Nº Plantas: {gpuData.foxtronics.numPlantas || 0}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[9px]">
                                        <span>Limpia: <StatusBadge status={gpuData.foxtronics.limpia} /></span>
                                        <span>Enchufe: <StatusBadge status={gpuData.foxtronics.enchufe} /></span>
                                        <span>Llantas: <StatusBadge status={gpuData.foxtronics.llantas} /></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. NUEVA SECCIÓN AGREGADA: CARRITO DE GOLF GOLF-005 */}
                {carritoGolfData && (
                    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-tighter">
                                <Layout size={16} /> Inspección de Carrito de Golf
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-900 text-white font-black text-[9px] rounded uppercase">GOLF-005</span>
                                <StatusBadge status={carritoGolfData.estado} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                <span className="text-[8px] text-slate-400 uppercase block font-bold">Batería</span>
                                <span className="text-xs font-black text-indigo-600">{carritoGolfData.carga || '0'}%</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                <span className="text-[8px] text-slate-400 uppercase block font-bold">Llantas</span>
                                <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.llantas || '---'}</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                <span className="text-[8px] text-slate-400 uppercase block font-bold">Luces</span>
                                <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.luces || '---'}</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                <span className="text-[8px] text-slate-400 uppercase block font-bold">Frenos</span>
                                <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.frenos || '---'}</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                <span className="text-[8px] text-slate-400 uppercase block font-bold">Limpieza</span>
                                <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.limpieza || '---'}</span>
                            </div>
                        </div>
                        {carritoGolfData.obs && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                                Obs: {carritoGolfData.obs}
                            </p>
                        )}
                    </div>
                )}

                {/* SECCIÓN DE FIRMAS */}
                <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-6 text-slate-800 font-black text-xs uppercase tracking-[0.2em] border-b border-slate-100 pb-2">
                        <ClipboardCheck size={18} /> Validación y Cierre de Turno
                    </div>
                    <RampaSignaturesSection data={firmasState} onUpdate={handleUpdate} />
                </div>
            </div>

            {/* ACCIONES */}
            <div className="p-6 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 text-slate-400">
                    <Info size={20} className="text-indigo-500 shrink-0" />
                    <p className="text-[10px] font-bold uppercase leading-tight italic max-w-sm">
                        Como Jefe de Área, su firma valida que el estado de los equipos reportados coincide con la realidad operativa de la plataforma.
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={onClose} className="flex-1 md:flex-none px-8 py-3 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-2xl transition-all uppercase tracking-widest">
                        Cerrar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={loading}
                        className="flex-1 md:flex-none px-10 py-3 bg-slate-900 text-white text-xs font-black rounded-2xl shadow-xl hover:bg-slate-800 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                    >
                        <Save size={18} /> Guardar Firmas
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VistaFirmas;
