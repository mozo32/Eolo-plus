import React from 'react';
import { Plane, Calendar, BriefcaseBusiness, X, CheckCircle2, Clock } from 'lucide-react';

interface DetalleOperacionProps {
    datos: any;
    moduloNombre?: string;
    alCerrar: () => void;
}

export const DetalleOperacion = ({ datos, moduloNombre, alCerrar }: DetalleOperacionProps) => {
    const esLlegada = datos.tipo === 'llegada';
    const totalPasos = 4;
    const validaciones = datos.validaciones || [];
    const estaFinalizado = validaciones.length >= totalPasos;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl animate-in fade-in zoom-in duration-300">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${esLlegada ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {datos.tipo} #{datos.id}
                        </span>
                        <h2 className="text-xl font-black text-slate-800 mt-1 uppercase tracking-tight">Resumen de Operación</h2>
                    </div>
                    <button
                        onClick={alCerrar}
                        className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <span>Línea de Validación por Departamento</span>
                        <span className={`flex items-center gap-1 ${estaFinalizado ? "text-green-600" : "text-blue-600"}`}>
                            {estaFinalizado ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {estaFinalizado ? "PROCESO COMPLETADO" : `PASO ${validaciones.length} DE ${totalPasos}`}
                        </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {[...Array(totalPasos)].map((_, i) => {
                            const deptoValidado = validaciones[i];
                            const isActivo = !!deptoValidado;

                            return (
                                <div key={i} className="space-y-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${isActivo
                                                ? (estaFinalizado ? 'bg-green-500' : 'bg-blue-500')
                                                : 'bg-slate-200'
                                            }`}
                                    />
                                    <span className={`block text-[9px] font-black uppercase truncate text-center ${isActivo ? 'text-slate-700' : 'text-slate-300'
                                        }`}>
                                        {deptoValidado || "Pendiente"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                    <SectionTitle icon={<Plane size={16} />} title="Aeronave" />
                    <Dato Etiqueta="Matrícula" Valor={datos.matricula} Highlight />
                    <Dato Etiqueta="Equipo" Valor={datos.equipo} />
                    <Dato Etiqueta="Tipo de movimiento" Valor={datos.impulso} />
                </div>

                <div className="md:col-span-2 space-y-4">
                    <SectionTitle icon={<Calendar size={16} />} title="Detalles de Vuelo" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-4">
                            <Dato Etiqueta="Hora" Valor={datos.hora?.substring(0, 5)} Highlight />
                            <Dato Etiqueta={esLlegada ? "Procedencia" : "Destino"} Valor={datos.lugar} />
                            <Dato Etiqueta="Responsable" Valor={datos.nombre} />
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Dato Etiqueta="Equipaje" Valor={datos.equipaje} />
                                <Dato Etiqueta="Pax" Valor={datos.pax} Highlight />
                            </div>
                            <Dato Etiqueta="Tipo de cliente" Valor={datos.tipo_cliente} />
                            <Dato Etiqueta="Tipo de Operación" Valor={datos.tipo_operacion} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Observaciones</span>
                        <p className="text-sm text-slate-600 italic leading-relaxed">
                            {datos.observaciones || "Sin observaciones registradas."}
                        </p>
                    </div>
                    <div className="text-right space-y-1">
                        {/* <p className="text-[10px] text-slate-400 font-medium">
                            Registrado el {new Date(datos.fecha).toLocaleDateString()} a las {datos.hora?.substring(0, 5)}
                        </p> */}
                        <p className="text-xs text-slate-500 font-bold">
                            Usuario: <span className="text-slate-700">{datos.user?.name}</span>
                        </p>
                        <span className="inline-block text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                            Departamento: {datos.departamento}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SectionTitle = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-500">
        {icon}
        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">{title}</span>
    </div>
);

const Dato = ({ Etiqueta, Valor, Highlight = false }: { Etiqueta: string, Valor: any, Highlight?: boolean }) => (
    <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-tight">{Etiqueta}</span>
        <span className={`${Highlight ? 'text-lg font-black text-slate-900' : 'text-sm font-semibold text-slate-600'}`}>
            {Valor || <span className="text-slate-300 font-normal italic">---</span>}
        </span>
    </div>
);
