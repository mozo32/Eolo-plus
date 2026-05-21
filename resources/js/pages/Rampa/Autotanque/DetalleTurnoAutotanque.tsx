import React, { useState, Suspense } from 'react';
import {
    Calendar, User, Fuel, FileText, ArrowRightCircle, Calculator,
    ClipboardList, ShieldCheck, Gauge, Eye, PenTool, Image as ImageIcon,
    XCircle, Circle
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, Html } from '@react-three/drei';

interface Props {
    data: any;
}

export interface Marca3D {
    x: number;
    y: number;
    z: number;
    tipo: 'X' | 'O';
}

// Subcomponente Visor3D adaptado para Lectura de Daños Históricos
const Visor3DReadonly = ({ marcas }: { marcas: Marca3D[] }) => {
    const { scene } = useGLTF('/models/result.glb');

    return (
        <group>
            <primitive
                object={scene}
                scale={2.5}
            />
            {marcas.map((m, i) => (
                <Html key={i} position={[m.x, m.y, m.z]} center>
                    <div className="pointer-events-none transform -translate-y-1/2 select-none">
                        {m.tipo === 'X' ? (
                            <XCircle className="text-red-500 fill-white drop-shadow-md" size={20} />
                        ) : (
                            <Circle className="text-amber-500 fill-white drop-shadow-md" size={20} />
                        )}
                    </div>
                </Html>
            ))}
        </group>
    );
};

export const DetalleTurnoAutotanque = ({ data }: Props) => {
    const [activeTab, setActiveTab] = useState<'balance' | 'checklist' | 'final'>('balance');

    // Detección segura del origen de datos
    const source = data?.turno ? data : (data?.data?.turno ? data.data : data);

    const turno = source?.turno || null;
    const remision = source?.remision || [];
    const sumaAutotanque = source?.sumaAutotanque || [];
    const inspeccion = turno?.inspeccion || source?.inspeccion;

    // Función auxiliar para formatear números de forma segura
    const formatNumber = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? '0' : num.toLocaleString('en-US');
    };

    // Función para transformar "YYYY-MM-DD HH:MM:SS" a "DD/MM/YYYY HH:MM"
    const formatChronology = (dateStr: string) => {
        if (!dateStr) return '---';
        try {
            const [datePart, timePart] = dateStr.trim().split(' ');
            if (!datePart) return dateStr;

            const [year, month, day] = datePart.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            let formattedTime = '';
            if (timePart) {
                const timeSegments = timePart.split(':');
                formattedTime = ` ${timeSegments[0]}:${timeSegments[1]}`;
            }

            return `${formattedDate}${formattedTime}`;
        } catch (error) {
            return dateStr;
        }
    };

    const SectionHeader = ({ title, icon: Icon }: any) => (
        <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2 mb-4">
            <div className="bg-indigo-50 p-1.5 rounded-lg">
                <Icon size={18} className="text-indigo-600" />
            </div>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{title}</h4>
        </div>
    );

    const DataBox = ({ label, value, subValue }: any) => (
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
            <p className="text-xs font-black text-slate-700 uppercase">{value || '---'}</p>
            {subValue && <p className="text-[10px] font-bold text-indigo-500 mt-1">{subValue}</p>}
        </div>
    );

    if (!turno) {
        return (
            <div className="text-center py-8 text-xs font-black text-slate-400 uppercase tracking-wider">
                No se pudo cargar la información del turno correctamente.
            </div>
        );
    }

    // Clasificación explícita de grupos de respuestas para el paso de Checklist
    const gruposChecklist = {
        vehiculoGeneral: [
            "Faros delanteros y Luces Traseras", "Luces intermitentes",
            "Llantas y Rines", "Llanta de refacción", "Espejos laterales", "Limpiadores"
        ],
        tanqueSuministro: [
            "Bomba y Manguera", "Boquilla 'Single point'", "Unidad de filtrado",
            "Líneas de conducción", "Gabinete de Manómetros", "Tapa boca hombre"
        ],
        seguridad: [
            "Banderines", "Carrete y Cable de tierra", "Interruptor maestro",
            "Extintores", "Rombo de seguridad", "Alarma de reversa"
        ],
        calidadCombustible: [
            "Toma de Muestra de Combustible", "Prueba de claridad y Brillantez",
            "Presencia de Sólidos y/o agua de forma visual"
        ]
    };

    const respuestas = inspeccion?.checklist_respuestas || {};
    const marcasHistoricas: Marca3D[] = inspeccion?.danos_grafico || [];

    return (
        <div className="space-y-6 p-1">
            {/* --- NAVEGACIÓN POR PASOS / STEPS --- */}
            <div className="flex border border-slate-200 bg-slate-50/70 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('balance')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'balance' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Calculator size={14} />
                    Balances y Ventas
                </button>
                <button
                    onClick={() => setActiveTab('checklist')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'checklist' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <ShieldCheck size={14} />
                    Checklist e Inspección
                </button>
                <button
                    onClick={() => setActiveTab('final')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'final' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Eye size={14} />
                    Gráficos 3D y Firmas
                </button>
            </div>

            {/* --- PASO 1: BALANCE, MOVIMIENTOS Y CIERRES (SIN TOCAR) --- */}
            {activeTab === 'balance' && (
                <div className="space-y-8">
                    <section>
                        <SectionHeader title="Entrega de Turno (Inicio)" icon={ArrowRightCircle} />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <DataBox label="Nombre Entrega" value={turno.nombre} />
                            <DataBox label="Cronología Turno" value={formatChronology(turno.fecha)} />
                            <DataBox
                                label="Toma Física Inicio"
                                value={`${formatNumber(turno.litrosIni)} LTS`}
                                subValue={turno.cmIni ? `${turno.cmIni} CM` : undefined}
                            />
                            <DataBox label="Totalizador Inicio" value={`${formatNumber(turno.totalizadorIni)} LTS`} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText size={14} className="text-slate-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Remisiones (Ventas)</span>
                                </div>
                                <div className="space-y-2">
                                    {remision.length > 0 ? remision.map((r: any) => (
                                        <div key={r.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-500">{formatChronology(r.fecha).split(' ')[0]}</span>
                                            <span className="font-black text-indigo-600">{r.folio}</span>
                                            <span className="font-black">{formatNumber(r.total_litros)} LTS</span>
                                        </div>
                                    )) : <p className="text-[10px] text-slate-400 italic text-center py-2">Sin remisiones</p>}
                                </div>
                            </div>

                            <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <ClipboardList size={14} className="text-slate-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase">ASA (Cargas Autotanque)</span>
                                </div>
                                <div className="space-y-2">
                                    {sumaAutotanque.length > 0 ? sumaAutotanque.map((s: any) => (
                                        <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-500">
                                                {s.created_at ? formatChronology(s.created_at.replace('T', ' ').substring(0, 19)).split(' ')[0] : '---'}
                                            </span>
                                            <span className="font-black text-emerald-600">{s.folio}</span>
                                            <span className="font-black">{formatNumber(s.litros)} LTS</span>
                                        </div>
                                    )) : <p className="text-[10px] text-slate-400 italic text-center py-2">Sin registros ASA</p>}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionHeader title="Datos al Cierre de Turno" icon={User} />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <DataBox label="Nombre Recibe" value={turno.nombreCierre} />
                            <DataBox label="Cronología Cierre" value={formatChronology(turno.fechaCierre)} />
                            <DataBox label="Totalizador Final" value={`${formatNumber(turno.totalizadorCierre)} LTS`} />
                            <DataBox
                                label="Toma Física Final"
                                value={`${formatNumber(turno.litrosCierre)} LTS`}
                                subValue={turno.cmCierre ? `${turno.cmCierre} CM` : undefined}
                            />
                        </div>
                    </section>

                    <section className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100">
                        <div className="flex items-center gap-2 mb-4 border-b border-indigo-400/30 pb-3">
                            <Calculator size={18} className="text-white" />
                            <h4 className="font-black text-white uppercase text-xs tracking-widest">Balance de Inventario</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center md:text-left">
                                <p className="text-[10px] font-black text-indigo-200 uppercase">Inventario Aritmético</p>
                                <p className="text-xl font-black text-white">{formatNumber(turno.balanceAritmetico)} <small className="text-xs">LTS</small></p>
                            </div>
                            <div className="text-center md:text-left">
                                <p className="text-[10px] font-black text-indigo-200 uppercase">Toma Física (Balance)</p>
                                <p className="text-xl font-black text-white">{formatNumber(turno.balanceFisico)} <small className="text-xs">LTS</small></p>
                            </div>
                            <div className="text-center md:bg-white/10 p-3 rounded-xl border border-white/20">
                                <p className="text-[10px] font-black text-white/70 uppercase">Diferencia</p>
                                <p className={`text-xl font-black ${Number(turno.diferenciaFinal) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                                    {formatNumber(turno.diferenciaFinal)} <small className="text-xs">LTS</small>
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* --- PASO 2: CHECKLIST E INDICADORES POR GRUPOS --- */}
            {activeTab === 'checklist' && (
                <div className="space-y-6">
                    <section>
                        <SectionHeader title="Lectura de Odómetro y Combustible" icon={Gauge} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DataBox label="Kilometraje" value={inspeccion ? `${formatNumber(inspeccion.kilometraje)} KM` : '---'} />
                            <DataBox label="Combustible %" value={inspeccion ? `${inspeccion.porcentaje_combustible}%` : '---'} />
                        </div>
                    </section>

                    {inspeccion ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">Vehículo General</h5>
                                <div className="space-y-1.5">
                                    {gruposChecklist.vehiculoGeneral.map(item => (
                                        <div key={item} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span className={`font-black uppercase px-2 py-0.5 rounded ${respuestas[item] === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{respuestas[item] || '---'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">Tanque y Suministro</h5>
                                <div className="space-y-1.5">
                                    {gruposChecklist.tanqueSuministro.map(item => (
                                        <div key={item} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span className={`font-black uppercase px-2 py-0.5 rounded ${respuestas[item] === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{respuestas[item] || '---'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">Seguridad</h5>
                                <div className="space-y-1.5">
                                    {gruposChecklist.seguridad.map(item => (
                                        <div key={item} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span className={`font-black uppercase px-2 py-0.5 rounded ${respuestas[item] === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{respuestas[item] || '---'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">Pruebas de Calidad de Combustible</h5>
                                <div className="space-y-1.5">
                                    {gruposChecklist.calidadCombustible.map(item => (
                                        <div key={item} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span className={`font-black uppercase px-2 py-0.5 rounded ${respuestas[item] === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{respuestas[item] || '---'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-xs text-slate-400 italic py-4">No hay datos de inspección registrados.</p>
                    )}

                    {/* Evidencias fotográficas incorporadas en la inspección */}
                    {inspeccion?.imagenes?.length > 0 && (
                        <section className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <ImageIcon size={14} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Evidencias Fotográficas</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {inspeccion.imagenes.map((img: any) => (
                                    <div key={img.id} className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                        <img src={img.url} alt={img.observacion} className="w-full h-24 object-cover rounded-md" />
                                        <p className="text-[9px] font-black text-slate-500 mt-2 uppercase truncate">{img.pivot?.observacion || 'Evidencia'}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* --- PASO 3: VISOR R3F CANVAS (REUSE) Y FIRMAS --- */}
            {activeTab === 'final' && (
                <div className="space-y-6">
                    <section>
                        <SectionHeader title="Inspección Histórica de Daños (Visor 3D)" icon={Eye} />
                        <div className="h-[400px] md:h-[500px] w-full bg-slate-950 rounded-2xl relative border border-slate-800 overflow-hidden shadow-xl">
                            <div className="absolute top-3 left-3 z-10 text-[9px] font-bold text-slate-400 bg-slate-900/80 backdrop-blur px-2 py-1 rounded pointer-events-none border border-slate-800 uppercase tracking-wider">
                                Vista de lectura · Arrastre para rotar el tanque
                            </div>

                            {/* Reutilización del Motor Gráfico Canvas de Three.js */}
                            <Canvas camera={{ position: [5, 2, 5], fov: 45 }}>
                                <ambientLight intensity={0.6} />
                                <directionalLight position={[10, 10, 10]} intensity={1.2} />
                                <Environment preset="city" />

                                <OrbitControls
                                    makeDefault
                                    minPolarAngle={0}
                                    maxPolarAngle={Math.PI / 2.1}
                                    enablePan={false}
                                />

                                <Suspense fallback={<Html center><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando Estructura Autotanque...</span></Html>}>
                                    <Visor3DReadonly marcas={marcasHistoricas} />
                                </Suspense>
                            </Canvas>

                            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-800 text-[9px] font-bold text-slate-400 flex gap-4">
                                <span className="flex items-center gap-1"><XCircle size={12} className="text-red-500 fill-white" /> Faltante (X)</span>
                                <span className="flex items-center gap-1"><Circle size={12} className="text-amber-500 fill-white" /> Daño Estructural (O)</span>
                            </div>
                        </div>
                    </section>

                    {/* Mapeo de Firmas Electrónicas */}
                    <section>
                        <SectionHeader title="Firmas de Conformidad" icon={PenTool} />
                        {inspeccion?.firmas?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {inspeccion.firmas.map((firma: any) => (
                                    <div key={firma.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center">
                                        <div className="bg-white rounded-xl border border-slate-100 p-3 w-full h-24 flex items-center justify-center shadow-sm">
                                            <img src={firma.url} alt={firma.pivot?.tag} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                        </div>
                                        <div className="mt-3">
                                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{firma.pivot?.tag || 'Firma Autorizada'}</p>
                                            <p className="text-[8px] font-black text-indigo-500 uppercase mt-0.5 tracking-wider">{firma.pivot?.rol}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-xs text-slate-400 italic py-4">No se recolectaron firmas electrónicas para este turno.</p>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};
