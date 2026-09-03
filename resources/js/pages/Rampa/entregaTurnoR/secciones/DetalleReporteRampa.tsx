
import { X, Radio, Truck, Box, Zap, Layout, CheckCircle2, AlertCircle, Shield, UserCheck, Plane, Wrench } from 'lucide-react';

interface DetalleProps {
    data: any;
    onClose: () => void;
}

const DetalleReporteRampa: React.FC<DetalleProps> = ({ data, onClose }) => {
    if (!data) return null;

    const nombresVehiculos: Record<string, string> = {
        SUBURBANTC84: 'SUBURBAN TC-84',
        URBANEP16: 'URBAN EP-16'
    };

    const StatusBadge = ({ estado }: { estado: string }) => {
        const isOperativo = estado?.toLowerCase() === 'operativo' || estado?.toLowerCase() === 'bien';
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                isOperativo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
                {isOperativo ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                {estado || 'N/A'}
            </span>
        );
    };

    // Componente del Medidor de Combustible / Carga (Diseño SVG Tacómetro)
    const GaugeMeter = ({ value, label }: { value: number | string, label: string }) => {
        const numericValue = typeof value === 'number' ? value : parseInt(value) || 0;
        const percentage = Math.min(Math.max(numericValue, 0), 100);

        const radius = 50;
        const circumference = Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;
        const needleRotation = -90 + (percentage / 100) * 180;

        return (
            <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full max-w-[180px] mx-auto">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">{label}</span>

                <div className="relative w-32 h-16 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 120 60">
                        <path
                            d="M 10 60 A 50 50 0 0 1 110 60"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="10"
                            strokeLinecap="round"
                        />
                        {[0, 20, 40, 60, 80, 100].map((tick, i) => {
                            const angle = -180 + (tick / 100) * 180;
                            return (
                                <line
                                    key={i}
                                    x1="60" y1="60" x2="60" y2="52"
                                    stroke="#cbd5e1"
                                    strokeWidth="1"
                                    transform={`rotate(${angle} 60 60)`}
                                />
                            );
                        })}
                        <path
                            d="M 10 60 A 50 50 0 0 1 110 60"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            transform="rotate(180 60 60)"
                        />
                        <circle cx="60" cy="60" r="10" fill="#1e293b" />
                        <circle cx="60" cy="60" r="3" fill="#cbd5e1" />
                        <g transform={`rotate(${needleRotation} 60 60)`}>
                            <line x1="60" y1="60" x2="60" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                        </g>
                        <text x="12" y="55" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">E</text>
                        <text x="108" y="55" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">F</text>
                    </svg>
                </div>

                <div className="mt-2 px-3 py-0.5 bg-blue-50 text-blue-600 font-black text-xs rounded-full border border-blue-100">
                    {percentage}%
                </div>
            </div>
        );
    };

    // Fila de información rápida adaptativa
    const QuickCheckRow = ({ items }: { items: { label: string; val: string | number }[] }) => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {items.map((item, idx) => (
                <div key={idx} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.label}</span>
                    <span className="text-[11px] font-bold text-slate-700 truncate uppercase mt-0.5">{item.val !== undefined && item.val !== null ? item.val : '---'}</span>
                </div>
            ))}
        </div>
    );

    const herramientas = data.barras_remolque || {};
    const gpuData = data.gpus || {};
    const aeronavesData = data.aeronaves || {};
    const carritoGolfData = data.carrito_golf?.["005"] || {};

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-6xl bg-[#f8fafc] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-white">

                {/* Header Estilo Glassmorphism */}
                <div className="px-10 py-8 border-b border-slate-200 flex justify-between items-center bg-white/80 sticky top-0 z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <Plane size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Reporte Operativo</h2>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">ID: #{data.id}</span>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{data.encabezado?.fecha}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-500 rounded-2xl text-slate-400 transition-all active:scale-90">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-10 overflow-y-auto space-y-10 custom-scrollbar">

                    {/* Sección: Información de Turno */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { label: 'Entrega Turno', name: data.nombre_entrega, icon: UserCheck, color: 'text-blue-500' },
                            { label: 'Jefe de Rampa', name: data.encabezado?.jefeTurno, icon: Shield, color: 'text-indigo-600' },
                            { label: 'Recibe Turno', name: data.nombre_recibe, icon: UserCheck, color: 'text-emerald-500' }
                        ].map((item, i) => (
                            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center ${item.color}`}>
                                    <item.icon size={22} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                                    <p className="text-sm font-black text-slate-700 uppercase">{item.name || '---'}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Grid Principal: Flota de Vehículos */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-12 space-y-6">
                            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                                    <Truck className="text-indigo-600" size={22} />
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tight">Inspección de Flota de Vehículos</h3>
                                </div>

                                <div className="space-y-6">
                                    {Object.entries(data.vehiculos || {}).map(([key, val]: any) => {
                                        const idVehiculo = key.toUpperCase();
                                        const nombreVehiculo = nombresVehiculos[idVehiculo] ?? idVehiculo;
                                        const usaCamposNissan = ['NISSAN012', 'NISSAN015', 'SUBURBANTC84', 'URBANEP16'].includes(idVehiculo);
                                        const isTractor018 = idVehiculo === 'TRACTOR018';
                                        const isLektro = idVehiculo.includes('LEKTRO');
                                        const isAguasNegras = idVehiculo.includes('AGUASNEGRAS');
                                        const isAguaPotable = idVehiculo.includes('AGUAPOTABLE');
                                        const showVisualGauge = usaCamposNissan || isTractor018;
                                        const nivelTexto = `${val.nivelCombustible || val.nivelCarga || val.nivel || 0}%`;

                                        return (
                                            <div key={key} className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-start justify-between">
                                                <div className="flex-1 space-y-4 w-full">
                                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="px-3 py-1 bg-slate-900 text-white font-black text-sm rounded-xl tracking-wide">
                                                                {nombreVehiculo}
                                                            </div>
                                                            {val.kilometraje && (
                                                                <span className="text-xs font-mono font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">
                                                                    KM: {val.kilometraje}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <StatusBadge estado={val.estado} />
                                                    </div>

                                                    {usaCamposNissan && (
                                                        <QuickCheckRow items={[
                                                            { label: 'Limpieza', val: val.limpieza },
                                                            { label: 'Llantas', val: val.llantas },
                                                            { label: 'Frenos', val: val.frenos },
                                                            { label: 'Luces', val: val.luces }
                                                        ]} />
                                                    )}

                                                    {isTractor018 && (
                                                        <QuickCheckRow items={[
                                                            { label: 'Limpieza', val: val.limpieza },
                                                            { label: 'Llantas', val: val.llantas },
                                                            { label: 'Frenos', val: val.frenos },
                                                            { label: 'Luces', val: val.luces }
                                                        ]} />
                                                    )}

                                                    {isLektro && (
                                                        <QuickCheckRow items={[
                                                            { label: 'Limpieza', val: val.limpieza },
                                                            { label: 'Llantas', val: val.llantas },
                                                            { label: 'Frenos', val: val.frenos },
                                                            { label: 'Luces', val: val.luces },
                                                            { label: 'Nivel de Carga', val: nivelTexto }
                                                        ]} />
                                                    )}

                                                    {isAguasNegras && (
                                                        <QuickCheckRow items={[
                                                            { label: 'Limpieza', val: val.limpieza },
                                                            { label: 'Llantas', val: val.llantas }
                                                        ]} />
                                                    )}

                                                    {isAguaPotable && (
                                                        <div className="space-y-3">
                                                            <QuickCheckRow items={[
                                                                { label: 'Limpieza', val: val.limpieza },
                                                                { label: 'Llantas', val: val.llantas }
                                                            ]} />
                                                            <div className="space-y-2">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">
                                                                    Registro de Suministro de Agua
                                                                </span>
                                                                {val.suministros && val.suministros.length > 0 ? (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                        {val.suministros.map((suministro: any, idx: number) => (
                                                                            <div key={idx} className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 flex items-center justify-between">
                                                                                <p className="text-xs font-bold text-amber-950">
                                                                                    Matrícula: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">{suministro.matricula || 'N/A'}</span>
                                                                                </p>
                                                                                <p className="text-xs font-bold text-amber-950">
                                                                                    Cantidad: <span className="text-sm font-black text-indigo-600">{suministro.cantidad || '0'} Lts</span>
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 p-3 rounded-xl text-center uppercase">
                                                                        Sin suministros registrados en este turno
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="pt-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Observaciones</span>
                                                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                                                            {val.observaciones || val.obs || 'Sin novedades u observaciones registradas.'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {showVisualGauge && (
                                                    <div className="w-full md:w-auto flex justify-center items-center md:self-center pt-2 md:pt-0">
                                                        <GaugeMeter value={val.nivelCombustible || val.nivel || 0} label="Combustible" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN: HERRAMIENTAS DE APOYO Y GPUS EN TONOS CLAROS */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Bloque Izquierdo: Herramientas de Apoyo (Col 5) */}
                        <div className="lg:col-span-5 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                                    <Wrench className="text-indigo-600" size={20} />
                                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">Herramientas de Apoyo</h3>
                                </div>

                                <div className="space-y-4">
                                    {/* Barras de Remolque */}
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs font-black text-slate-800 uppercase">Barras de Remolque</h4>
                                            <span className="text-[10px] font-mono font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">Total: {herramientas.total || 0}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[8px] font-black text-slate-400 uppercase block">Limpieza</span>
                                                <span className="text-[11px] font-bold text-slate-700 uppercase">{herramientas.limpieza || '---'}</span>
                                            </div>
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[8px] font-black text-slate-400 uppercase block">Físico</span>
                                                <span className="text-[11px] font-bold text-slate-700 uppercase">{herramientas.estado || '---'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cabezales */}
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs font-black text-slate-800 uppercase">Cabezales</h4>
                                            <span className="text-[10px] font-mono font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">Cant: {herramientas.cabezales || 0}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-black text-slate-400 uppercase block">Estado</span>
                                            <span className="text-[11px] font-bold text-slate-700 uppercase">{herramientas.cabezalesEstado || '---'}</span>
                                        </div>
                                    </div>

                                    {/* Escaleras */}
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs font-black text-slate-800 uppercase">Escaleras</h4>
                                            <span className="text-[10px] font-mono font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">Cant: {herramientas.escalerasCantidad || 0}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-black text-slate-400 uppercase block">Estado</span>
                                            <span className="text-[11px] font-bold text-slate-700 uppercase">{herramientas.escalerasEstado || '---'}</span>
                                        </div>
                                    </div>

                                    {/* Remolque de Equipaje */}
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <h4 className="text-xs font-black text-slate-800 uppercase mb-2">Remolque de Equipaje</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[8px] font-black text-slate-400 uppercase block">Higiene</span>
                                                <span className="text-[11px] font-bold text-slate-700 uppercase">{herramientas.hamburgueseraLimpieza || '---'}</span>
                                            </div>
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[8px] font-black text-slate-400 uppercase block">Neumáticos</span>
                                                <span className="text-[11px] font-bold text-slate-700 uppercase">{herramientas.hamburgueseraLlantas || '---'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Módulo de Comunicaciones */}
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <Radio className="text-indigo-600" size={16} />
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Módulo de Comunicaciones</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-center border border-slate-100">
                                        <p className="text-sm font-black text-slate-800">{data.comunicaciones?.vhfOperativos}/{data.comunicaciones?.radiosVHF}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Radios VHF</p>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-center border border-slate-100">
                                        <p className="text-sm font-black text-slate-800">{data.comunicaciones?.uhfOperativos}/{data.comunicaciones?.radiosUHF}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Radios UHF</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloque Derecho: Inspección de GPUs (Todo Blanco / Light) */}
                        <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                                    <Zap className="text-indigo-600" size={20} />
                                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">Unidades de Potencia (GPUs)</h3>
                                </div>

                                <div className="space-y-4">
                                    {/* 1. GPU115 */}
                                    {gpuData.gpu115 && (
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg">GPU 115</span>
                                                <span className="text-xs font-mono font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-xl border border-indigo-100">Horómetro: {gpuData.gpu115.horometro || 0} hrs</span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Limpia</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.gpu115.limpia || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Enchufe</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.gpu115.enchufe || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Cableado</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.gpu115.cableado || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Llantas</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.gpu115.llantas || '---'}</span></div>
                                            </div>
                                            {gpuData.gpu115.obs && (
                                                <p className="text-[11px] text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-100 italic">Obs: {gpuData.gpu115.obs}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* 2. HOBART600 */}
                                    {gpuData.hobart600 && (
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg">HOBART 600</span>
                                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-100">Nº Plantas: {gpuData.hobart600.numPlantas || '0'}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Limpia</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.hobart600.limpia || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Enchufe</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.hobart600.enchufe || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Llantas</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.hobart600.llantas || '---'}</span></div>
                                            </div>
                                            {gpuData.hobart600.obs && (
                                                <p className="text-[11px] text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-100 italic">Obs: {gpuData.hobart600.obs}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. FOXTRONICS */}
                                    {gpuData.foxtronics && (
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg">FOXTRONICS</span>
                                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-100">Nº Plantas: {gpuData.foxtronics.numPlantas || '0'}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Limpia</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.foxtronics.limpia || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Enchufe</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.foxtronics.enchufe || '---'}</span></div>
                                                <div className="bg-white p-2 rounded-xl text-center border border-slate-100"><span className="text-[8px] text-slate-400 uppercase block font-black">Llantas</span><span className="text-xs font-bold text-slate-700 uppercase">{gpuData.foxtronics.llantas || '---'}</span></div>
                                            </div>
                                            {gpuData.foxtronics.obs && (
                                                <p className="text-[11px] text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-100 italic">Obs: {gpuData.foxtronics.obs}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* NUEVA SECCIÓN: CONTROL DE AERONAVES Y CARRITO DE GOLF (Light Mode) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Bloque Izquierdo: Inventario de Aeronaves (Col 5) */}
                        <div className="lg:col-span-5 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                                    <Plane className="text-indigo-600" size={20} />
                                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">Control e Inventario de Aeronaves</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-xl font-black text-slate-800">{aeronavesData.hangar1 || '0'}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Hangar 1</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-xl font-black text-slate-800">{aeronavesData.hangar2 || '0'}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Hangar 2</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-xl font-black text-slate-800">{aeronavesData.plataforma_h1 || '0'}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Plataforma H1</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-xl font-black text-slate-800">{aeronavesData.plataforma_h2 || '0'}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Plataforma H2</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloque Derecho: Carrito de Golf GOLF-005 (Col 7) */}
                        <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Layout className="text-indigo-600" size={20} />
                                        <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">Carrito de Golf</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs rounded-xl tracking-wide">GOLF-005</span>
                                        <StatusBadge estado={carritoGolfData.estado} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                        <span className="text-[8px] text-slate-400 uppercase block font-black">Batería</span>
                                        <span className="text-xs font-black text-indigo-600">{carritoGolfData.carga || '0'}%</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                        <span className="text-[8px] text-slate-400 uppercase block font-black">Llantas</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.llantas || '---'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                        <span className="text-[8px] text-slate-400 uppercase block font-black">Luces</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.luces || '---'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                        <span className="text-[8px] text-slate-400 uppercase block font-black">Frenos</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.frenos || '---'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                                        <span className="text-[8px] text-slate-400 uppercase block font-black">Limpieza</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">{carritoGolfData.limpieza || '---'}</span>
                                    </div>
                                </div>

                                <div className="pt-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Observaciones Carrito</span>
                                    <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                                        {carritoGolfData.obs || 'Sin novedades u observaciones registradas.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Sección de Firmas Digitales */}
                    <div className="pt-8 border-t border-slate-200">
                        <h3 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Validación y Firmas Digitales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            {['quien_entrega', 'jefe_rampa', 'quien_recibe'].map((rol) => {
                                const firma = data.firmas?.find((f: any) => f.pivot.rol === rol);
                                return (
                                    <div key={rol} className="flex flex-col items-center">
                                        <div className="h-24 w-full flex items-center justify-center mb-4 grayscale hover:grayscale-0 transition-all">
                                            {firma ? (
                                                <img src={`/storage/${firma.path}`} alt={rol} className="max-h-full object-contain" />
                                            ) : (
                                                <div className="text-slate-300 font-black text-[10px] border-2 border-dashed border-slate-100 w-full h-full flex items-center justify-center rounded-2xl">
                                                    PENDIENTE
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-full h-[2px] bg-slate-200 mb-2"></div>
                                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">
                                            {rol.replace('_', ' ')}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Minimalista */}
                <div className="px-10 py-6 bg-white border-t border-slate-100 flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EOLO PLUS - Sistema de Gestión de Rampa</p>
                    <div className="flex gap-2">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[9px] font-black text-slate-600 uppercase">Sincronizado</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetalleReporteRampa;
