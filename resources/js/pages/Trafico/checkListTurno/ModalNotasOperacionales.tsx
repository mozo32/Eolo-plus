import { X, BookOpen, Calendar, Layers, CheckCircle } from 'lucide-react';

interface ModalNotasOperacionalesProps {
    isOpen: boolean;
    onClose: () => void;
    notas: any[];
    loading: boolean;
    onValidar: (notaId: number) => void; // <-- Nueva prop para manejar el clic de validación
}

export default function ModalNotasOperacionales({ isOpen, onClose, notas, loading, onValidar }: ModalNotasOperacionalesProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">

                {/* Encabezado */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-indigo-600" />
                        <div>
                            <h3 className="text-base font-black uppercase text-slate-800 tracking-tighter">
                                Notas Operacionales Recientes
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial de incidencias y avisos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido / Lista */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 flex-1 space-y-3">
                    {loading ? (
                        <div className="text-center py-12 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Cargando notas operacionales...
                        </div>
                    ) : notas.length > 0 ? (
                        notas.map((nota) => {
                            const esValidada = nota.validado_por_user_id !== null;

                            return (
                                <div key={nota.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-black tracking-tight border border-slate-200">
                                            #{nota.id}
                                        </span>

                                        {/* Departamento */}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-wider border border-indigo-100">
                                            <Layers size={10} />
                                            {nota.departamento?.nombre || 'N/A'}
                                        </span>

                                        {/* Subdepartamento */}
                                        {nota.subdepartamento && (
                                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider border border-blue-100">
                                                {nota.subdepartamento.nombre}
                                            </span>
                                        )}

                                        {/* Fecha */}
                                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                            <Calendar size={12} />
                                            {new Date(nota.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} hrs
                                        </span>
                                    </div>

                                    {/* Descripción de la Nota y Botón Lateral */}
                                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-100">
                                        <p className="text-xs font-bold text-slate-700 uppercase tracking-tight whitespace-pre-line flex-1">
                                            {nota.descripcion}
                                        </p>

                                        {/* ACCIÓN DE VALIDACIÓN */}
                                        <div className="shrink-0 pt-2 sm:pt-0">
                                            {esValidada ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[10px] font-black uppercase tracking-tight">
                                                    <CheckCircle size={12} />
                                                    Validada
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => onValidar(nota.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-all"
                                                >
                                                    Validar Nota
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            No hay notas operacionales registradas
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
