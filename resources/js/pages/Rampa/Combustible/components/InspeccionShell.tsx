import { CameraModulo } from './CameraModulo';
import { AlertTriangle, CheckCircle2, Info, AlertCircle } from 'lucide-react';

interface Props {
    fotos: any[];
    setFotos: (f: any[]) => void;
}

export const InspeccionShell = ({ fotos, setFotos }: Props) => {
    const tieneContaminacionMedia = fotos.some(f => f.colorDetectado === '#315c2d');
    const tieneContaminacionAlta = fotos.some(f => f.colorDetectado === '#00374f');
    const tieneFotos = fotos.length > 0;

    const getStatusConfig = () => {
        if (tieneContaminacionAlta) {
            return {
                bg: 'bg-slate-900',
                border: 'border-slate-950',
                text: 'text-white',
                label: 'Muy Contaminada',
                desc: 'Alerta Crítica: Presencia masiva de contaminantes detectada.',
                icon: <AlertCircle size={40} className="text-red-500 animate-pulse" />,
                color: '#00374f'
            };
        }
        if (tieneContaminacionMedia) {
            return {
                bg: 'bg-orange-600',
                border: 'border-orange-800',
                text: 'text-white',
                label: 'Rastros de Agua',
                desc: 'Advertencia: Se detectaron partículas o rastros de humedad.',
                icon: <AlertTriangle size={40} className="text-white animate-bounce" />,
                color: '#315c2d'
            };
        }
        return {
            bg: 'bg-emerald-600',
            border: 'border-emerald-800',
            text: 'text-white',
            label: 'Prueba Correcta',
            desc: 'La muestra se encuentra dentro de los parámetros normales.',
            icon: <CheckCircle2 size={40} className="text-white" />,
            color: '#adac6a'
        };
    };

    const status = getStatusConfig();

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <h2 className="text-xl font-black text-yellow-600 flex items-center gap-2">
                    <span className="w-2 h-8 bg-yellow-500 rounded-full" />
                    CONTROL DE CALIDAD SHELL
                </h2>

                {tieneFotos && (
                    <div className={`w-full flex items-center justify-between p-5 rounded-2xl border-4 animate-in slide-in-from-top-2 duration-500 shadow-xl ${status.bg} ${status.border} ${status.text}`}>
                        <div className="flex items-center gap-5">
                            <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
                                {status.icon}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Estado Shell</span>
                                <span className="text-2xl font-black uppercase tracking-tight">{status.label}</span>
                                <span className="text-[11px] font-bold opacity-90 mt-1 italic">{status.desc}</span>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-center gap-2 bg-black/10 p-3 rounded-xl border border-white/20">
                            <span className="text-[9px] font-black uppercase">Color Base</span>
                            <div
                                className="w-12 h-12 rounded-full border-4 border-white shadow-inner"
                                style={{ backgroundColor: status.color }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {!tieneFotos && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 flex items-center gap-4 text-yellow-700 shadow-sm">
                    <div className="bg-yellow-500 p-2 rounded-lg text-white">
                        <Info size={20} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider leading-relaxed">
                        Inicie la captura fotográfica para validar la pureza del combustible mediante el patrón de color Shell.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                <CameraModulo
                    fotosGuardadas={fotos}
                    onSave={setFotos}
                    detectarColor={true}
                    tipoInspeccion="SHELL"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-[#adac6a] border-2 border-slate-300 shadow-sm"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Correcto</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Muestra Limpia</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-[#315c2d] border-2 border-slate-300 shadow-sm"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Rastros</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Agua / Sedimento</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-[#00374f] border-2 border-slate-300 shadow-sm"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Crítico</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Muy Contaminado</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
