import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { ChevronRight, ChevronLeft, Send, CheckCircle2, User, Car, Plane, ShieldAlert, Loader2, Box, Maximize2 } from 'lucide-react';
import GeneralInfo from './GeneralInfo';
import VehicleInspection, { SECTIONS_PLANE, ITEMS_HELICOPTER } from './DamageChecklist';
import ExteriorObservaciones from './ExteriorObservaciones';
import MapaDanios3D from '../../components/walkAround/MapaDanios3D';
import { validateStepOne, validateStepTwo, validateStepThree } from '../formValidators';
import { guardarWalkAroundApi, fetchWalkaroundDetalle, updateWalkaroundApi, obtenerInfoMatriculaApi } from '@/stores/apiWalkaround';

const STEPS = [
    { id: 1, label: 'Información', icon: User },
    { id: 2, label: 'Inspección', icon: Plane },
    { id: 3, label: 'Cierre', icon: ShieldAlert },
];

const INITIAL_INFO = {
    matricula: '', movimiento: '', aeronave: '', tipo: '', hora: '', destino: '', procedencia: '',
    fecha: new Date().toLocaleDateString('en-CA')
};

const INITIAL_EXTERIOR = {
    observaciones: '', nombreResponsable: '', firmaResponsable: null,
    nombreJefe: '', firmaJefe: null, nombreFbo: '', firmaFbo: null
};

interface Props {
    id?: number | null;
    onCancel?: () => void;
}

const WalkAroundFormV2 = ({ id, onCancel }: Props) => {
    const [step, setStep] = useState(1);
    const [infoData, setInfoData] = useState<any>(INITIAL_INFO);
    const [inspeccion, setInspeccion] = useState<any>({});
    const [exteriorData, setExteriorData] = useState(INITIAL_EXTERIOR);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);

    useEffect(() => {
        if (id) {
            const loadDetalle = async () => {
                setIsLoadingData(true);
                try {
                    const detalle: any = await fetchWalkaroundDetalle(id);
                    if (detalle) {
                        setInfoData({
                            matricula: detalle.matricula || '',
                            movimiento: detalle.movimiento ? detalle.movimiento.charAt(0).toUpperCase() + detalle.movimiento.slice(1).toLowerCase() : '',
                            aeronave: detalle.tipo === 'avion' ? 'Avión' : 'Helicóptero',
                            tipo: detalle.tipoAeronave || '',
                            hora: detalle.hora || '',
                            destino: detalle.destino || '',
                            procedencia: detalle.procedensia || '',
                            fecha: detalle.fecha
                                    ? new Date(detalle.fecha).toLocaleDateString('en-CA') // Retorna YYYY-MM-DD en hora local
                                    : INITIAL_INFO.fecha
                        });
                        const checklistData = detalle.tipo === 'avion' ? detalle.checklists?.checklist_avion : detalle.checklists?.checklist_helicoptero;
                        setInspeccion({
                            ...(checklistData || {}),
                            fotos: detalle.imagenes?.map((img: any) => img.url) || [],
                            puntos3D: detalle.marcas_danio || [],
                            numeroEstaticas: detalle.numero_estaticas || 0
                        });
                        setExteriorData({
                            observaciones: detalle.observaciones || '',
                            nombreResponsable: detalle.responsable || '',
                            firmaResponsable: detalle.firmas?.find((f: any) => f.rol === 'responsable')?.url || null,
                            nombreJefe: detalle.jefe_area || '',
                            firmaJefe: detalle.firmas?.find((f: any) => f.rol === 'jefe_area')?.url || null,
                            nombreFbo: detalle.fbo || '',
                            firmaFbo: detalle.firmas?.find((f: any) => f.rol === 'fbo')?.url || null
                        });
                    }
                } catch (error) {
                    Swal.fire('Error', 'No se pudo cargar la información', 'error');
                } finally {
                    setIsLoadingData(false);
                }
            };
            loadDetalle();
        }
    }, [id]);

    const handleNext = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        e?.stopPropagation();

        if (step === 1) {
            if (!validateStepOne(infoData)) return;
            setIsSubmitting(true);
            try {
                const dataMatricula = await obtenerInfoMatriculaApi(infoData.matricula);
                if (!dataMatricula || !dataMatricula.tipo) {
                    const res = await Swal.fire({
                        title: 'No encontrado',
                        text: `La matrícula "${infoData.matricula}" no existe. ¿Continuar?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, continuar'
                    });
                    if (!res.isConfirmed) return;
                }
            } finally { setIsSubmitting(false); }
        }
        if (step === 2) {
            const items = infoData.aeronave === 'Avión' ? SECTIONS_PLANE.flatMap(s => s.items) : ITEMS_HELICOPTER;
            if (!validateStepTwo(inspeccion, items)) return;
        }
        if (step < STEPS.length) {
            setStep(prev => prev + 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStepThree(exteriorData)) return;

        const result = await Swal.fire({
            title: id ? '¿Actualizar registro?' : '¿Confirmar envío?',
            text: "Se guardarán los daños y firmas registrados.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0f172a',
            confirmButtonText: 'Sí, guardar'
        });

        if (result.isConfirmed) {
            setIsSubmitting(true);
            try {
                const { fotos, puntos3D, numeroEstaticas, ...checklist } = inspeccion;
                const payload = {
                    id: id || null,
                    metadata: infoData,
                    inspeccionTecnica: { checklist, numeroEstaticas, fotos: fotos?.map((f: any) => f.base64 || f) || [], puntos3D: puntos3D || [] },
                    cierreYFirmas: exteriorData,
                    fechaFinalizacion: new Date().toISOString()
                };
                id ? await updateWalkaroundApi(id, payload) : await guardarWalkAroundApi(payload);
                await Swal.fire('Éxito', 'Registro procesado correctamente', 'success');
                window.location.reload();
            } catch (error: any) {
                Swal.fire('Error', error.message || 'Error al guardar', 'error');
            } finally { setIsSubmitting(false); }
        }
    };

    if (isLoadingData) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Cargando Inspección...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 px-4">
                    <div className="flex justify-between mb-2">
                        {STEPS.map((s, i) => (
                            <div key={s.id} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'bg-white border text-slate-400'}`}>
                                    {step > i + 1 ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
                                </div>
                                <span className={`text-[10px] mt-2 uppercase font-black tracking-tighter ${step === i + 1 ? 'text-blue-600' : 'text-slate-400'}`}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className="min-h-[500px]">
                        {step === 1 && (
                            <div className="animate-in fade-in duration-500">
                                <header className="bg-blue-900 text-white p-8 flex justify-between items-center shadow-lg">
                                    <div>
                                        <h1 className="text-2xl font-black tracking-widest">WALK AROUND</h1>
                                        <p className="text-sm opacity-80 uppercase font-medium">Información General de la Aeronave</p>
                                    </div>
                                    <User size={40} className="opacity-40" />
                                </header>
                                <div className="p-8">
                                    <GeneralInfo data={infoData} onChange={(d: any) => setInfoData((p: any) => ({ ...p, ...d }))} />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="animate-in slide-in-from-right duration-500">
                                <header className="bg-blue-900 text-white p-8 flex justify-between items-center shadow-lg">
                                    <div>
                                        <h1 className="text-2xl font-black tracking-widest">INSPECCIÓN TÉCNICA</h1>
                                        <p className="text-sm opacity-80 uppercase font-medium">Registro de Daños y Checklist Exterior</p>
                                    </div>
                                    <Plane size={40} className="opacity-40" />
                                </header>
                                <div className="p-8 relative">
                                    <VehicleInspection
                                        aeronaveType={infoData.aeronave === 'Avión' ? 'avion' : 'helicoptero'}
                                        inspeccion={inspeccion}
                                        setInspeccion={setInspeccion}
                                        isMapOpen={isMapOpen}
                                        setIsMapOpen={setIsMapOpen}
                                    />
                                    <button type="button" onClick={() => setIsMapOpen(true)} className="fixed bottom-24 right-8 z-50 flex items-center gap-3 bg-blue-600 text-white p-5 rounded-full shadow-2xl hover:scale-105 transition-all">
                                        <div className="relative"><Box size={24} /><span className="absolute -top-2 -right-2 bg-rose-500 text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{inspeccion.puntos3D?.length || 0}</span></div>
                                        <span className="font-black text-xs uppercase tracking-widest pr-2 hidden md:block">Mapa 3D</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="animate-in slide-in-from-right duration-500">
                                <header className="bg-blue-900 text-white p-8 flex justify-between items-center shadow-lg">
                                    <div>
                                        <h1 className="text-2xl font-black tracking-widest">CIERRE Y FIRMAS</h1>
                                        <p className="text-sm opacity-80 uppercase font-medium">Observaciones Finales y Validación</p>
                                    </div>
                                    <ShieldAlert size={40} className="opacity-40" />
                                </header>
                                <div className="p-8">
                                    <ExteriorObservaciones data={exteriorData} onChange={(d: any) => setExteriorData(p => ({ ...p, ...d }))} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 p-8 flex justify-between border-t border-slate-100">
                        <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 1} className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-all ${step === 1 ? 'invisible' : 'text-slate-400 hover:text-slate-800'}`}>
                            <ChevronLeft className="inline mr-1" size={18} /> Anterior
                        </button>
                        {step < STEPS.length ? (
                            <button type="button" onClick={handleNext} disabled={isSubmitting} className="px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                                Siguiente <ChevronRight className="inline ml-1" size={18} />
                            </button>
                        ) : (
                            <button type="submit" disabled={isSubmitting} className="px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-900 text-white shadow-lg hover:bg-black hover:-translate-y-0.5 transition-all disabled:opacity-50">
                                {isSubmitting ? 'Enviando...' : (id ? 'Actualizar Reporte' : 'Finalizar Registro')} <Send className="inline ml-2" size={16} />
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {isMapOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMapOpen(false)} />
                    <div className="relative bg-white w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic"><Maximize2 size={18} className="text-blue-600" /> Mapeo de Daños 3D</h3>
                            <button type='button' onClick={() => setIsMapOpen(false)} className="px-4 py-2 text-[10px] font-black bg-slate-200 text-slate-600 rounded-lg hover:bg-red-500 hover:text-white transition-all">CERRAR</button>
                        </div>
                        <div className="flex-1 bg-slate-100">
                            <MapaDanios3D
                                value={inspeccion.puntos3D || []}
                                onChange={(puntos) => setInspeccion((prev: any) => ({ ...prev, puntos3D: puntos }))}
                                modelSrc={infoData.aeronave === 'Avión' ? '/models/Avion.obj' : '/models/18706 Fighter Helicopter_v1.obj'}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalkAroundFormV2;
