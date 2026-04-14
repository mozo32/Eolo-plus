import { CameraModulo } from './CameraModulo';

interface Props { fotos: any[]; setFotos: (f: any[]) => void; }

export const InspeccionShell = ({ fotos, setFotos }: Props) => (
    <div className="space-y-4">
        <h2 className="text-xl font-black text-yellow-600 flex items-center gap-2">
            <span className="w-2 h-8 bg-yellow-500 rounded-full" />
            CONTROL DE CALIDAD SHELL
        </h2>
        <CameraModulo
            fotosGuardadas={fotos}
            onSave={setFotos}
            detectarColor={true}
            tipoInspeccion="SHELL"
        />
    </div>
);
