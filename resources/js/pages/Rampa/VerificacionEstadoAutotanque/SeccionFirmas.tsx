import React, {
    useState,
    useRef,
    useLayoutEffect,
    useEffect,
    Suspense,
    useMemo
} from 'react';
import {
    Trash2,
    ClipboardCheck,
    PenTool,
    XCircle,
    Circle,
    Save,
    Eye,
    Eraser,
    RotateCcw
} from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { Canvas, useLoader, ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';

const MODELO_DIR = '/models/Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture_obj/';
const MODELO_OBJ = `${MODELO_DIR}Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture.obj`;
const MODELO_MTL = `${MODELO_DIR}Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture.mtl`;

useLoader.preload(MTLLoader, MODELO_MTL);
useLoader.preload(OBJLoader, MODELO_OBJ);

export interface Marca3D {
    x: number;
    y: number;
    z: number;
    tipo: 'X' | 'O';
}

type ToolMode = 'view' | 'x' | 'o' | 'erase';

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
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: {
            id: number;
            nombre: string;
            route: string;
        }[];
    }[];
};

interface Props {
    estaCompleto: boolean;
    onGuardar: (datosFirmas: any) => void;
    marcas: Marca3D[];
    setMarcas: React.Dispatch<React.SetStateAction<Marca3D[]>>;
    firmasExistentes?: Record<string, string>;
}

function AutoFitCamera({
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

function ModeloInspeccion({
    marcas,
    setMarcas,
    tool,
    modelRef
}: {
    marcas: Marca3D[];
    setMarcas: React.Dispatch<React.SetStateAction<Marca3D[]>>;
    tool: ToolMode;
    modelRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
    const materials = useLoader(MTLLoader, MODELO_MTL, (loader) => {
        loader.setPath(MODELO_DIR);
        loader.setResourcePath(MODELO_DIR);
    });

    const loadedObject = useLoader(OBJLoader, MODELO_OBJ, (loader) => {
        materials.preload();
        loader.setMaterials(materials);
    });

    const { object, markerRadius, eraseDistance } = useMemo(() => {
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
            markerRadius: radius,
            eraseDistance: radius * 4
        };
    }, [loadedObject]);

    useEffect(() => {
        modelRef.current = object;

        return () => {
            if (modelRef.current === object) {
                modelRef.current = null;
            }
        };
    }, [object, modelRef]);

    const agregarMarca = (p: THREE.Vector3, tipo: 'X' | 'O') => {
        setMarcas((prev) => [
            ...prev,
            {
                x: Number(p.x.toFixed(4)),
                y: Number(p.y.toFixed(4)),
                z: Number(p.z.toFixed(4)),
                tipo
            }
        ]);
    };

    const borrarMarcaCercana = (p: THREE.Vector3) => {
        setMarcas((prev) => {
            if (!prev.length) return prev;

            let minDist = Infinity;
            let index = -1;

            prev.forEach((m, i) => {
                const dist = new THREE.Vector3(m.x, m.y, m.z).distanceTo(p);

                if (dist < minDist) {
                    minDist = dist;
                    index = i;
                }
            });

            if (minDist > eraseDistance || index === -1) return prev;

            const next = [...prev];
            next.splice(index, 1);

            return next;
        });
    };

    return (
        <primitive
            object={object}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (tool === 'view') return;

                e.stopPropagation();

                if (!e.intersections.length) return;

                const hit = e.intersections[0];
                const worldPoint = hit.point.clone();
                const normal = hit.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1);

                normal.transformDirection(hit.object.matrixWorld);
                worldPoint.add(normal.multiplyScalar(markerRadius * 0.2));

                const localPoint = worldPoint.clone();
                object.worldToLocal(localPoint);

                if (tool === 'x') agregarMarca(localPoint, 'X');
                if (tool === 'o') agregarMarca(localPoint, 'O');
                if (tool === 'erase') borrarMarcaCercana(localPoint);
            }}
        >
            {marcas.map((m, i) => (
                <mesh key={i} position={[m.x, m.y, m.z]}>
                    <sphereGeometry args={[markerRadius, 12, 12]} />
                    <meshBasicMaterial color={m.tipo === 'X' ? '#ef4444' : '#f59e0b'} />
                </mesh>
            ))}
        </primitive>
    );
}

function EscenaInspeccion({
    marcas,
    setMarcas,
    tool,
    modelRef
}: {
    marcas: Marca3D[];
    setMarcas: React.Dispatch<React.SetStateAction<Marca3D[]>>;
    tool: ToolMode;
    modelRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
    const { invalidate } = useThree();

    return (
        <>
            <Suspense fallback={null}>
                <ModeloInspeccion
                    modelRef={modelRef}
                    marcas={marcas}
                    setMarcas={setMarcas}
                    tool={tool}
                />
            </Suspense>

            <AutoFitCamera objectRef={modelRef} />

            <OrbitControls
                enablePan
                enableZoom
                enableRotate
                enableDamping={false}
                onChange={() => invalidate()}
            />
        </>
    );
}

const CardFirma = React.memo(({ titulo, id, nombre, setNombres, canvasRef }: any) => {
    const limpiarCanvas = () => {
        const canvas = canvasRef.current;

        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    return (
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-700">
                <PenTool size={16} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-widest">{titulo}</span>
            </div>

            <input
                type="text"
                placeholder="Nombre del responsable"
                value={nombre}
                onChange={(e) => setNombres((prev: any) => ({ ...prev, [id]: e.target.value }))}
                className="w-full bg-transparent border-b-2 border-slate-200 py-2 mb-4 outline-none focus:border-blue-500 transition-colors text-sm"
            />

            <div className="relative bg-white rounded-xl border border-slate-200 overflow-hidden h-36">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" />

                <button
                    type="button"
                    onClick={limpiarCanvas}
                    className="absolute bottom-2 right-2 p-2 bg-slate-100/80 backdrop-blur-sm text-slate-400 rounded-lg hover:text-red-500 transition-all z-10"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
});

CardFirma.displayName = 'CardFirma';

export const SeccionFirmas = ({
    estaCompleto,
    onGuardar,
    marcas,
    setMarcas,
    firmasExistentes
}: Props) => {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;

    const [tool, setTool] = useState<ToolMode>('view');
    const modelRef = useRef<THREE.Object3D | null>(null);

    const [nombres, setNombres] = useState({
        entrega: user?.name || '',
        receptor: '',
        operaciones: ''
    });

    const entregaRef = useRef<HTMLCanvasElement>(null);
    const receptorRef = useRef<HTMLCanvasElement>(null);
    const operacionesRef = useRef<HTMLCanvasElement>(null);

    const canvasRefs = useMemo(() => {
        return {
            entrega: entregaRef,
            receptor: receptorRef,
            operaciones: operacionesRef
        };
    }, []);

    useEffect(() => {
        if (!firmasExistentes) return;

        const cargarImagenEnCanvas = (tag: string, canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
            const url = firmasExistentes[tag];
            const canvas = canvasRef.current;

            if (!url || !canvas) return;

            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.crossOrigin = 'anonymous';
            img.src = url;

            img.onload = () => {
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
        };

        cargarImagenEnCanvas('Firma quien entrega', canvasRefs.entrega);
        cargarImagenEnCanvas('Firma quien recibe', canvasRefs.receptor);
        cargarImagenEnCanvas('Firma fbo', canvasRefs.operaciones);
    }, [firmasExistentes, canvasRefs]);

    useLayoutEffect(() => {
        const initializers = Object.values(canvasRefs).map((ref) => {
            const canvas = ref.current;

            if (!canvas) return null;

            const ctx = canvas.getContext('2d', { desynchronized: true });

            if (!ctx) return null;

            const resize = () => {
                const rect = canvas.getBoundingClientRect();

                canvas.width = rect.width;
                canvas.height = rect.height;

                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#1e293b';
            };

            resize();

            let isDrawing = false;

            const getPointerPos = (e: any) => {
                const rect = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            };

            const start = (e: any) => {
                e.preventDefault();

                isDrawing = true;

                const { x, y } = getPointerPos(e);

                ctx.beginPath();
                ctx.moveTo(x, y);
            };

            const move = (e: any) => {
                e.preventDefault();

                if (!isDrawing) return;

                const { x, y } = getPointerPos(e);

                ctx.lineTo(x, y);
                ctx.stroke();
            };

            const stop = () => {
                isDrawing = false;
                ctx.closePath();
            };

            const touchOptions: AddEventListenerOptions = { passive: false };

            canvas.addEventListener('mousedown', start);
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', stop);

            canvas.addEventListener('touchstart', start, touchOptions);
            canvas.addEventListener('touchmove', move, touchOptions);
            canvas.addEventListener('touchend', stop);

            return () => {
                canvas.removeEventListener('mousedown', start);
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', stop);

                canvas.removeEventListener('touchstart', start);
                canvas.removeEventListener('touchmove', move);
                canvas.removeEventListener('touchend', stop);
            };
        });

        return () => {
            initializers.forEach((clean) => clean?.());
        };
    }, [canvasRefs]);

    const prepararGuardado = () => {
        const firmasFinales = {
            entrega: {
                nombre: nombres.entrega,
                imagen: canvasRefs.entrega.current?.toDataURL()
            },
            receptor: {
                nombre: nombres.receptor,
                imagen: canvasRefs.receptor.current?.toDataURL()
            },
            operaciones: {
                nombre: nombres.operaciones,
                imagen: canvasRefs.operaciones.current?.toDataURL()
            }
        };

        onGuardar(firmasFinales);
    };

    const deshacerUltimo = () => {
        setMarcas((prev) => prev.slice(0, -1));
    };

    const limpiarMarcas = () => {
        setMarcas([]);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12 p-4">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <ClipboardCheck size={24} />
                </div>

                <div>
                    <h2 className="text-xl font-bold text-slate-800">Inspección Final y Firmas</h2>
                    <p className="text-sm text-slate-500">
                        Registre daños interactuando con el modelo 3D y firme para finalizar.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setTool('x')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                tool === 'x' ? 'bg-red-600 text-white' : 'bg-gray-200 text-slate-600'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <XCircle size={14} />
                                FALTANTE
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTool('o')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                tool === 'o' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-slate-600'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <Circle size={14} />
                                DAÑO
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTool('erase')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                tool === 'erase' ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-600'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <Eraser size={14} />
                                BORRAR
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTool('view')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                tool === 'view' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-slate-600'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <Eye size={14} />
                                VER
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={deshacerUltimo}
                            className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-500 border border-slate-200 shadow-sm hover:text-blue-600 transition-all"
                        >
                            <span className="inline-flex items-center gap-1">
                                <RotateCcw size={14} />
                                DESHACER
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={limpiarMarcas}
                            className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-500 border border-slate-200 shadow-sm hover:text-red-600 transition-all"
                        >
                            <span className="inline-flex items-center gap-1">
                                <Trash2 size={14} />
                                LIMPIAR
                            </span>
                        </button>
                    </div>
                </div>

                <div className="h-[500px] w-full border-b border-slate-100 bg-slate-900">
                    <Canvas
                        camera={{ fov: 45 }}
                        frameloop="always"
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

                        <EscenaInspeccion
                            marcas={marcas}
                            setMarcas={setMarcas}
                            tool={tool}
                            modelRef={modelRef}
                        />
                    </Canvas>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50">
                    <div className="rounded-xl bg-red-50 p-4">
                        <div className="text-2xl font-black text-red-500">
                            {marcas.filter((m) => m.tipo === 'X').length}
                        </div>

                        <div className="text-[10px] font-black uppercase tracking-widest text-red-400">
                            Faltantes
                        </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 p-4">
                        <div className="text-2xl font-black text-amber-500">
                            {marcas.filter((m) => m.tipo === 'O').length}
                        </div>

                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                            Daños
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardFirma
                    titulo="Entrega de Turno"
                    id="entrega"
                    nombre={nombres.entrega}
                    setNombres={setNombres}
                    canvasRef={canvasRefs.entrega}
                />

                <CardFirma
                    titulo="Receptor de Turno"
                    id="receptor"
                    nombre={nombres.receptor}
                    setNombres={setNombres}
                    canvasRef={canvasRefs.receptor}
                />

                <CardFirma
                    titulo="Operaciones FBO"
                    id="operaciones"
                    nombre={nombres.operaciones}
                    setNombres={setNombres}
                    canvasRef={canvasRefs.operaciones}
                />
            </div>

            <div className="mt-8">
                <button
                    type="button"
                    onClick={prepararGuardado}
                    disabled={!estaCompleto}
                    className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                        estaCompleto
                            ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100 hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    <Save size={20} />
                    FINALIZAR REVISIÓN
                </button>
            </div>
        </div>
    );
};
