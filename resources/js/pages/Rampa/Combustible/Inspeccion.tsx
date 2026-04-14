import React, { useState, useEffect } from 'react';
import { InspeccionShell } from './components/InspeccionShell';
import { InspeccionHydrokit } from './components/InspeccionHydrokit';
import { apiGuardarInspeccionCompleta } from '@/stores/apiInspeccionCombustible'; // Importar
import { Save, Loader2, CheckCircle } from 'lucide-react';

interface FotoData {
    file: string;
    observacion: string;
    alertaRosa: boolean;
}

const Inspeccion = ({ onSuccess, dataInitial }: { onSuccess?: () => void, dataInitial?: any }) => {
    const [tipo, setTipo] = useState<'shell' | 'hydrokit'>('shell');
    const [fotosShell, setFotosShell] = useState<FotoData[]>([]);
    const [fotosHydrokit, setFotosHydrokit] = useState<FotoData[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
        if (dataInitial && dataInitial.evidencias) {
            const shell = dataInitial.evidencias
                .filter((ev: any) => ev.modulo === 'SHELL')
                .map((ev: any) => ({
                    file: ev.url,
                    observacion: ev.observacion,
                    alertaRosa: ev.alerta === 1 || ev.alerta === true
                }));

            const hydro = dataInitial.evidencias
                .filter((ev: any) => ev.modulo === 'HYDROKIT')
                .map((ev: any) => ({
                    file: ev.url,
                    observacion: ev.observacion,
                    alertaRosa: ev.alerta === 1 || ev.alerta === true
                }));

            setFotosShell(shell);
            setFotosHydrokit(hydro);
        }
    }, [dataInitial]);
    const handleGuardar = async () => {
        if (fotosShell.length === 0 && fotosHydrokit.length === 0) {
            alert("Debe agregar al menos una evidencia.");
            return;
        }

        try {
            setIsSaving(true);
            const payload = { shell: fotosShell, hydrokit: fotosHydrokit };
            await apiGuardarInspeccionCompleta(payload);

            alert("Inspección guardada correctamente.");

            if (onSuccess) {
                onSuccess();
            }

        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">
            <h1 className="text-2xl font-bold text-center text-slate-800 uppercase tracking-wider">
                Inspección de Combustible
            </h1>

            <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
                <button
                    onClick={() => setTipo('shell')}
                    className={`flex-1 min-w-[200px] py-4 rounded-2xl font-bold transition-all border-b-4 ${tipo === 'shell'
                        ? 'bg-yellow-500 text-white border-yellow-700 shadow-lg'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                >
                    MÓDULO SHELL
                </button>
                <button
                    onClick={() => setTipo('hydrokit')}
                    className={`flex-1 min-w-[200px] py-4 rounded-2xl font-bold transition-all border-b-4 ${tipo === 'hydrokit'
                        ? 'bg-blue-600 text-white border-blue-800 shadow-lg'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                >
                    MÓDULO HYDROKIT
                </button>
            </div>

            {/* Contenedor Principal */}
            <div className="bg-white border border-slate-200 shadow-xl rounded-3xl p-4 md:p-8 relative">
                {tipo === 'shell' ? (
                    <InspeccionShell fotos={fotosShell} setFotos={setFotosShell} />
                ) : (
                    <InspeccionHydrokit fotos={fotosHydrokit} setFotos={setFotosHydrokit} />
                )}

                {/* BOTÓN DE GUARDAR FINAL */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleGuardar}
                        disabled={isSaving}
                        className={`
                            flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-white uppercase tracking-widest transition-all
                            ${isSaving
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-green-200 active:scale-95'
                            }
                        `}
                    >
                        {isSaving ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        {isSaving ? 'Guardando...' : 'Finalizar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Inspeccion;
