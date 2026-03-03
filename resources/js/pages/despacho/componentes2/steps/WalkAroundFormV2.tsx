import Swal from 'sweetalert2';
import MapaDanios3D from '../../components/walkAround/MapaDanios3D';
import React, { useState, useEffect } from 'react';
import { User, Car, ShieldAlert, XCircle, ArrowRight, ArrowLeft, AlertCircle, Loader2, Box, Maximize2 } from 'lucide-react';
import GeneralInfo from './GeneralInfo';
import VehicleInspection, { SECTIONS_PLANE, ITEMS_HELICOPTER } from './DamageChecklist';
import { validateStepOne, validateStepTwo, validateStepThree } from '../formValidators';
import ExteriorObservaciones from './ExteriorObservaciones';
import { guardarWalkAroundApi, fetchWalkaroundDetalle, updateWalkaroundApi, obtenerInfoMatriculaApi } from '@/stores/apiWalkaround';

const STEPS = [
    { id: 1, title: 'Información', icon: User },
    { id: 2, title: 'Vehículo', icon: Car },
    { id: 3, title: 'Exterior & Firmas', icon: ShieldAlert },
];

interface Props {
    id?: number | null;
    onCancel?: () => void;
}

const INITIAL_INFO = {
    matricula: '',
    movimiento: '',
    aeronave: '',
    tipo: '',
    hora: '',
    destino: '',
    procedencia: '',
    fecha: new Date().toISOString().split('T')[0]
};

const INITIAL_EXTERIOR = {
    observaciones: '',
    nombreResponsable: '',
    firmaResponsable: null,
    nombreJefe: '',
    firmaJefe: null,
    nombreFbo: '',
    firmaFbo: null
};

const WalkAroundFormV2 = ({ id, onCancel }: Props) => {
    const [currentStep, setCurrentStep] = useState(1);
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
                        console.log(detalle.movimiento);

                        setInfoData({
                            matricula: detalle.matricula || '',
                            movimiento: detalle.movimiento
                                ? detalle.movimiento.charAt(0).toUpperCase() + detalle.movimiento.slice(1).toLowerCase()
                                : '',
                            aeronave: detalle.tipo === 'avion' ? 'Avión' : 'Helicóptero',
                            tipo: detalle.tipoAeronave || '',
                            hora: detalle.hora || '',
                            destino: detalle.destino || '',
                            procedencia: detalle.procedensia || '',
                            fecha: detalle.fecha ? detalle.fecha.split('T')[0] : INITIAL_INFO.fecha
                        });
                        const checklistData = detalle.tipo === 'avion'
                            ? detalle.checklists?.checklist_avion
                            : detalle.checklists?.checklist_helicoptero;

                        setInspeccion({
                            ...(checklistData || {}),
                            fotos: detalle.imagenes?.map((img: any) => img.url) || [],
                            puntos3D: detalle.marcas_danio || [],
                            numeroEstaticas: detalle.numero_estaticas || 0
                        });
                        const firmaResp = detalle.firmas?.find((f: any) => f.rol === 'responsable')?.url;
                        const firmaJefe = detalle.firmas?.find((f: any) => f.rol === 'jefe_area')?.url;
                        const firmaFbo = detalle.firmas?.find((f: any) => f.rol === 'fbo')?.url;

                        setExteriorData({
                            observaciones: detalle.observaciones || '',
                            nombreResponsable: detalle.responsable || '',
                            firmaResponsable: firmaResp || null,
                            nombreJefe: detalle.jefe_area || '',
                            firmaJefe: firmaJefe || null,
                            nombreFbo: detalle.fbo || '',
                            firmaFbo: firmaFbo || null
                        });
                    }
                } catch (error: any) {
                    console.error("Error cargando detalle:", error);
                    Swal.fire('Error', 'No se pudo cargar la información del registro', 'error');
                    if (onCancel) onCancel();
                } finally {
                    setIsLoadingData(false);
                }
            };
            loadDetalle();
        }
    }, [id]);

    const resetForm = () => {
        setInfoData(INITIAL_INFO);
        setInspeccion({});
        setExteriorData(INITIAL_EXTERIOR);
        setCurrentStep(1);
        if (onCancel) onCancel();
    };

    const handleCancel = async () => {
        const result = await Swal.fire({
            title: '¿Cancelar operación?',
            text: id ? "Los cambios no guardados se perderán." : "Se perderán todos los datos ingresados.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Continuar'
        });

        if (result.isConfirmed) {
            resetForm();
        }
    };

    const handleFinalizar = async () => {
        const { fotos, puntos3D, numeroEstaticas, ...checklist } = inspeccion;

        const payloadCompleto = {
            id: id || null,
            metadata: infoData,
            inspeccionTecnica: {
                checklist: checklist,
                numeroEstaticas: numeroEstaticas,
                fotos: fotos?.map((f: any) => f.base64 || f) || [],
                puntos3D: puntos3D || []
            },
            cierreYFirmas: exteriorData,
            fechaFinalizacion: new Date().toISOString()
        };

        setIsSubmitting(true);

        try {
            if (id) {
                await updateWalkaroundApi(id, payloadCompleto);
            } else {
                await guardarWalkAroundApi(payloadCompleto);
            }
            await Swal.fire({
                title: id ? '¡Actualizado!' : '¡Guardado!',
                text: id ? 'El registro ha sido actualizado correctamente.' : 'La inspección ha sido registrada.',
                icon: 'success',
                confirmButtonColor: '#059669'
            });
            resetForm();
        } catch (error: any) {
            Swal.fire({
                title: 'Error',
                text: error.message || 'No se pudo procesar la solicitud.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = async () => {
        if (currentStep === 1) {
            if (!validateStepOne(infoData)) return;

            setIsSubmitting(true);
            try {
                const dataMatricula = await obtenerInfoMatriculaApi(infoData.matricula);
                if (!dataMatricula || !dataMatricula.tipo) {
                    const result = await Swal.fire({
                        title: 'Matrícula no encontrada',
                        text: `La matrícula "${infoData.matricula}" no se encuentra en la base de datos. Al finalizar se guardará como un registro nuevo. ¿Desea continuar?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#4f46e5',
                        cancelButtonColor: '#94a3b8',
                        confirmButtonText: 'Sí, continuar',
                        cancelButtonText: 'Corregir matrícula'
                    });

                    if (!result.isConfirmed) {
                        setIsSubmitting(false);
                        return;
                    }
                }
            } catch (error) {
                console.error("Error al validar matrícula:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
        if (currentStep === 2) {
            const allItems = infoData.aeronave === 'Avión'
                ? SECTIONS_PLANE.flatMap(s => s.items)
                : ITEMS_HELICOPTER;
            if (!validateStepTwo(inspeccion, allItems)) return;
        }
        if (currentStep === 3) {
            if (!validateStepThree(exteriorData)) return;
            handleFinalizar();
            return;
        }
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };

    useEffect(() => {
        if (infoData.aeronave && !isLoadingData) {
            setInspeccion((prev: any) => ({
                ...prev,
                puntos3D: []
            }));
            setInspeccion({});
        }
    }, [infoData.aeronave]);
    if (isLoadingData) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <p className="text-slate-500 font-medium">Cargando detalles...</p>
            </div>
        );
    }
    return (
        <div className="h-screen w-full bg-[#F8FAFC] flex overflow-hidden">
            <main className="flex-1 flex flex-col">
                <header className="px-10 py-6 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                            {id ? 'Editar' : 'Nueva'} {STEPS[currentStep - 1].title}
                        </h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                            {infoData.matricula || 'PENDIENTE'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl text-indigo-700 font-bold text-xs">
                        <AlertCircle size={16} /> Paso {currentStep} / {STEPS.length}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-10">
                    <div className="max-w-9xl mx-auto">
                        {currentStep === 1 && (
                            <GeneralInfo
                                data={infoData}
                                onChange={(d: any) => setInfoData((p: any) => ({ ...p, ...d }))}
                            />
                        )}

                        {currentStep === 2 && (
                            <>
                                <VehicleInspection
                                    aeronaveType={infoData.aeronave === 'Avión' ? 'avion' : 'helicoptero'}
                                    inspeccion={inspeccion}
                                    setInspeccion={setInspeccion}
                                    isMapOpen={isMapOpen}
                                    setIsMapOpen={setIsMapOpen}
                                />
                                <button
                                    onClick={() => setIsMapOpen(true)}
                                    className="fixed bottom-24 right-8 z-50 flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 group"
                                >
                                    <div className="relative">
                                        <Box size={24} />
                                        <span className="absolute -top-2 -right-2 bg-rose-500 text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                            {inspeccion.puntos3D?.length || 0}
                                        </span>
                                    </div>
                                    <span className="font-bold text-sm pr-2 hidden md:block">Mapa 3D</span>
                                </button>
                                {isMapOpen && (
                                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
                                        <div
                                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                                            onClick={() => setIsMapOpen(false)}
                                        />
                                        <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                                        <Maximize2 size={20} className="text-indigo-600" />
                                                        Mapeo Estructural 3D
                                                    </h3>
                                                    <p className="text-xs text-slate-500 font-medium">Click para marcar, arrastrar para rotar</p>
                                                </div>
                                                <button
                                                    onClick={() => setIsMapOpen(false)}
                                                    className="p-3 hover:bg-slate-200 rounded-full transition-colors font-bold text-slate-500"
                                                >
                                                    CERRAR
                                                </button>
                                            </div>

                                            <div className="flex-1 bg-slate-100 relative">
                                                <MapaDanios3D
                                                    key={infoData.aeronave}
                                                    value={inspeccion.puntos3D || []}
                                                    onChange={(puntos) => setInspeccion((prev: any) => ({ ...prev, puntos3D: puntos }))}
                                                    modelSrc={infoData.aeronave === 'Avión' ? '/models/Avion.obj' : '/models/18706 Fighter Helicopter_v1.obj'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {currentStep === 3 && (
                            <ExteriorObservaciones
                                data={exteriorData}
                                onChange={(d: any) => setExteriorData(p => ({ ...p, ...d }))}
                            />
                        )}
                    </div>
                </div>

                <footer className="px-10 py-6 bg-white border-t border-slate-100 flex justify-between items-center">
                    <button
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 font-bold text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <XCircle size={20} /> {id ? 'SALIR' : 'CANCELAR'}
                    </button>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setCurrentStep(p => Math.max(p - 1, 1))}
                            disabled={isSubmitting || currentStep === 1}
                            className={`flex items-center gap-2 font-bold text-slate-400 hover:text-slate-600 transition-colors ${currentStep === 1 && 'hidden'}`}
                        >
                            <ArrowLeft size={20} /> ANTERIOR
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={isSubmitting}
                            className={`${currentStep === STEPS.length ? 'bg-emerald-600' : 'bg-indigo-600'
                                } text-white px-10 py-4 rounded-2xl font-black shadow-lg flex items-center gap-2 transition-all active:scale-95 hover:opacity-90 disabled:opacity-50`}
                        >
                            {isSubmitting ? 'PROCESANDO...' : currentStep === STEPS.length ? (id ? 'ACTUALIZAR' : 'FINALIZAR') : 'SIGUIENTE'}
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default WalkAroundFormV2;
