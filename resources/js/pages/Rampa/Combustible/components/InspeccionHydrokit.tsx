import { CameraModulo } from './CameraModulo';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface Props {
    fotos: any[];
    setFotos: (f: any[]) => void;
}

export const InspeccionHydrokit = ({ fotos, setFotos }: Props) => {
    const tieneContaminacion = fotos.some(f => f.alertaRosa === true);
    const tieneFotos = fotos.length > 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <h2 className="text-xl font-black text-blue-700 flex items-center gap-2">
                    <span className="w-2 h-8 bg-blue-600 rounded-full" />
                    PRUEBA DE HYDROKIT (AGUA EN COMBUSTIBLE)
                </h2>

                {tieneFotos && (
                    <div className={`w-full flex items-center justify-between p-5 rounded-2xl border-4 animate-in slide-in-from-top-2 duration-500 shadow-xl ${
                        tieneContaminacion
                        ? 'bg-red-600 border-red-800 text-white'
                        : 'bg-emerald-600 border-emerald-800 text-white'
                    }`}>
                        <div className="flex items-center gap-5">
                            <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
                                {tieneContaminacion ? (
                                    <div className="relative">
                                        <AlertTriangle size={40} className="text-white animate-bounce" />
                                        <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-40"></span>
                                    </div>
                                ) : (
                                    <CheckCircle2 size={40} className="text-white" />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Resultado de Análisis</span>
                                <span className="text-2xl font-black uppercase tracking-tight">
                                    {tieneContaminacion ? '¡Contaminación Detectada!' : 'Combustible sin Agua'}
                                </span>
                                <span className="text-[11px] font-bold opacity-90 mt-1 italic">
                                    {tieneContaminacion
                                        ? 'Atención: Se detectó presencia de agua en la muestra analizada.'
                                        : 'Validación exitosa: La muestra cumple con los estándares de pureza.'}
                                </span>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-center gap-2 bg-black/10 p-3 rounded-xl border border-white/20">
                            <span className="text-[9px] font-black uppercase">Patrón Detectado</span>
                            <div
                                className="w-12 h-12 rounded-full border-4 border-white shadow-inner"
                                style={{ backgroundColor: tieneContaminacion ? '#cca7c0' : '#b7b5ba' }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {!tieneFotos && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-center gap-4 text-blue-700 shadow-sm">
                    <div className="bg-blue-600 p-2 rounded-lg text-white">
                        <Info size={20} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider leading-relaxed">
                        Capture una fotografía clara del vial para que el sistema realice la validación colorimétrica automática.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                <CameraModulo
                    fotosGuardadas={fotos}
                    onSave={setFotos}
                    detectarColor={true}
                    tipoInspeccion="HYDROKIT"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-[#cca7c0] border-2 border-slate-300 shadow-sm"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Contaminado</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Color Rosa / Púrpura</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-[#b7b5ba] border-2 border-slate-300 shadow-sm"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Muestra Seca</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Color Gris / Neutro</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
