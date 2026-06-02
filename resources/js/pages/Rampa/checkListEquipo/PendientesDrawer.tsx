import { useEffect, useState } from "react";
import { fetchUsuariosSinChecklist } from "@/stores/apiCheckListEquipoSeguridad";
import { X, UserCheck, ClipboardCopy } from "lucide-react";

interface PendientesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectUser: (usuario: any) => void;
}

export default function PendientesDrawer({ isOpen, onClose, onSelectUser }: PendientesDrawerProps) {
    const [pendientes, setPendientes] = useState<any[]>([]);
    const [loadingPendientes, setLoadingPendientes] = useState(false);

    // --- FUNCIÓN PARA CARGAR USUARIOS PENDIENTES ---
    const cargarPendientes = async () => {
        try {
            setLoadingPendientes(true);
            const respuesta = await fetchUsuariosSinChecklist();
            setPendientes(respuesta.data || []);
        } catch (error) {
            console.error("Error al cargar usuarios pendientes:", error);
        } finally { // <--- CORREGIDO AQUÍ (Antes decía crystalline)
            setLoadingPendientes(false);
        }
    };

    // Escucha cuando se abre el componente para sincronizar los datos con la API
    useEffect(() => {
        if (isOpen) {
            cargarPendientes();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex justify-end">
            {/* Fondo opaco con blur */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Contenedor del Panel */}
            <div className="relative w-full max-w-md bg-white h-screen shadow-2xl border-l border-slate-100 flex flex-col z-10 animate-in slide-in-from-right duration-300">
                {/* Cabecera del Panel */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                        <h3 className="text-base font-black uppercase text-slate-800 tracking-tighter">Personal Pendiente</h3>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Faltan por Checklist este mes</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido / Lista */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                    {loadingPendientes ? (
                        <div className="text-center py-20 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cargando pendientes...</div>
                    ) : pendientes.length === 0 ? (
                        <div className="text-center py-20 bg-emerald-50 rounded-2xl border border-emerald-100 p-6">
                            <UserCheck size={32} className="mx-auto text-emerald-500 mb-2" />
                            <p className="text-xs font-black text-emerald-800 uppercase tracking-tighter">¡Al día!</p>
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase mt-1">Todo el personal ha completado su checklist mensual.</p>
                        </div>
                    ) : (
                        pendientes.map((usuario) => (
                            <div
                                key={usuario.id}
                                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-3 min-w-0 mr-2">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center uppercase shrink-0">
                                        {usuario.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 uppercase truncate tracking-tight">{usuario.name || usuario.nombre}</p>
                                        <p className="text-[10px] font-medium text-slate-400 truncate">{usuario.email}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onSelectUser(usuario)}
                                    className="flex items-center gap-1 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 hover:border-indigo-600 px-2.5 py-1.5 rounded-lg shadow-xs transition-all font-black text-[9px] uppercase tracking-wider shrink-0 active:scale-95"
                                >
                                    <ClipboardCopy size={12} />
                                    <span>Auditar</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
