import PdfExporterRemision from './Autotanque/PdfExporterRemision';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import EoloForm from './Autotanque/EoloForm';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRemisionesDelDia, fetchRemisionById } from '@/stores/apiAutoTanque';
import { Plus, Mail, Calendar, X, Edit2, Filter, ChevronDown, Download, Eye, FolderCog } from "lucide-react";
import ModalEnviarCorreo from './Autotanque/ModalEnviarCorreo';
import ModalPrefactura from './Autotanque/ModalPrefactura';
import Swal from 'sweetalert2';
import { ExcelRemisiones } from './Autotanque/ExcelRemisiones';
import { excelRemisionesApi, consultaAsa } from '@/stores/apiRemision';
import VistaPreviaRemision from './Autotanque/VistaPreviaRemision';
import { useEchoPublic } from '@laravel/echo-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Remisiones' }];
interface Role {
    slug: string;
    nombre: string;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
}

interface PageProps {
    auth: {
        user: AuthUser | null;
    };
    [key: string]: any;
}
type FiltrosRemision = {
    buscar: string;
    matricula: string;
    cantidad: string;
    fechaInicio: string;
    fechaFin: string;
    periodo: string;
};
export default function Remision() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [prefacturaModalOpen, setPrefacturaModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [datosPreview, setDatosPreview] = useState<any>(null);
    const [datosCombustible, setDatosCombustible] = useState<any>(null);
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;

    const [filtros, setFiltros] = useState<FiltrosRemision>({
        buscar: '',
        matricula: '',
        cantidad: '',
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia'
    });

    const [filtrosEdicion, setFiltrosEdicion] = useState<FiltrosRemision>({ ...filtros });
    const [actualizacionPendiente, setActualizacionPendiente] = useState(false);
    const filtrosRef = useRef<FiltrosRemision>(filtros);
    const paginaRef = useRef<number>(pagina);
    const [sonidoActivo, setSonidoActivo] = useState(false);
    const sonidoActivoRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const ultimoSonidoRef = useRef(0);

    const reproducirSonidoNotificacion = useCallback(() => {
        if (!sonidoActivoRef.current) return;

        const ahora = Date.now();

        if (ahora - ultimoSonidoRef.current < 1500) return;

        ultimoSonidoRef.current = ahora;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

            if (!AudioContextClass) return;

            const audioContext = audioContextRef.current || new AudioContextClass();

            audioContextRef.current = audioContext;

            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => { });
                return;
            }

            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

            gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.36);
        } catch (error) {
            console.error(error);
        }
    }, []);

    const activarSonido = useCallback(async () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

            if (!AudioContextClass) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sonido no disponible',
                    text: 'Este navegador no permite reproducir notificaciones de audio.',
                    confirmButtonColor: '#4f46e5'
                });
                return;
            }

            const audioContext = audioContextRef.current || new AudioContextClass();

            audioContextRef.current = audioContext;

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            sonidoActivoRef.current = true;
            setSonidoActivo(true);

            reproducirSonidoNotificacion();
        } catch (error) {
            console.error(error);
        }
    }, [reproducirSonidoNotificacion]);

    useEffect(() => {
        filtrosRef.current = filtros;
    }, [filtros]);

    useEffect(() => {
        paginaRef.current = pagina;
    }, [pagina]);

    useEffect(() => {
        if (mostrarModalFecha) setFiltrosEdicion({ ...filtros });
    }, [mostrarModalFecha, filtros]);

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
        setPagina(1);
        setActualizacionPendiente(false);
    };

    const limpiarFiltros = () => {
        const filtrosLimpios = {
            buscar: '',
            matricula: '',
            cantidad: '',
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia'
        };

        setFiltros(filtrosLimpios);
        setFiltrosEdicion(filtrosLimpios);
        setPagina(1);
        setActualizacionPendiente(false);
    };

    const getXsrfToken = () => {
        return decodeURIComponent(
            document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || ''
        );
    };

    const handleSendEmail = async (email: string) => {
        const xsrf = getXsrfToken();
        Swal.fire({
            title: 'Enviando correo',
            text: 'Espere un momento...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        try {
            const response = await fetch('api/Remision/enviar-correo', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrf,
                },
                body: JSON.stringify({ id: selectedRow?.id, email: email })
            });
            if (!response.ok) throw new Error('Error');
            Swal.fire({ icon: 'success', title: '¡Enviado!', confirmButtonColor: '#4f46e5' });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', confirmButtonColor: '#ef4444' });
        }
    };
    const handleSendPrefactura = async (prefactura: string) => {
        const xsrf = getXsrfToken();
        Swal.fire({
            title: 'guardando',
            text: 'Espere un momento...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        try {
            const response = await fetch('api/Remision/vincularPrefactura', {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrf,
                },
                body: JSON.stringify({ id: selectedRow?.id, prefactura: prefactura })
            });
            if (!response.ok) throw new Error('Error');
            Swal.fire({ icon: 'success', title: '¡Enviado!', confirmButtonColor: '#4f46e5' });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', confirmButtonColor: '#ef4444' });
        }

    };

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    const cosultaCombustible = useCallback(async () => {
        try {
            const res = await consultaAsa();
            setDatosCombustible(res);
        } catch (error) {
            console.error(error);
        }
    }, []);

    const cargarDatos = useCallback(async (opciones?: {
        page?: number;
        filtrosActuales?: FiltrosRemision;
        silencioso?: boolean;
    }) => {
        const page = opciones?.page ?? paginaRef.current;
        const filtrosUsados = opciones?.filtrosActuales ?? filtrosRef.current;
        const silencioso = opciones?.silencioso ?? false;

        try {
            if (!silencioso) setLoading(true);

            const params = {
                page,
                type: filtrosUsados.periodo,
                start: filtrosUsados.fechaInicio,
                end: filtrosUsados.fechaFin,
                folio: filtrosUsados.buscar,
                matricula: filtrosUsados.matricula,
                cantidad: filtrosUsados.cantidad,
                vinculado: true
            };

            const res = await fetchRemisionesDelDia({
                params,
                page,
                per_page: 20
            });

            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            if (!silencioso) setLoading(false);
        }
    }, []);


    useEffect(() => {
        cargarDatos({
            page: pagina,
            filtrosActuales: filtros,
            silencioso: false
        });

        cosultaCombustible();
    }, [pagina, filtros, cargarDatos, cosultaCombustible]);

    useEchoPublic('remisiones', 'RemisionCreada', () => {
        const paginaActual = paginaRef.current;
        const filtrosActuales = filtrosRef.current;

        reproducirSonidoNotificacion();
        cosultaCombustible();

        if (paginaActual !== 1) {
            setActualizacionPendiente(true);
            return;
        }

        cargarDatos({
            page: paginaActual,
            filtrosActuales,
            silencioso: true
        });
    });

    const handleEdit = async (row: any) => {
        try {
            Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const datosCompletos = await fetchRemisionById(row.id);
            setDetalle(datosCompletos);
            setIsEdit(true);
            setOpenForm(true);
            Swal.close();
        } catch (error) {
            Swal.fire({ icon: 'warning', title: 'Error', text: 'No se pudo cargar.' });
        }
    };

    const handleEye = async (row: any) => {
        try {
            Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const datosCompletos = await fetchRemisionById(row.id);
            setDatosPreview(datosCompletos);
            setPreviewOpen(true);
            Swal.close();
        } catch (error) {
            Swal.fire({ icon: 'warning', title: 'Error', text: 'No se pudo cargar la vista previa.' });
        }
    };

    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setDetalle(null);
    };

    const cargarExcel = async () => {
        try {
            const data = await excelRemisionesApi({ ...filtros });
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
            didOpen: () => { Swal.showLoading(); }
        });
        try {
            const datosParaExcel = await cargarExcel();
            if (datosParaExcel.length === 0) {
                Swal.fire('Atención', 'No hay registros para exportar con los filtros seleccionados.', 'warning');
                return;
            }
            await ExcelRemisiones(datosParaExcel);
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Remisiones" />
            <div className="p-6 bg-[#f3f4f6] min-h-screen relative">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Remisiones</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gestión de Autotanques</p>
                        </div>

                        <div className="flex gap-2">
                            {datosCombustible && (
                                <div className="hidden lg:flex items-center gap-3 mr-4 px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">ASA</span>
                                        <span className="text-xs font-black text-indigo-600">
                                            {/* Forzamos el formato de México para que use la coma de miles en PC y Tablet */}
                                            {Number(datosCombustible.diferenciaFinal).toLocaleString('es-MX')} <small className="text-[8px]">LTS</small>
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="w-[1px] bg-slate-200 mx-1"></div>
                            {(user?.roles?.[0]?.slug === 'admin2' || user?.roles?.[0]?.slug === 'fbo' || user?.roles?.[0]?.slug === 'admin') && (
                                <button
                                    onClick={handleExportarExcel}
                                    disabled={loading}
                                    className="flex items-center gap-2 bg-white text-slate-600 text-[10px] font-black px-3 py-2 rounded border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50"
                                    title="Descargar Excel"
                                >
                                    <Download size={14} className="text-green-600" />
                                    <span className="hidden md:inline">EXCEL</span>
                                </button>
                            )}
                            <button
                                onClick={activarSonido}
                                className={`flex items-center gap-2 text-[10px] font-black px-3 py-2 rounded border transition-all ${sonidoActivo
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                title="Activar sonido de notificaciones"
                            >
                                {sonidoActivo ? 'SONIDO ACTIVO' : 'ACTIVAR SONIDO'}
                            </button>
                            <button
                                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${mostrarFiltros ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Filter size={14} />
                                <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>
                            {(user?.roles?.[0]?.slug !== 'admin2' && user?.roles?.[0]?.slug !== 'fac') && (
                                <button
                                    onClick={() => {
                                        setIsEdit(false);
                                        setDetalle(null);
                                        setOpenForm(true);
                                    }}
                                    className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded shadow-md hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-wider"
                                >
                                    + NUEVA REMISIÓN
                                </button>
                            )}

                        </div>
                    </div>
                    {actualizacionPendiente && (
                        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-800">
                            <span>Hay nuevas remisiones disponibles.</span>
                            <button
                                onClick={() => {
                                    setActualizacionPendiente(false);

                                    if (paginaRef.current !== 1) {
                                        setPagina(1);
                                        return;
                                    }

                                    cargarDatos({
                                        page: 1,
                                        filtrosActuales: filtrosRef.current,
                                        silencioso: false
                                    });
                                }}
                                className="rounded bg-amber-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-amber-700"
                            >
                                Actualizar
                            </button>
                        </div>
                    )}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-10">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Folio</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Matrícula / Destino</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha / Hora</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Cantidad</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={`bg-slate-50 border-b border-slate-200 overflow-hidden transition-all duration-300 ${mostrarFiltros ? 'opacity-100' : 'hidden'}`}>
                                        <td className="px-2 py-2"></td>
                                        <td className="px-2 py-2 text-center">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button onClick={limpiarFiltros} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                                <input type="text" placeholder="Folio..." className="w-24 text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400" value={filtros.buscar} onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })} />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="text" placeholder="Matrícula..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 uppercase" value={filtros.matricula} onChange={(e) => setFiltros({ ...filtros, matricula: e.target.value.toUpperCase() })} />
                                        </td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => setMostrarModalFecha(true)} className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Calendar size={12} className="text-blue-500 shrink-0" />
                                                    <span className="truncate font-bold text-slate-600 uppercase">
                                                        {filtros.periodo === 'dia' ? filtros.fechaInicio : filtros.periodo === 'rango' ? `${filtros.fechaInicio} / ${filtros.fechaFin}` : filtros.periodo.toUpperCase()}
                                                    </span>
                                                </div>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="number" placeholder="Lts..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 text-center" value={filtros.cantidad} onChange={(e) => setFiltros({ ...filtros, cantidad: e.target.value })} />
                                        </td>
                                        <td></td>
                                    </tr>
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase">Cargando datos...</td></tr>
                                    ) : data.map((row, index) => {
                                        const numeroFila = (pagina - 1) * (meta?.per_page || 20) + (index + 1);
                                        return (
                                            <tr key={`${row.id}-${index}`} className={`border-b border-slate-50 transition-colors ${row.id_turno ? 'bg-emerald-50/40 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'}`}>
                                                <td className="px-4 py-4 text-center font-bold text-[10px] text-slate-400">{numeroFila}</td>
                                                <td className="px-6 py-4 text-center font-black text-[10px] text-slate-700">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {row.folio || `#${row.id}`}
                                                        {row.id_turno && (
                                                            <span className="text-[7px] bg-emerald-600 text-white px-1 rounded-sm tracking-widest">VINCULADO</span>
                                                        )}
                                                        {Boolean(row.status_prefactura) && (
                                                            <span className="rounded-sm bg-indigo-600 px-1 text-[7px] tracking-widest text-white">
                                                                PREFACTURA
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">{row.matricula || 'N/A'}</span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{row.destino || 'S/D'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[10px] font-bold text-slate-400 block">{new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</span>
                                                    <span className="text-sm font-black text-slate-700">{row.hora_llegada?.substring(0, 5)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="font-mono text-sm font-black text-indigo-600">
                                                        {Number(row.litros || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} <small className="text-[9px] text-slate-400">LTS</small>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {row.tipo === 'R' && (
                                                            <>
                                                                {(user?.isAdmin || user?.roles?.[0]?.slug === 'fbo') && (
                                                                    <>
                                                                        <button onClick={() => handleEdit(row)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors uppercase font-black text-[10px]">
                                                                            PDF
                                                                        </button>
                                                                        <button onClick={() => { setSelectedRow(row); setEmailModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                                                                            <Mail size={16} />
                                                                        </button>
                                                                        {!Boolean(row.status_prefactura) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedRow(row);
                                                                                    setPrefacturaModalOpen(true);
                                                                                }}
                                                                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                                                                            >
                                                                                <FolderCog size={16} />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {user?.roles?.[0]?.slug === 'fac' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setPdfId(row.id)}
                                                                            className="p-2 text-slate-400 hover:text-amber-600 transition-colors uppercase font-black text-[10px]"
                                                                        >
                                                                            PDF
                                                                        </button>

                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedRow(row);
                                                                                setEmailModalOpen(true);
                                                                            }}
                                                                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                                                                        >
                                                                            <Mail size={16} />
                                                                        </button>

                                                                        {!Boolean(row.status_prefactura) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedRow(row);
                                                                                    setPrefacturaModalOpen(true);
                                                                                }}
                                                                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                                                                            >
                                                                                <FolderCog size={16} />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {user?.roles?.[0]?.slug === 'admin2' && (
                                                                    <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors uppercase font-black text-[10px]">
                                                                        PDF
                                                                    </button>
                                                                )}
                                                                <button onClick={() => handleEye(row)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                                                                    <Eye size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
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

                {openForm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleBack}></div>
                        <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">{isEdit ? 'Editar Remisión' : 'Nueva Remisión'}</h3>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Formulario de Suministro de Combustible</p>
                                </div>
                                <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X size={20} /></button>
                            </div>
                            <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                                <EoloForm data={detalle} isEdit={isEdit} onSuccess={() => { handleBack(); cargarDatos(); cosultaCombustible(); }} />
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
                                    {['dia', 'rango', 'mes', 'año'].map((modo) => (
                                        <button key={modo} onClick={() => setFiltrosEdicion({ ...filtrosEdicion, periodo: modo })} className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{modo}</button>
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
                                        <input type="month" className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => {
                                            const [y, m] = e.target.value.split('-');
                                            setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${y}-${m}-01`, fechaFin: `${y}-${m}-31` });
                                        }} />
                                    )}
                                    {filtrosEdicion.periodo === 'año' && (
                                        <input type="number" min="2020" max="2030" placeholder="Año" className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${e.target.value}-01-01`, fechaFin: `${e.target.value}-12-31` })} />
                                    )}
                                </div>
                                <button onClick={aplicarFiltroFecha} className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors">Aplicar Filtro</button>
                            </div>
                        </div>
                    </div>
                )}
                {previewOpen && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setPreviewOpen(false)}
                        ></div>
                        <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">Detalle de Remisión</h3>
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{datosPreview?.folio}</p>
                                </div>
                                <button onClick={() => setPreviewOpen(false)} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 max-h-[80vh] overflow-y-auto">
                                <VistaPreviaRemision data={datosPreview} />
                            </div>
                        </div>
                    </div>
                )}
                <ModalEnviarCorreo isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} onSend={handleSendEmail} row={selectedRow} />
                <ModalPrefactura isOpen={prefacturaModalOpen} onClose={() => setPrefacturaModalOpen(false)} onSend={handleSendPrefactura} row={selectedRow} />
                <PdfExporterRemision id={pdfId} onDone={handlePdfDone} />
            </div>
        </AppLayout>
    );
}
