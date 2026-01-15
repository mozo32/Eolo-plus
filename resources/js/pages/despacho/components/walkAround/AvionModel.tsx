import { useGLTF } from "@react-three/drei";

export default function AvionModel(props: any) {
    const { scene } = useGLTF("/avion.glb");

    return <primitive object={scene} {...props} />;
}
