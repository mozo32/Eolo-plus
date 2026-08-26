import React, { useEffect, useState, useCallback } from 'react';
import { fetchWalkarounds, deleteWalkaround } from '@/stores/apiWalkaround';
import axios from 'axios';
import WalkAroundFirmaModal from '../components/walkAround/ItemTable/WalkAroundFirmaModal';
import WalkAroundPendientesPanel from '../components/walkAround/ItemTable/WalkAroundPendientesPanel';
import WalkAroundFormV2 from './steps/WalkAroundFormV2';
import WalkAroundPdfExporter from '../components/walkAround/ItemTable/WalkAroundPdfExporter';
import BitacoraModal from '@/pages/BitacoraModal';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import Swal from 'sweetalert2';
import {
    Search, Loader2, Plane, ChevronLeft,
    ChevronRight, ArrowUpRight,
    ArrowDownLeft, Plus, X, Filter, Edit2,
    Calendar, MapPin, Trash2, ChevronDown, Bell, History
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Walkaround' }];

type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
};

type PageProps = {
    auth: {
        user: AuthUser | null;
    };
};

interface PestanaWalkAround {
    id: number;
    titulo: string;
}

interface EstadoPestanasWalkAround {
    pestanas: PestanaWalkAround[];
    pestanaActiva: number | null;
}

const TablaWalkAround = () => {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const roleLabels: Record<string, string> = {
        admin: "Administrador",
        empleado: "Empleado",
        jefe_area: "Jefe de Área",
        fbo: "FBO",
    };

    const roleName = user?.roles.map((r) => roleLabels[r.slug] ?? r.nombre).join(", ") ?? "Sin Rol";

    const [pdfId, setPdfId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [pestanasWalkAround, setPestanasWalkAround] = useState<PestanaWalkAround[]>([]);
    const [pestanaWalkAroundActiva, setPestanaWalkAroundActiva] = useState<number | null>(null);
    const [clavePestanasCargada, setClavePestanasCargada] = useState<string | null>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [firmId, setFirmId] = useState<number | null>(null);
    const [firmOpen, setFirmOpen] = useState(false);
    const [mostrarBitacora, setMostrarBitacora] = useState(false);
    const [pendientes, setPendientes] = useState<any[]>([]);
    const [mostrarPanelPendientes, setMostrarPanelPendientes] = useState(false);

    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);

    const nombreRol = user?.roles?.[0]?.slug;
    const idUser = user?.id;
    const prefijoBorradoresWalkAround = `walkaround:borradores:${idUser ?? 'anonimo'}`;
    const claveBorradorPrincipal = `${prefijoBorradoresWalkAround}:nuevo`;
    const claveEstadoPestanas = `${prefijoBorradoresWalkAround}:pestanas`;

    const esAdminOFbo = nombreRol === 'admin' || nombreRol === 'fbo';
    const esJefe = nombreRol === 'jefe_area';
    const esEmpleado = nombreRol === 'empleado';
    const esAdministrtivo = nombreRol === 'admin2';

    const [filtros, setFiltros] = useState({
        q: '',
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia',
        movimiento: '',
        ubicacion: ''
    });

    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let pestanasGuardadas: PestanaWalkAround[] = [];
        let pestanaActivaGuardada: number | null = null;

        try {
            const contenidoGuardado = window.localStorage.getItem(claveEstadoPestanas);

            if (contenidoGuardado) {
                const estadoGuardado = JSON.parse(contenidoGuardado) as Partial<EstadoPestanasWalkAround>;

                pestanasGuardadas = Array.isArray(estadoGuardado.pestanas)
                    ? estadoGuardado.pestanas.filter(
                        pestana => Number.isInteger(pestana?.id) && pestana.id > 0 && typeof pestana?.titulo === 'string'
                    )
                    : [];

                pestanaActivaGuardada = pestanasGuardadas.some(
                    pestana => pestana.id === estadoGuardado.pestanaActiva
                )
                    ? estadoGuardado.pestanaActiva ?? null
                    : pestanasGuardadas[0]?.id ?? null;
            }

            if (pestanasGuardadas.length === 0 && window.localStorage.getItem(claveBorradorPrincipal)) {
                pestanasGuardadas = [{ id: 1, titulo: 'Walk Around 1' }];
                pestanaActivaGuardada = 1;
            }
        } catch (error) {
            console.error('No se pudieron restaurar las pestañas de Walk Around', error);
            window.localStorage.removeItem(claveEstadoPestanas);
        }

        setShowForm(false);
        setSelectedId(null);
        setPestanasWalkAround(pestanasGuardadas);
        setPestanaWalkAroundActiva(pestanaActivaGuardada);
        setClavePestanasCargada(claveEstadoPestanas);
    }, [claveBorradorPrincipal, claveEstadoPestanas]);

    useEffect(() => {
        if (typeof window === 'undefined' || clavePestanasCargada !== claveEstadoPestanas) return;

        if (pestanasWalkAround.length === 0) {
            window.localStorage.removeItem(claveEstadoPestanas);
            return;
        }

        const estadoPestanas: EstadoPestanasWalkAround = {
            pestanas: pestanasWalkAround,
            pestanaActiva: pestanaWalkAroundActiva
        };

        try {
            window.localStorage.setItem(claveEstadoPestanas, JSON.stringify(estadoPestanas));
        } catch (error) {
            console.error('No se pudieron guardar las pestañas de Walk Around', error);
        }
    }, [
        claveEstadoPestanas,
        clavePestanasCargada,
        pestanaWalkAroundActiva,
        pestanasWalkAround
    ]);

    useEffect(() => {
        if (mostrarModalFecha) setFiltrosEdicion({ ...filtros });
    }, [mostrarModalFecha, filtros]);

    const loadPendientes = useCallback(async () => {
        if (!nombreRol) return;

        try {
            const response = await axios.get('/api/walkarounds/pendientes-firmar', {
                params: {
                    rol: nombreRol
                }
            });
            setPendientes(response.data);

            if (response.data.length === 0) {
                setMostrarPanelPendientes(false);
            }
        } catch (error) {
            console.error("Error cargando pendientes de firma:", error);
        }
    }, [nombreRol]);

    const loadData = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = {
                q: filtros.q,
                start: filtros.fechaInicio,
                end: filtros.fechaFin,
                type: filtros.periodo,
                movimiento: filtros.movimiento,
                ubicacion: filtros.ubicacion,
                page,
                per_page: 20
            };
            const response = await fetchWalkarounds(params);
            setData(response.data);
            setMeta(response);
            setPagina(response.current_page);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [filtros]);

    useEffect(() => {
        loadPendientes();
    }, [loadPendientes]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!showForm) loadData(pagina);
        }, 300);
        return () => clearTimeout(timeout);
    }, [filtros, pagina, showForm, loadData]);

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
        setPagina(1);
    };

    const cambiarPeriodoFecha = (
        modo: 'dia' | 'rango' | 'mes' | 'año'
    ) => {
        setFiltrosEdicion((actual) => {
            const ahora = new Date();
            const anioActual = ahora.getFullYear();
            const numeroMesActual = ahora.getMonth() + 1;
            const mesActual = String(numeroMesActual).padStart(2, '0');

            if (modo === 'mes') {
                const ultimoDia = new Date(
                    anioActual,
                    numeroMesActual,
                    0
                ).getDate();

                return {
                    ...actual,
                    periodo: modo,
                    fechaInicio: `${anioActual}-${mesActual}-01`,
                    fechaFin: `${anioActual}-${mesActual}-${String(
                        ultimoDia
                    ).padStart(2, '0')}`
                };
            }

            if (modo === 'año') {
                return {
                    ...actual,
                    periodo: modo,
                    fechaInicio: `${anioActual}-01-01`,
                    fechaFin: `${anioActual}-12-31`
                };
            }

            return {
                ...actual,
                periodo: modo
            };
        });
    };

    const limpiarFiltros = () => {
        setFiltros({
            q: '',
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia',
            movimiento: '',
            ubicacion: ''
        });
    };

    const obtenerClaveBorradorWalkAround = (id: number) => {
        return id === 1
            ? claveBorradorPrincipal
            : `${prefijoBorradoresWalkAround}:nuevo:${id}`;
    };

    const eliminarBorradorWalkAround = (id: number) => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(obtenerClaveBorradorWalkAround(id));
    };

    const handleEdit = (id: number) => {
        setSelectedId(id);
        setShowForm(true);
    };

    const handleNew = () => {
        setSelectedId(null);

        if (pestanasWalkAround.length === 0) {
            const primeraPestana: PestanaWalkAround = {
                id: 1,
                titulo: 'Walk Around 1'
            };

            setPestanasWalkAround([primeraPestana]);
            setPestanaWalkAroundActiva(primeraPestana.id);
        } else if (!pestanasWalkAround.some(pestana => pestana.id === pestanaWalkAroundActiva)) {
            setPestanaWalkAroundActiva(pestanasWalkAround[0].id);
        }

        setShowForm(true);
    };

    const agregarPestanaWalkAround = () => {
        const siguienteId = pestanasWalkAround.reduce(
            (mayor, pestana) => Math.max(mayor, pestana.id),
            0
        ) + 1;
        const nuevaPestana: PestanaWalkAround = {
            id: siguienteId,
            titulo: `Walk Around ${siguienteId}`
        };

        setPestanasWalkAround(prev => [...prev, nuevaPestana]);
        setPestanaWalkAroundActiva(nuevaPestana.id);
    };

    const cerrarPestanaWalkAround = (id: number, recargar = false) => {
        const indiceActual = pestanasWalkAround.findIndex(pestana => pestana.id === id);
        const pestanasRestantes = pestanasWalkAround.filter(pestana => pestana.id !== id);

        eliminarBorradorWalkAround(id);

        if (recargar) {
            loadData(pagina);
            loadPendientes();
        }

        setPestanasWalkAround(pestanasRestantes);

        if (pestanasRestantes.length === 0) {
            setPestanaWalkAroundActiva(null);
            setShowForm(false);
            setSelectedId(null);
            return;
        }

        if (pestanaWalkAroundActiva === id) {
            const siguienteIndice = Math.min(indiceActual, pestanasRestantes.length - 1);
            setPestanaWalkAroundActiva(pestanasRestantes[siguienteIndice].id);
        }
    };

    const handleBack = () => {
        setShowForm(false);
        setSelectedId(null);
        loadData(pagina);
    };

    const handleSaved = () => {
        setShowForm(false);
        setSelectedId(null);
        loadData(pagina);
        loadPendientes();
    };

    const handleDelete = async (id: any) => {
        const r = await Swal.fire({
            icon: "warning",
            title: "¿Eliminar registro?",
            text: "Esta acción no se puede deshacer",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            confirmButtonText: "Eliminar",
            cancelButtonText: "Cancelar",
            reverseButtons: true
        });

        if (!r.isConfirmed) return;

        try {
            await deleteWalkaround(id);
            Swal.fire({ icon: "success", title: "Eliminado", timer: 1500, showConfirmButton: false });
            loadData(pagina);
            loadPendientes();
        } catch (error) {
            Swal.fire("Error", "No se pudo eliminar el registro", "error");
        }
    };

    const handleAbrirFirmaPendiente = (id: number) => {
        setFirmId(id);
        setFirmOpen(true);
        setMostrarPanelPendientes(false);
    };

    return (
        <>
            <div className="p-6 bg-[#f3f4f6] min-h-screen relative text-sm overflow-x-hidden">
                <div className="space-y-4 animate-in fade-in duration-500">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Walkaround</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inspección de Aeronaves</p>
                            </div>
                            {pendientes.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setMostrarPanelPendientes(true)}
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
                                </>

                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${mostrarFiltros ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Filter size={14} />
                                <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>

                            {!esAdministrtivo && (
                                <button
                                    onClick={handleNew}
                                    className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded shadow-md hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-wider"
                                >
                                    + NUEVO REGISTRO
                                </button>
                            )}
                            {[1, 44, 42, 15].includes(Number(idUser)) && (
                                <button
                                    type="button"
                                    onClick={() => setMostrarBitacora(true)}
                                    className="flex items-center gap-2 bg-slate-800 text-white text-[10px] font-black px-4 py-2 rounded shadow-md hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-wider"
                                >
                                    <History size={14} />
                                    BITÁCORA
                                </button>
                            )}

                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-10">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Matrícula/Equipo</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Tipo</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Origen / Destino</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha y Hora</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={`bg-slate-50 border-b border-slate-200 overflow-hidden transition-all duration-300 ${mostrarFiltros ? 'opacity-100' : 'hidden'}`}>
                                        <td className="px-2 py-2 text-center">
                                            <button onClick={limpiarFiltros} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                                <input
                                                    type="text"
                                                    placeholder="Matrícula..."
                                                    className="w-full pl-7 text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-indigo-400 uppercase"
                                                    value={filtros.q}
                                                    onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <select
                                                className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-indigo-400 uppercase"
                                                value={filtros.movimiento}
                                                onChange={(e) => setFiltros({ ...filtros, movimiento: e.target.value })}
                                            >
                                                <option value="">TODOS</option>
                                                <option value="entrada">ENTRADA</option>
                                                <option value="salida">SALIDA</option>
                                            </select>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="relative">
                                                <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                                <input
                                                    type="text"
                                                    placeholder="Lugar..."
                                                    className="w-full pl-7 text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-indigo-400 uppercase"
                                                    value={filtros.ubicacion}
                                                    onChange={(e) => setFiltros({ ...filtros, ubicacion: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => setMostrarModalFecha(true)} className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 shadow-sm transition-colors">
                                                <div className="flex items-center gap-1 overflow-hidden font-bold text-slate-600 uppercase">
                                                    <Calendar size={12} className="text-blue-500" />
                                                    {filtros.periodo === 'dia' ? filtros.fechaInicio : filtros.periodo.toUpperCase()}
                                                </div>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>
                                        <td></td>
                                    </tr>

                                    {loading ? (
                                        <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /></td></tr>
                                    ) : data.map((item: any, index: number) => {
                                        const nFila = (pagina - 1) * (meta?.per_page || 20) + (index + 1);
                                        return (
                                            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-4 text-center font-bold text-[10px] text-slate-400">{nFila}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                            <Plane size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-800 text-sm leading-none uppercase tracking-tighter">{item.matricula}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{item.tipo_aeronave}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${item.movimiento === 'entrada' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-100/50 text-red-700 ring-1 ring-red-200'}`}>
                                                        {item.movimiento === 'entrada' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                                        {item.movimiento}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center uppercase text-xs font-bold text-slate-700">
                                                    {item.movimiento === 'entrada' ? item.procedensia : item.destino}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[10px] font-bold text-slate-400 block">{new Date(item.fecha).toLocaleDateString()}</span>
                                                    <span className="text-sm font-black text-slate-700">{item.hora.substring(0, 5)}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {esAdminOFbo && (
                                                            <button onClick={() => handleEdit(item.id)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                                                <Edit2 size={16} />
                                                            </button>
                                                        )}
                                                        {(esAdminOFbo || esJefe || esEmpleado || esAdministrtivo) && (
                                                            <button onClick={() => handleAbrirFirmaPendiente(item.id)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Firmar">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                        {(esAdminOFbo || esAdministrtivo) && (
                                                            <button onClick={() => setPdfId(item.id)} className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]">
                                                                PDF
                                                            </button>
                                                        )}
                                                        {esAdminOFbo && (
                                                            <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-500 uppercase">PÁGINA {meta.current_page} DE {meta.last_page}</span>
                            <div className="flex gap-1">
                                <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">ANTERIOR</button>
                                <button disabled={pagina === meta.last_page} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">SIGUIENTE</button>
                            </div>
                        </div>
                    )}
                </div>

                {showForm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleBack}></div>
                        <div className="relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">{selectedId !== null ? 'Editar Walkaround' : 'Nuevos Walkaround'}</h3>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Inspección de seguridad de aeronave</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                                    aria-label="Cerrar y conservar borradores"
                                    title="Cerrar y conservar borradores"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {selectedId === null && (
                                <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 p-2">
                                    {pestanasWalkAround.map(pestana => {
                                        const estaActiva = pestanaWalkAroundActiva === pestana.id;

                                        return (
                                            <div
                                                key={pestana.id}
                                                className={`flex shrink-0 items-center rounded-lg border transition-colors ${estaActiva
                                                    ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm'
                                                    : 'border-transparent bg-slate-200/60 text-slate-500 hover:bg-white'
                                                    }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setPestanaWalkAroundActiva(pestana.id)}
                                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-wider"
                                                >
                                                    {pestana.titulo}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => cerrarPestanaWalkAround(pestana.id)}
                                                    className="mr-1 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                    aria-label={`Descartar ${pestana.titulo}`}
                                                    title={`Descartar ${pestana.titulo}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={agregarPestanaWalkAround}
                                        className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-indigo-400 bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-indigo-700 hover:bg-indigo-100"
                                    >
                                        <Plus size={12} />
                                        Otro Walk Around
                                    </button>
                                </nav>
                            )}

                            <div className="flex-1 overflow-y-auto p-6">
                                {selectedId !== null ? (
                                    <WalkAroundFormV2
                                        key={`edicion-${selectedId}`}
                                        id={selectedId}
                                        onCancel={handleBack}
                                        onSaved={handleSaved}
                                    />
                                ) : (
                                    pestanasWalkAround.map(pestana => (
                                        <div
                                            key={pestana.id}
                                            className={pestanaWalkAroundActiva === pestana.id ? 'block' : 'hidden'}
                                        >
                                            <WalkAroundFormV2
                                                id={null}
                                                onCancel={handleBack}
                                                onSaved={() => cerrarPestanaWalkAround(pestana.id, true)}
                                                borradorId={obtenerClaveBorradorWalkAround(pestana.id)}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
                                    {(['dia', 'rango', 'mes', 'año'] as const).map((modo) => (
                                        <button type="button" key={modo} onClick={() => cambiarPeriodoFecha(modo)} className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{modo}</button>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    {filtrosEdicion.periodo === 'dia' && (
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={filtrosEdicion.fechaInicio} onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value, fechaFin: e.target.value })} />
                                    )}
                                    {filtrosEdicion.periodo === 'rango' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={filtrosEdicion.fechaInicio} onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value })} />
                                            <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={filtrosEdicion.fechaFin} onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaFin: e.target.value })} />
                                        </div>
                                    )}
                                    {filtrosEdicion.periodo === 'mes' && (
                                        <input type="month" value={filtrosEdicion.fechaInicio.substring(0, 7)} className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => {
                                            const valor = e.target.value;

                                            if (!valor) {
                                                setFiltrosEdicion({
                                                    ...filtrosEdicion,
                                                    fechaInicio: '',
                                                    fechaFin: ''
                                                });
                                                return;
                                            }

                                            const [anioTexto, mesTexto] = valor.split('-');
                                            const anio = Number(anioTexto);
                                            const mes = Number(mesTexto);
                                            const ultimoDia = new Date(anio, mes, 0).getDate();

                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: `${valor}-01`,
                                                fechaFin: `${valor}-${String(ultimoDia).padStart(2, '0')}`
                                            });
                                        }} />
                                    )}
                                    {filtrosEdicion.periodo === 'año' && (
                                        <input type="number" min="2020" max="2100" value={filtrosEdicion.fechaInicio ? filtrosEdicion.fechaInicio.split('-')[0] : ''} placeholder="Año" className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => {
                                            const anio = e.target.value;

                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: anio ? `${anio}-01-01` : '',
                                                fechaFin: anio ? `${anio}-12-31` : ''
                                            });
                                        }} />
                                    )}
                                </div>
                                <button onClick={aplicarFiltroFecha} className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors">Aplicar Filtro</button>
                            </div>
                        </div>
                    </div>
                )}

                <WalkAroundPendientesPanel
                    open={mostrarPanelPendientes}
                    onClose={() => setMostrarPanelPendientes(false)}
                    pendientes={pendientes}
                    onFirmar={handleAbrirFirmaPendiente}
                />
            </div>

            <WalkAroundPdfExporter id={pdfId} onDone={() => setPdfId(null)} />

            <WalkAroundFirmaModal
                open={firmOpen}
                id={firmId}
                onClose={() => {
                    setFirmOpen(false);
                    setFirmId(null);
                    loadData(pagina);
                    loadPendientes();
                }}
            />
            <BitacoraModal
                open={mostrarBitacora}
                onClose={() => setMostrarBitacora(false)}
                modulo="WALKAROUND"
                titulo="Bitácora WalkAround"
            />
        </>
    );
};

export default TablaWalkAround;
