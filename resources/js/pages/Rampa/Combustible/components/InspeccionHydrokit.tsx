import { CameraModulo } from './CameraModulo';

interface Props { fotos: any[]; setFotos: (f: any[]) => void; }

export const InspeccionHydrokit = ({ fotos, setFotos }: Props) => (
    <div className="space-y-4">
        <h2 className="text-xl font-black text-blue-700 flex items-center gap-2">
            <span className="w-2 h-8 bg-blue-600 rounded-full" />
            PRUEBA DE HYDROKIT (AGUA EN COMBUSTIBLE)
        </h2>
        <CameraModulo
            fotosGuardadas={fotos}
            onSave={setFotos}
            detectarColor={true}
            tipoInspeccion="HYDROKIT"
        />
    </div>
);
