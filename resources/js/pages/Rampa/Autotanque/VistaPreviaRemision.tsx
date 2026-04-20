interface Props {
    data: any;
}

export default function VistaPreviaRemision({ data }: Props) {
    if (!data) return null;

    return (
        <div className="bg-white p-1 space-y-6 animate-in zoom-in-95 duration-500">
            {/* Header Estilo Badge */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                    <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest">
                        Documento Oficial
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-slate-900 tracking-tighter uppercase">
                        Remisión <span className="text-indigo-600">#{data.folio?.split('-')[1]}</span>
                    </h2>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Emisión</p>
                    <p className="text-sm font-black text-slate-900">{data.fecha}</p>
                </div>
            </div>

            {/* Grid Principal: Cliente y Operación */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <section>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Información del Cliente</p>
                        <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-indigo-500">
                            <p className="text-base font-black text-slate-800 uppercase leading-none">{data.cliente}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">{data.tipo_cliente} • {data.forma_pago}</p>
                        </div>
                    </section>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Matrícula / Equipo</p>
                            <p className="text-sm font-black text-slate-800 uppercase">{data.matricula} <span className="text-slate-300 mx-1">|</span> {data.aeronave_tipo}</p>
                        </div>
                        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Unidad / Producto</p>
                            <p className="text-sm font-black text-slate-800 uppercase">{data.unidad.split('·')[1]} <span className="text-slate-300 mx-1">|</span> {data.producto}</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar de Tiempos */}
                <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2">Registro de Tiempo</p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400">LLEGADA DE AUTOTANQUE</span>
                            <span className="text-xs font-black">{data.hora_llegada}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400">INICIO DE CARGA</span>
                            <span className="text-xs font-black">{data.hora_inicial?.substring(0, 5)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400">FINAL DE CARGA</span>
                            <span className="text-xs font-black">{data.hora_final}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl border border-slate-300 p-6">
                <div className="absolute top-0 right-0 p-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    <div className="text-center md:text-left">
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Total Suministrados</p>
                        <div className="flex items-baseline justify-center md:justify-start gap-1">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">
                                {Number(data.total_litros).toLocaleString('en-US', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                })}
                            </span>
                            <span className="text-sm font-bold text-slate-500 uppercase">Lts</span>
                        </div>
                    </div>
                    <div className="space-y-3 md:col-span-2">
                        <div className="flex justify-between items-end border-b border-slate-300 pb-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Lectura Inicial</span>
                            <span className="font-mono font-bold text-slate-700">
                                {Number(data.lectura_inicial).toLocaleString('en-US', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                })}
                            </span>
                        </div>
                        <div className="flex justify-between items-end border-b border-slate-300 pb-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Lectura Final</span>
                            <span className="font-mono font-bold text-slate-700">
                                {Number(data.lectura_final).toLocaleString('en-US', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer: Operador y Firmas */}
            <div className="pt-4">
                <div className="flex items-center gap-2 mb-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable:</p>
                    <p className="text-[10px] font-black text-slate-800 uppercase bg-slate-100 px-2 py-1 rounded">{data.operador}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {data.firmas?.map((firma: any) => (
                        <div key={firma.id} className="space-y-3">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-slate-200 to-slate-100 rounded-xl blur opacity-25"></div>
                                <div className="relative h-32 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-4">
                                    <img
                                        src={`/storage/${firma.path}`}
                                        alt={firma.pivot.tag}
                                        className="max-h-full w-auto object-contain mix-blend-multiply multiply-125"
                                    />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-slate-800 uppercase leading-none">{firma.pivot.tag}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{firma.pivot.rol}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
