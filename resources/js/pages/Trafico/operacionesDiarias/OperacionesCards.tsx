import { DetalleOperacion } from './DetalleOperacion';
import React, { useState, useEffect } from 'react';
import { FormLlegada } from './FormLlegada';
import { FormSalida } from './FormSalida';
import { Filter, Calendar, ArrowDownLeft, ArrowUpRight, X, ChevronDown, Info, Download } from 'lucide-react';
import { obtenerOperacionesDiariasApi, excelOperacionesDiariasApi, obtenerPendientesApi } from '@/stores/apiOperacionesDiarias';
import { exportarOperacionesAExcel } from './excelService';
import Swal from 'sweetalert2';
import MatriculasPendientes from './MatriculasPendientes';

interface OperacionesCardsProps {
    moduloNombre?: string;
    nombreRol?: string;
}

const OperacionesCards = ({ moduloNombre, nombreRol }: OperacionesCardsProps) => {
    const [registros, setRegistros] = useState<any[]>([]);
    const [datosExcel, setDatosExcel] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stripExpandida, setStripExpandida] = useState<number | null>(null);
    const [creando, setCreando] = useState<'llegada' | 'salida' | null>(null);
    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [mostrarLeyenda, setMostrarLeyenda] = useState(false);
    const [pendientes, setPendientes] = useState<any[]>([]);
    const [mostrarModal, setMostrarModal] = useState(false);
    const COLORES_DEPARTAMENTOS: Record<string, string> = {
        "Seguridad": "bg-blue-500",
        "Rampa": "bg-amber-500",
        "Trafico": "bg-pink-500",
        "Despacho": "bg-violet-500",
        "Fbo": "bg-slate-500"
    };

    const [filtros, setFiltros] = useState({
        buscar: '',
        tipo: '',
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia',
        equipo: '',
        lugar: '',
        tipo_operacion: '',
        pax: '',
        eqp: '',
        cliente: ''
    });

    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });

    useEffect(() => {
        if (mostrarModalFecha) {
            setFiltrosEdicion({ ...filtros });
        }
    }, [mostrarModalFecha, filtros]);

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
    };

    const cargarPendientes = async () => {
        const identificadorConsulta = (nombreRol?.toUpperCase() === 'FBO' ? 'FBO' : moduloNombre) || '';

        if (!identificadorConsulta) return;

        try {
            const data = await obtenerPendientesApi(identificadorConsulta);
            setPendientes(data);
        } catch (error) {
            console.error("Error al cargar pendientes:", error);
        }
    };
    useEffect(() => {
        if (moduloNombre || nombreRol) {
            cargarPendientes();
            const interval = setInterval(cargarPendientes, 120000);
            return () => clearInterval(interval);
        }
    }, [moduloNombre, nombreRol]);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const data = await obtenerOperacionesDiariasApi({ ...filtros, page: pagina });
            setRegistros(data.data || []);
            setMeta(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    const cargarExcel = async () => {
        try {
            const data = await excelOperacionesDiariasApi({ ...filtros });
            return Array.isArray(data) ? data : (data.data || []);
        } catch (error) {
            console.error("Error al obtener datos para Excel:", error);
            throw error;
        }
    };
    const handleExportarExcel = async () => {
        Swal.fire({
            title: 'Generando Excel',
            text: 'Estamos recopilando todos los registros, por favor espere...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const datosParaExcel = await cargarExcel();

            if (datosParaExcel.length === 0) {
                Swal.fire('Atención', 'No hay registros para exportar con los filtros seleccionados.', 'warning');
                return;
            }
            await exportarOperacionesAExcel(datosParaExcel);
            Swal.fire({
                icon: 'success',
                title: '¡Descarga lista!',
                text: 'El reporte se ha generado correctamente.',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al generar el archivo. Intente de nuevo.'
            });
        }
    };
    useEffect(() => {
        cargarDatos();
    }, [pagina, filtros]);

    const cerrarModal = (recargar = false) => {
        setCreando(null);
        if (recargar) cargarDatos();
    };

    const toggleStrip = (id: number) => {
        setStripExpandida(stripExpandida === id ? null : id);
    };

    const limpiarFiltros = () => {
        setFiltros({
            buscar: '',
            tipo: '',
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia',
            equipo: '',
            lugar: '',
            tipo_operacion: '',
            pax: '',
            eqp: '',
            cliente: ''
        });
    };

    useEffect(() => {
        setPagina(1);
    }, [filtros]);

    return (
        <div className="bg-[#f3f4f6] min-h-screen p-4 font-sans text-slate-900 relative">
            {creando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => cerrarModal(false)}></div>
                    <div className="relative z-10 w-full max-w-lg">
                        {creando === 'llegada' ? (
                            <FormLlegada nombreRol={nombreRol} moduloNombre={moduloNombre} alCerrar={() => cerrarModal(true)} />
                        ) : (
                            <FormSalida nombreRol={nombreRol} moduloNombre={moduloNombre} alCerrar={() => cerrarModal(true)} />
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-8xl mx-auto mb-4 flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Panel Operativo</h1>
                    <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200">{moduloNombre}</span>

                    <div className="relative border-l border-slate-200 pl-4">
                        <button
                            onClick={() => setMostrarLeyenda(!mostrarLeyenda)}
                            className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Ver leyenda de colores"
                        >
                            <Info size={18} />
                            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-tight">Estatus</span>
                        </button>

                        {mostrarLeyenda && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setMostrarLeyenda(false)}></div>

                                <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-3 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="flex flex-col gap-2.5">
                                        {Object.entries(COLORES_DEPARTAMENTOS).map(([nombre, color]) => (
                                            <div key={nombre} className="flex items-center gap-2">
                                                <span className={`w-3 h-3 rounded-full shadow-sm shrink-0 ${color}`}></span>
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{nombre}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3 p-4">
                        {pendientes.length > 0 && (
                            <button
                                onClick={() => setMostrarModal(true)}
                                className="relative flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-all animate-pulse"
                            >
                                <span className="flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                <span className="font-bold text-sm">
                                    PENDIENTES ({pendientes.length})
                                </span>
                            </button>
                        )}
                        {mostrarModal && (
                        <MatriculasPendientes
                            listado={pendientes}
                            onClose={() => setMostrarModal(false)}
                            nombreRol={nombreRol}
                            moduloNombre={moduloNombre}
                            onActualizar={() => {
                                cargarPendientes();
                                cargarDatos();
                            }}
                        />
                    )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setMostrarFiltros(!mostrarFiltros)}
                        className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${mostrarFiltros ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <Filter size={14} />
                        <span className="hidden xs:inline">{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                    </button>
                    {(nombreRol === 'FBO' || nombreRol === 'Administrador') && (
                        <>
                            <div className="w-[1px] bg-slate-200 mx-1"></div>
                            <button
                                onClick={handleExportarExcel}
                                disabled={loading}
                                className="flex items-center gap-2 bg-white text-slate-600 text-[10px] font-black px-3 py-2 rounded border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50"
                                title="Descargar Excel"
                            >
                                <Download size={14} className="text-green-600" />
                                <span className="hidden md:inline">EXCEL</span>
                            </button>
                        </>
                    )}
                    <div className="w-[1px] bg-slate-200 mx-1"></div>
                    <button onClick={() => setCreando('llegada')} className="bg-emerald-600 text-white text-[10px] font-black px-3 py-2 rounded shadow-md hover:bg-emerald-700 transition-all active:scale-95 uppercase tracking-wider">
                        + <span className="hidden sm:inline">LLEGADA</span>
                    </button>
                    <button onClick={() => setCreando('salida')} className="bg-red-500 text-white text-[10px] font-black px-3 py-2 rounded shadow-md hover:bg-red-600 transition-all active:scale-95 uppercase tracking-wider">
                        + <span className="hidden sm:inline">SALIDA</span>
                    </button>
                </div>
            </div>

            <div className="max-w-8xl mx-auto">
                <div className="overflow-x-auto pb-4 custom-scrollbar">
                    <div className="min-w-[1100px]">
                        <div className="grid grid-cols-12 px-4 py-3 bg-white rounded-t-lg border-x border-t border-slate-200 shadow-sm items-center">
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">ID</div>
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">Tipo</div>
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">Matrícula/Equipo</div>
                            <div className="col-span-2 text-center text-[9px] font-black text-slate-400 uppercase">Fecha/Hora</div>
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">Origen/Destino</div>
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">Tipo de Operación</div>
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">Pax</div>
                            <div className="col-span-1 text-center text-[9px] font-black text-slate-400 uppercase">Equipaje</div>
                            <div className="col-span-2 text-center text-[9px] font-black text-slate-400 uppercase">Tipo de Cliente</div>
                            <div className="col-span-1 text-right text-[9px] font-black text-slate-400 uppercase">Val.</div>
                        </div>

                        <div className={`grid grid-cols-12 px-4 bg-slate-50 border-x border-b border-slate-200 overflow-hidden transition-all duration-300 ease-in-out ${mostrarFiltros ? 'max-h-20 py-3 opacity-100' : 'max-h-0 py-0 opacity-0 border-none'}`}>
                            <div className="col-span-1 flex justify-center items-center">
                                <button onClick={limpiarFiltros} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="col-span-1 px-1">
                                <select
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 shadow-sm"
                                    value={filtros.tipo}
                                    onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                                >
                                    <option value="">TODOS</option>
                                    <option value="llegada">LLEGADA</option>
                                    <option value="salida">SALIDA</option>
                                </select>
                            </div>
                            <div className="col-span-1 px-1">
                                <input
                                    type="text" placeholder="Mat..."
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400"
                                    value={filtros.buscar}
                                    onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="col-span-2 px-1">
                                <button
                                    onClick={() => setMostrarModalFecha(true)}
                                    className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm"
                                >
                                    <div className="flex items-center gap-1 overflow-hidden">
                                        <Calendar size={12} className="text-blue-500 shrink-0" />
                                        <span className="truncate font-bold text-slate-600 uppercase">
                                            {filtros.periodo === 'dia' ? filtros.fechaInicio :
                                                filtros.periodo === 'rango' ? `${filtros.fechaInicio} / ${filtros.fechaFin}` :
                                                    `${filtros.periodo}`}
                                        </span>
                                    </div>
                                    <ChevronDown size={12} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="col-span-1 px-1">
                                <input
                                    type="text" placeholder="Lugar..."
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400"
                                    value={filtros.lugar}
                                    onChange={(e) => setFiltros({ ...filtros, lugar: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1 px-1">
                                <select
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 shadow-sm"
                                    value={filtros.tipo_operacion}
                                    onChange={(e) => setFiltros({ ...filtros, tipo_operacion: e.target.value })}
                                >
                                    <option value="">AMBOS</option>
                                    <option value="NACIONAL">NACIONAL</option>
                                    <option value="INTERNACIONAL">INTERNACIONAL</option>
                                </select>
                            </div>
                            <div className="col-span-1 px-1">
                                <input
                                    type="number" placeholder="0"
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 text-center"
                                    value={filtros.pax}
                                    onChange={(e) => setFiltros({ ...filtros, pax: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1 px-1">
                                <input
                                    type="number" placeholder="0"
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 text-center"
                                    value={filtros.eqp}
                                    onChange={(e) => setFiltros({ ...filtros, eqp: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 px-1">
                                <select
                                    className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400"
                                    value={filtros.cliente}
                                    onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
                                >
                                    <option value="">TODOS</option>
                                    <option value="TRÁNSITO">TRÁNSITO</option>
                                    <option value="GUARDA">GUARDA</option>
                                    <option value="AEROTAXI">AEROTAXI</option>
                                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                                    <option value="HANDLING">HANDLING</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-2 space-y-2">
                            {loading ? (
                                <div className="text-center py-10 text-slate-400 bg-white border border-slate-200 rounded-lg">Cargando...</div>
                            ) : (
                                registros.map((op, index) => {
                                    const indexDescendente = (meta?.total ?? registros.length) - ((pagina - 1) * (meta?.per_page ?? 100)) - index;
                                    const esLlegada = op.tipo === 'llegada';
                                    return (
                                        <div key={op.id} className={`transition-all duration-300 ${stripExpandida === op.id ? 'ring-2 ring-blue-500 my-4' : 'hover:bg-slate-50'}`}>
                                            <div
                                                onClick={() => toggleStrip(op.id)}
                                                className="grid grid-cols-12 items-center border border-slate-200 p-3 rounded-lg cursor-pointer shadow-sm bg-white"
                                            >
                                                <div className="col-span-1 text-center font-mono text-[10px] text-slate-400">
                                                    #{String(indexDescendente).padStart(2, '0')}
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${esLlegada ? 'bg-emerald-100/50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100/50 text-red-700 ring-1 ring-red-200'}`}>
                                                        {esLlegada ? <ArrowDownLeft size={14} strokeWidth={3} /> : <ArrowUpRight size={14} strokeWidth={3} />}
                                                        {esLlegada ? 'LLEGADA' : 'SALIDA'}
                                                    </div>
                                                </div>
                                                <div className="col-span-1 text-center flex flex-col">
                                                    <span className="font-black text-sm tracking-tighter uppercase">{op.matricula}</span>
                                                    <span className="text-[8px] text-slate-400 font-bold">{op.equipo}</span>
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <span className="text-[9px] font-bold text-slate-400 block lowercase first-letter:uppercase">{new Date(op.fecha).toLocaleDateString()}</span>
                                                    <span className="font-bold text-sm">{op.hora.substring(0, 5)}</span>
                                                </div>
                                                <div className="col-span-1 text-center">
                                                    <span className="text-[10px] font-bold bg-slate-50 px-2 py-1 rounded truncate block">{op.lugar}</span>
                                                </div>
                                                <div className="col-span-1 text-center">
                                                    <span className="text-[10px] font-medium text-slate-600 uppercase">{op.tipo_operacion || 'N/A'}</span>
                                                </div>
                                                <div className="col-span-1 text-center font-bold">{op.pax}</div>
                                                <div className="col-span-1 text-center font-bold text-slate-400">{op.equipaje || 0}</div>
                                                <div className="col-span-2 text-center text-[9px] font-bold uppercase text-slate-500">{op.tipo_cliente}</div>
                                                <div className="col-span-1 flex justify-end gap-1.5">
                                                    {op.validaciones?.map((v: string) => (
                                                        <span key={v} title={v} className={`w-3 h-3 rounded-full shadow-sm border border-white/50 ${COLORES_DEPARTAMENTOS[v] || 'bg-slate-300'}`}></span>
                                                    ))}
                                                </div>
                                            </div>
                                            {stripExpandida === op.id && (
                                                <div className="bg-slate-50 border-x border-b border-slate-200 rounded-b-lg p-6 shadow-inner animate-in slide-in-from-top-2 duration-200">
                                                    <div className="w-full mx-auto">
                                                        {nombreRol !== 'FBO' && op.validaciones?.includes(moduloNombre) ? (
                                                            <DetalleOperacion datos={op} moduloNombre={moduloNombre} alCerrar={() => setStripExpandida(null)} />
                                                        ) : (
                                                            esLlegada ? (
                                                                <FormLlegada nombreRol={nombreRol} moduloNombre={moduloNombre} alCerrar={() => { setStripExpandida(null); cargarDatos(); }} datosEdicion={op} />
                                                            ) : (
                                                                <FormSalida nombreRol={nombreRol} moduloNombre={moduloNombre} alCerrar={() => { setStripExpandida(null); cargarDatos(); }} datosEdicion={op} />
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between bg-white p-4 mt-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">
                            Mostrando {meta.from} - {meta.to} de {meta.total} registros
                        </div>
                        <div className="flex gap-1">
                            <button
                                disabled={pagina === 1}
                                onClick={() => setPagina(pagina - 1)}
                                className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ANTERIOR
                            </button>
                            <div className="flex items-center px-4 text-[10px] font-black text-blue-600 bg-blue-50 rounded border border-blue-100">
                                PÁGINA {meta.current_page} DE {meta.last_page}
                            </div>
                            <button
                                disabled={pagina === meta.last_page}
                                onClick={() => setPagina(pagina + 1)}
                                className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                SIGUIENTE
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {mostrarModalFecha && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMostrarModalFecha(false)}></div>
                    <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase text-slate-700">Período</h3>
                            <button onClick={() => setMostrarModalFecha(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {['dia', 'rango', 'mes', 'año'].map((modo) => (
                                    <button
                                        key={modo}
                                        onClick={() => setFiltrosEdicion({ ...filtrosEdicion, periodo: modo })}
                                        className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {modo}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-3">
                                {filtrosEdicion.periodo === 'dia' && (
                                    <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm"
                                        value={filtrosEdicion.fechaInicio}
                                        onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value, fechaFin: e.target.value })} />
                                )}
                                {filtrosEdicion.periodo === 'rango' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm"
                                            value={filtrosEdicion.fechaInicio}
                                            onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value })} />
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm"
                                            value={filtrosEdicion.fechaFin}
                                            onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaFin: e.target.value })} />
                                    </div>
                                )}
                                {filtrosEdicion.periodo === 'mes' && (
                                    <input type="month" className="w-full border border-slate-200 p-2 rounded-lg text-sm"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) return;
                                            const [y, m] = val.split('-');
                                            setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${y}-${m}-01`, fechaFin: `${y}-${m}-31` });
                                        }} />
                                )}
                                {filtrosEdicion.periodo === 'año' && (
                                    <input type="number" min="2020" max="2030" placeholder="Año"
                                        className="w-full border border-slate-200 p-2 rounded-lg text-sm"
                                        onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${e.target.value}-01-01`, fechaFin: `${e.target.value}-12-31` })} />
                                )}
                            </div>
                            <button
                                onClick={aplicarFiltroFecha}
                                className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperacionesCards;
