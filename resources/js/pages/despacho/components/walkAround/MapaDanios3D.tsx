//resources\js\pages\despacho\components\walkAround\MapaDanios3D.tsx
import React, {
    useState,
    useRef,
    useEffect,
    useMemo,
    forwardRef,
    useImperativeHandle,
} from "react";
import { Canvas, useLoader, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

/* =======================
   Tipos
======================= */

export interface PuntoDanio {
    x: number;
    y: number;
    z: number;
    descripcion?: string | null;
    severidad?: string | null;
}

type ToolMode = "mark" | "erase" | "view";

export interface MapaDanios3DProps {
    value: PuntoDanio[];
    onChange?: (puntos: PuntoDanio[]) => void;
    modelSrc: string;
    readOnly?: boolean;
    pdfMode?: boolean;
}

export type MapaDanios3DRef = {
    capture: () => string | null;
};

/* =======================
   AutoFit Camera (PDF)
======================= */

function AutoFitCameraToPoints({ points }: { points: PuntoDanio[] }) {
    const { camera } = useThree();
    const fitted = useRef(false);

    useEffect(() => {
        if (!points.length || fitted.current) return;

        const cam = camera as THREE.PerspectiveCamera;
        if (!cam.isPerspectiveCamera) return;

        const box = new THREE.Box3();
        points.forEach((p) =>
            box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z))
        );

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = (cam.fov * Math.PI) / 180;
        const cameraZ = (maxDim / 2) / Math.tan(fov / 2);

        cam.position.set(center.x, center.y, cameraZ * 1.6);
        cam.near = cameraZ / 50;
        cam.far = cameraZ * 50;
        cam.updateProjectionMatrix();
        cam.lookAt(center);

        fitted.current = true;
    }, [points, camera]);

    return null;
}

/* =======================
   AutoFit Camera Normal
======================= */

function AutoFitCamera({
    objectRef,
}: {
    objectRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
    const { camera } = useThree();
    const fitted = useRef(false);

    useEffect(() => {
        if (!objectRef.current || fitted.current) return;

        const cam = camera as THREE.PerspectiveCamera;
        if (!cam.isPerspectiveCamera) return;

        const box = new THREE.Box3().setFromObject(objectRef.current);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = (cam.fov * Math.PI) / 180;
        const cameraZ = (maxDim / 2) / Math.tan(fov / 2);

        cam.position.set(center.x, center.y, cameraZ * 1.15);
        cam.near = cameraZ / 50;
        cam.far = cameraZ * 50;
        cam.updateProjectionMatrix();
        cam.lookAt(center);

        fitted.current = true;
    }, [objectRef, camera]);

    return null;
}

/* =======================
   Modelo 3D
======================= */

function AvionModel({
    modelSrc,
    points,
    onClick,
    modelRef,
}: {
    modelSrc: string;
    points: PuntoDanio[];
    onClick?: (point: THREE.Vector3) => void;
    modelRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
    const object = useLoader(OBJLoader, modelSrc);

    useEffect(() => {
        modelRef.current = object;
    }, [object, modelRef]);

    useMemo(() => {
        object.position.set(0, 0, 0);
        object.scale.set(1, 1, 1);

        const box = new THREE.Box3().setFromObject(object);
        const center = new THREE.Vector3();
        box.getCenter(center);
        object.position.sub(center);
    }, [object]);

    return (
        <primitive
            object={object}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                if (!onClick || !e.intersections.length) return;

                const hit = e.intersections[0];
                const worldPoint = hit.point.clone();
                const normal =
                    hit.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1);

                normal.transformDirection(hit.object.matrixWorld);
                worldPoint.add(normal.multiplyScalar(0.01));

                const localPoint = worldPoint.clone();
                object.worldToLocal(localPoint);

                onClick(localPoint);
            }}
        >
            {points.map((p, i) => (
                <mesh key={i} position={[p.x, p.y, p.z]}>
                    <sphereGeometry args={[0.05, 16, 16]} />
                    <meshStandardMaterial
                        color={p.severidad === "alta" ? "orange" : "red"}
                    />
                </mesh>
            ))}
        </primitive>
    );
}

/* =======================
   Componente principal
======================= */

const MapaDanios3D = forwardRef<MapaDanios3DRef, MapaDanios3DProps>(
    function MapaDanios3D(
        {
            value,
            onChange,
            modelSrc,
            readOnly = false,
            pdfMode = false,
        },
        ref
    ) {
        useEffect(() => {
            useLoader.preload(OBJLoader, modelSrc);
        }, [modelSrc]);

        const [tool, setTool] = useState<ToolMode>("view");
        const modelRef = useRef<THREE.Object3D | null>(null);
        const glRef = useRef<THREE.WebGLRenderer | null>(null);
        const sceneRef = useRef<THREE.Scene | null>(null);
        const cameraRef = useRef<THREE.Camera | null>(null);

        useImperativeHandle(ref, () => ({
            capture() {
                if (!glRef.current || !sceneRef.current || !cameraRef.current) {
                return null;
                }
                glRef.current.render(sceneRef.current, cameraRef.current);

                return glRef.current.domElement.toDataURL("image/png");
            },
        }));

        const addPoint = (p: THREE.Vector3) => {
            if (!onChange || readOnly || tool !== "mark") return;

            onChange([
                ...value,
                {
                    x: Number(p.x.toFixed(4)),
                    y: Number(p.y.toFixed(4)),
                    z: Number(p.z.toFixed(4)),
                },
            ]);
        };

        const removeNearestPoint = (p: THREE.Vector3) => {
            if (!onChange || readOnly || tool !== "erase" || !value.length)
                return;

            let minDist = Infinity;
            let index = -1;

            value.forEach((d, i) => {
                const dist = new THREE.Vector3(
                    d.x,
                    d.y,
                    d.z
                ).distanceTo(p);
                if (dist < minDist) {
                    minDist = dist;
                    index = i;
                }
            });

            if (minDist > 0.15) return;

            const next = [...value];
            next.splice(index, 1);
            onChange(next);
        };

        return (
            <div className="w-full">
                {!readOnly && !pdfMode && (
                    <div className="flex gap-2 mb-2">
                        <button
                            type="button"
                            onClick={() => setTool("mark")}
                            className={`px-3 py-1 text-xs rounded ${tool === "mark"
                                    ? "bg-red-600 text-white"
                                    : "bg-gray-200"
                                }`}
                        >
                            🟥 Marcar
                        </button>

                        <button
                            type="button"
                            onClick={() => setTool("erase")}
                            className={`px-3 py-1 text-xs rounded ${tool === "erase"
                                    ? "bg-gray-700 text-white"
                                    : "bg-gray-200"
                                }`}
                        >
                            🗑 Borrar
                        </button>

                        <button
                            type="button"
                            onClick={() => setTool("view")}
                            className={`px-3 py-1 text-xs rounded ${tool === "view"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200"
                                }`}
                        >
                            👁 Ver
                        </button>
                    </div>
                )}

                <div className="h-[500px] w-full rounded-xl border">
                    <Canvas
                        camera={{ fov: 45 }}
                        onCreated={({ gl, scene, camera }) => {
                            glRef.current = gl;
                            sceneRef.current = scene;
                            cameraRef.current = camera;
                        }}
                    >
                        <color attach="background" args={["#ffffff"]} />
                        <ambientLight intensity={0.6} />
                        <directionalLight position={[5, 5, 5]} />

                        <AvionModel
                            modelSrc={modelSrc}
                            modelRef={modelRef}
                            points={value}
                            onClick={(p) => {
                                if (tool === "mark") addPoint(p);
                                if (tool === "erase") removeNearestPoint(p);
                            }}
                        />

                        {!pdfMode && (
                            <AutoFitCamera objectRef={modelRef} />
                        )}

                        {pdfMode && (
                            <AutoFitCameraToPoints points={value} />
                        )}

                        <OrbitControls
                            enablePan={!pdfMode}
                            enableZoom={!pdfMode}
                            enableRotate={!pdfMode}
                        />
                    </Canvas>
                </div>
            </div>
        );
    }
);

export default MapaDanios3D;
