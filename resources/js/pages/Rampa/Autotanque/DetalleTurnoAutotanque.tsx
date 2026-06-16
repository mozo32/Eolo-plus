import React, { useState, Suspense, useRef, useEffect, useMemo } from 'react';
import {
    Calendar,
    User,
    Fuel,
    FileText,
    ArrowRightCircle,
    Calculator,
    ClipboardList,
    ShieldCheck,
    Gauge,
    Eye,
    PenTool,
    Image as ImageIcon,
    XCircle,
    Circle
} from 'lucide-react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';

interface Props {
    data: any;
}

export interface Marca3D {
    x: number;
    y: number;
    z: number;
    tipo: 'X' | 'O';
}

const MODELO_DIR = '/models/Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture_obj/';
const MODELO_OBJ = `${MODELO_DIR}Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture.obj`;
const MODELO_MTL = `${MODELO_DIR}Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture.mtl`;

useLoader.preload(MTLLoader, MODELO_MTL);
useLoader.preload(OBJLoader, MODELO_OBJ);

function AutoFitCameraReadonly({
    objectRef
}: {
    objectRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
    const { camera, invalidate } = useThree();
    const fitted = useRef(false);

    useEffect(() => {
        if (!objectRef.current || fitted.current) return;

        const cam = camera as THREE.PerspectiveCamera;

        if (!cam.isPerspectiveCamera) return;

        const box = new THREE.Box3().setFromObject(objectRef.current);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);

        if (!Number.isFinite(maxDim) || maxDim <= 0) return;

        const fov = (cam.fov * Math.PI) / 180;
        const distance = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cam.position.set(center.x, center.y + maxDim * 0.18, center.z + distance * 1.45);
        cam.near = Math.max(distance / 100, 0.01);
        cam.far = distance * 100;
        cam.updateProjectionMatrix();
        cam.lookAt(center);

        fitted.current = true;
        invalidate();
    }, [camera, objectRef, invalidate]);

    return null;
}

const Visor3DReadonly = ({ marcas }: { marcas: Marca3D[] }) => {
    const modelRef = useRef<THREE.Object3D | null>(null);

    const materials = useLoader(MTLLoader, MODELO_MTL, (loader) => {
        loader.setPath(MODELO_DIR);
        loader.setResourcePath(MODELO_DIR);
    });

    const loadedObject = useLoader(OBJLoader, MODELO_OBJ, (loader) => {
        materials.preload();
        loader.setMaterials(materials);
    });

    const { object, markerRadius } = useMemo(() => {
        const clone = loadedObject.clone(true);

        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);

        clone.traverse((child: any) => {
            if (child.isMesh) {
                child.geometry.computeVertexNormals();
                child.geometry.computeBoundingSphere();

                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat: any) => {
                            mat.side = THREE.DoubleSide;
                            mat.needsUpdate = true;
                        });
                    } else {
                        child.material.side = THREE.DoubleSide;
                        child.material.needsUpdate = true;
                    }
                } else {
                    child.material = new THREE.MeshStandardMaterial({
                        color: '#777777',
                        roughness: 0.7,
                        metalness: 0.05,
                        side: THREE.DoubleSide
                    });
                }

                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = true;
            }
        });

        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        clone.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const radius = maxDim > 0 ? maxDim * 0.018 : 0.18;

        return {
            object: clone,
            markerRadius: radius
        };
    }, [loadedObject]);

    useEffect(() => {
        modelRef.current = object;

        return () => {
            if (modelRef.current === object) {
                modelRef.current = null;
            }
        };
    }, [object]);

    return (
        <>
            <primitive object={object}>
                {marcas.map((m, i) => (
                    <mesh key={i} position={[m.x, m.y, m.z]}>
                        <sphereGeometry args={[markerRadius, 12, 12]} />
                        <meshBasicMaterial color={m.tipo === 'X' ? '#ef4444' : '#f59e0b'} />
                    </mesh>
                ))}
            </primitive>

            <AutoFitCameraReadonly objectRef={modelRef} />
        </>
    );
};

const NOMBRES_DRENES: Record<number, string> = {
    1: 'Delantero del tanque',
    2: 'Strainer',
    3: 'Succión auxiliar',
    4: 'Trasero del tanque',
    5: 'Entrada a elementos filtrantes',
    6: 'Salida de elementos filtrantes'
};

export const DetalleTurnoAutotanque = ({ data }: Props) => {
    const [activeTab, setActiveTab] = useState<'balance' | 'checklist' | 'final'>('balance');
    const [drenActivo, setDrenActivo] = useState<number>(1);

    const source = data?.turno ? data : data?.data?.turno ? data.data : data;
    const turno = source?.turno || null;
    const remision = source?.remision || [];
    const sumaAutotanque = source?.sumaAutotanque || [];
    const inspeccion = turno?.inspeccion || source?.inspeccion;

    const formatNumber = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? '0' : num.toLocaleString('en-US');
    };

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

    const gruposChecklist = {
        vehiculoGeneral: [
            'Faros delanteros y Luces Traseras',
            'Luces intermitentes',
            'Llantas y Rines',
            'Llanta de refacción',
            'Espejos laterales',
            'Limpiadores'
        ],
        tanqueSuministro: [
            'Bomba y Manguera',
            "Boquilla 'Single point'",
            'Unidad de filtrado',
            'Líneas de conducción',
            'Gabinete de Manómetros',
            'Tapa boca hombre'
        ],
        seguridad: [
            'Banderines',
            'Carrete y Cable de tierra',
            'Interruptor maestro',
            'Extintores',
            'Rombo de seguridad',
            'Alarma de reversa'
        ],
        calidadCombustible: [
            'Toma de Muestra de Combustible',
            'Prueba de claridad y Brillantez',
            'Presencia de Sólidos y/o agua de forma visual'
        ]
    };

    const respuestas = inspeccion?.checklist_respuestas || {};
    const marcasHistoricas: Marca3D[] = inspeccion?.danos_grafico || [];

    return (
        <div className="space-y-6 p-1">
            <div className="flex border border-slate-200 bg-slate-50/70 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('balance')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        activeTab === 'balance'
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Calculator size={14} />
                    Balances y Ventas
                </button>

                <button
                    onClick={() => setActiveTab('checklist')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        activeTab === 'checklist'
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <ShieldCheck size={14} />
                    Checklist e Inspección
                </button>

                <button
                    onClick={() => setActiveTab('final')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        activeTab === 'final'
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Eye size={14} />
                    Gráficos 3D y Firmas
                </button>
            </div>

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
                                    <span className="text-[10px] font-black text-slate-500 uppercase">
                                        Remisiones (Ventas)
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {remision.length > 0 ? (
                                        remision.map((r: any) => (
                                            <div
                                                key={r.id}
                                                className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]"
                                            >
                                                <span className="font-bold text-slate-500">
                                                    {formatChronology(r.fecha).split(' ')[0]}
                                                </span>
                                                <span className="font-black text-indigo-600">{r.folio}</span>
                                                <span className="font-black">{formatNumber(r.total_litros)} LTS</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic text-center py-2">
                                            Sin remisiones
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <ClipboardList size={14} className="text-slate-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase">
                                        ASA (Cargas Autotanque)
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {sumaAutotanque.length > 0 ? (
                                        sumaAutotanque.map((s: any) => (
                                            <div
                                                key={s.id}
                                                className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]"
                                            >
                                                <span className="font-bold text-slate-500">
                                                    {s.created_at
                                                        ? formatChronology(
                                                              s.created_at.replace('T', ' ').substring(0, 19)
                                                          ).split(' ')[0]
                                                        : '---'}
                                                </span>
                                                <span className="font-black text-emerald-600">{s.folio}</span>
                                                <span className="font-black">{formatNumber(s.litros)} LTS</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic text-center py-2">
                                            Sin registros ASA
                                        </p>
                                    )}
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
                            <h4 className="font-black text-white uppercase text-xs tracking-widest">
                                Balance de Inventario
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center md:text-left">
                                <p className="text-[10px] font-black text-indigo-200 uppercase">
                                    Inventario Aritmético
                                </p>
                                <p className="text-xl font-black text-white">
                                    {formatNumber(turno.balanceAritmetico)} <small className="text-xs">LTS</small>
                                </p>
                            </div>

                            <div className="text-center md:text-left">
                                <p className="text-[10px] font-black text-indigo-200 uppercase">
                                    Toma Física (Balance)
                                </p>
                                <p className="text-xl font-black text-white">
                                    {formatNumber(turno.balanceFisico)} <small className="text-xs">LTS</small>
                                </p>
                            </div>

                            <div className="text-center md:bg-white/10 p-3 rounded-xl border border-white/20">
                                <p className="text-[10px] font-black text-white/70 uppercase">Diferencia</p>
                                <p
                                    className={`text-xl font-black ${
                                        Number(turno.diferenciaFinal) < 0
                                            ? 'text-rose-300'
                                            : 'text-emerald-300'
                                    }`}
                                >
                                    {formatNumber(turno.diferenciaFinal)} <small className="text-xs">LTS</small>
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'checklist' && (
                <div className="space-y-6">
                    <section>
                        <SectionHeader title="Lectura de Odómetro y Combustible" icon={Gauge} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DataBox
                                label="Kilometraje"
                                value={inspeccion ? `${formatNumber(inspeccion.kilometraje)} KM` : '---'}
                            />
                            <DataBox
                                label="Combustible %"
                                value={inspeccion ? `${inspeccion.porcentaje_combustible}%` : '---'}
                            />
                        </div>
                    </section>

                    {inspeccion ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">
                                    Vehículo General
                                </h5>

                                <div className="space-y-1.5">
                                    {gruposChecklist.vehiculoGeneral.map((item) => (
                                        <div
                                            key={item}
                                            className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]"
                                        >
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span
                                                className={`font-black uppercase px-2 py-0.5 rounded ${
                                                    respuestas[item] === 'Ok'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-rose-50 text-rose-600'
                                                }`}
                                            >
                                                {respuestas[item] || '---'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">
                                    Tanque y Suministro
                                </h5>

                                <div className="space-y-1.5">
                                    {gruposChecklist.tanqueSuministro.map((item) => (
                                        <div
                                            key={item}
                                            className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]"
                                        >
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span
                                                className={`font-black uppercase px-2 py-0.5 rounded ${
                                                    respuestas[item] === 'Ok'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-rose-50 text-rose-600'
                                                }`}
                                            >
                                                {respuestas[item] || '---'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">
                                    Seguridad
                                </h5>

                                <div className="space-y-1.5">
                                    {gruposChecklist.seguridad.map((item) => (
                                        <div
                                            key={item}
                                            className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]"
                                        >
                                            <span className="font-bold text-slate-600">{item}</span>
                                            <span
                                                className={`font-black uppercase px-2 py-0.5 rounded ${
                                                    respuestas[item] === 'Ok'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-rose-50 text-rose-600'
                                                }`}
                                            >
                                                {respuestas[item] || '---'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">
                                        Pruebas de Calidad de Combustible
                                    </h5>

                                    <div className="flex border border-slate-200 bg-white p-1 rounded-lg gap-0.5 mb-4 overflow-x-auto custom-scrollbar">
                                        {[1, 2, 3, 4, 5, 6].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => setDrenActivo(num)}
                                                className={`flex-1 min-w-[50px] py-1 text-[9px] font-black uppercase rounded transition-all ${
                                                    drenActivo === num
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                DR {num}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5">
                                        {gruposChecklist.calidadCombustible.map((item) => {
                                            const nombreDrenActual = NOMBRES_DRENES[drenActivo] || `${drenActivo}`;
                                            const llaveCompuesta = `${item} - Dren ${nombreDrenActual.toLowerCase()}`;

                                            let valorRespuesta = respuestas[llaveCompuesta];

                                            if (!valorRespuesta && respuestas[`${item} - Dren ${drenActivo}`]) {
                                                valorRespuesta = respuestas[`${item} - Dren ${drenActivo}`];
                                            }

                                            return (
                                                <div
                                                    key={item}
                                                    className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px]"
                                                >
                                                    <div className="flex flex-col max-w-[70%]">
                                                        <span className="font-bold text-slate-600 truncate">
                                                            {item}
                                                        </span>
                                                        <span className="text-[8px] text-indigo-500 font-bold tracking-tight">
                                                            Evaluando Dren {drenActivo}: {nombreDrenActual}
                                                        </span>
                                                    </div>

                                                    <span
                                                        className={`font-black uppercase px-2 py-0.5 rounded ${
                                                            valorRespuesta === 'Ok'
                                                                ? 'bg-emerald-50 text-emerald-600'
                                                                : valorRespuesta === 'No'
                                                                  ? 'bg-rose-50 text-rose-600'
                                                                  : 'bg-slate-100 text-slate-400'
                                                        }`}
                                                    >
                                                        {valorRespuesta || '---'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-xs text-slate-400 italic py-4">
                            No hay datos de inspección registrados.
                        </p>
                    )}

                    {inspeccion?.imagenes?.length > 0 && (
                        <section className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <ImageIcon size={14} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    Evidencias Fotográficas
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {inspeccion.imagenes.map((img: any) => (
                                    <div
                                        key={img.id}
                                        className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm"
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.observacion}
                                            className="w-full h-24 object-cover rounded-md"
                                        />
                                        <p className="text-[9px] font-black text-slate-500 mt-2 uppercase truncate">
                                            {img.pivot?.observacion || 'Evidencia'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {activeTab === 'final' && (
                <div className="space-y-6">
                    <section>
                        <SectionHeader title="Inspección Histórica de Daños (Visor 3D)" icon={Eye} />

                        <div className="h-[400px] md:h-[500px] w-full bg-slate-950 rounded-2xl relative border border-slate-800 overflow-hidden shadow-xl">
                            <div className="absolute top-3 left-3 z-10 text-[9px] font-bold text-slate-400 bg-slate-900/80 backdrop-blur px-2 py-1 rounded pointer-events-none border border-slate-800 uppercase tracking-wider">
                                Vista de lectura · Arrastre para rotar el tanque
                            </div>

                            <Canvas
                                camera={{ fov: 45 }}
                                dpr={1}
                                gl={{
                                    antialias: true,
                                    powerPreference: 'high-performance'
                                }}
                                shadows
                            >
                                <color attach="background" args={['#111827']} />

                                <ambientLight intensity={0.55} />
                                <directionalLight position={[6, 7, 6]} intensity={2.4} castShadow />
                                <directionalLight position={[-5, 4, -4]} intensity={1.1} />
                                <hemisphereLight intensity={0.8} groundColor="#1f2937" />

                                <OrbitControls
                                    makeDefault
                                    enablePan={false}
                                    enableZoom
                                    enableRotate
                                    minPolarAngle={0}
                                    maxPolarAngle={Math.PI / 2.1}
                                />

                                <Suspense
                                    fallback={
                                        <Html center>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                Cargando Estructura Autotanque...
                                            </span>
                                        </Html>
                                    }
                                >
                                    <Visor3DReadonly marcas={marcasHistoricas} />
                                </Suspense>
                            </Canvas>

                            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-800 text-[9px] font-bold text-slate-400 flex gap-4">
                                <span className="flex items-center gap-1">
                                    <XCircle size={12} className="text-red-500 fill-white" />
                                    Faltante (X)
                                </span>
                                <span className="flex items-center gap-1">
                                    <Circle size={12} className="text-amber-500 fill-white" />
                                    Daño Estructural (O)
                                </span>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionHeader title="Firmas de Conformidad" icon={PenTool} />

                        {inspeccion?.firmas?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {inspeccion.firmas.map((firma: any) => (
                                    <div
                                        key={firma.id}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center"
                                    >
                                        <div className="bg-white rounded-xl border border-slate-100 p-3 w-full h-24 flex items-center justify-center shadow-sm">
                                            <img
                                                src={firma.url}
                                                alt={firma.pivot?.tag}
                                                className="max-h-full max-w-full object-contain mix-blend-multiply"
                                            />
                                        </div>

                                        <div className="mt-3">
                                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                                                {firma.pivot?.tag || 'Firma Autorizada'}
                                            </p>
                                            <p className="text-[8px] font-black text-indigo-500 uppercase mt-0.5 tracking-wider">
                                                {firma.pivot?.rol}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-xs text-slate-400 italic py-4">
                                No se recolectaron firmas electrónicas para este turno.
                            </p>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};
