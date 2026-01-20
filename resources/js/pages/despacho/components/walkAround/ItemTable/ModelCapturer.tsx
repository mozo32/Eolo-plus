import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export interface Point3D {
    x: number;
    y: number;
    z: number;
    descripcion?: string | null;
    severidad?: string | null;
}

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 0.12;
const CAMERA_DISTANCE_FACTOR = 0.9;

/* ============================================================
   BASE
============================================================ */

function setupScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(10, 20, 10);
    scene.add(light);

    return scene;
}

function setupRenderer() {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
    });
    renderer.setSize(WIDTH, HEIGHT);
    return renderer;
}

/* ============================================================
   CÁMARA GENERAL (TOP / CONTEXTO)
============================================================ */

function setupTopCamera(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const camera = new THREE.OrthographicCamera(
        -maxDim,
        maxDim,
        maxDim,
        -maxDim,
        -1000,
        1000
    );

    camera.position.set(0, maxDim * 2, 0);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 0, -1);
    camera.updateProjectionMatrix();

    return { camera, maxDim };
}

/* ============================================================
   CÁMARA DINÁMICA POR PUNTO (CLAVE)
============================================================ */

function setupPointCamera(
    point: THREE.Vector3,
    center: THREE.Vector3,
    maxDim: number
) {
    const direction = new THREE.Vector3()
        .subVectors(point, center)
        .normalize();

    if (direction.length() === 0) {
        direction.set(0, 1, 0);
    }

    const camera = new THREE.PerspectiveCamera(
        35,
        WIDTH / HEIGHT,
        0.01,
        2000
    );

    camera.position.copy(
        point.clone().add(direction.multiplyScalar(maxDim * CAMERA_DISTANCE_FACTOR))
    );

    camera.lookAt(point);
    camera.updateProjectionMatrix();

    return camera;
}

/* ============================================================
   CAPTURA GENERAL
============================================================ */

export async function captureModelScreenshot(
    modelUrl: string,
    points: Point3D[]
): Promise<string> {
    return new Promise((resolve, reject) => {
        const scene = setupScene();
        const renderer = setupRenderer();
        const loader = new OBJLoader();

        loader.load(
            modelUrl,
            (object) => {
                scene.add(object);

                const { camera, maxDim } = setupTopCamera(object);

                const dotGeometry = new THREE.SphereGeometry(POINT_RADIUS, 16, 16);
                const dotMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    depthTest: false,
                });

                points.forEach((p) => {
                    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                    dot.position.set(p.x, p.y, p.z);
                    scene.add(dot);
                });

                renderer.render(scene, camera);
                resolve(renderer.domElement.toDataURL("image/png"));
                renderer.dispose();
            },
            undefined,
            reject
        );
    });
}

/* ============================================================
   CAPTURA POR MARCA (VISTA CORRECTA SEGÚN POSICIÓN)
============================================================ */

export async function capturePointsScreenshots(
    modelUrl: string,
    points: Point3D[]
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const scene = setupScene();
        const renderer = setupRenderer();
        const loader = new OBJLoader();

        loader.load(
            modelUrl,
            (object) => {
                scene.add(object);

                const box = new THREE.Box3().setFromObject(object);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                const screenshots: string[] = [];

                const dotGeometry = new THREE.SphereGeometry(POINT_RADIUS, 16, 16);
                const dotMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    depthTest: false,
                });

                points.forEach((p) => {
                    const point = new THREE.Vector3(p.x, p.y, p.z);

                    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                    dot.position.copy(point);
                    scene.add(dot);

                    const camera = setupPointCamera(point, center, maxDim);

                    renderer.render(scene, camera);
                    screenshots.push(renderer.domElement.toDataURL("image/png"));

                    scene.remove(dot);
                });

                renderer.dispose();
                resolve(screenshots);
            },
            undefined,
            reject
        );
    });
}
