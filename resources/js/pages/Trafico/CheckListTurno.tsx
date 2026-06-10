import { type BreadcrumbItem } from '@/types';
import { Head,usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
import ModalActividadesNextTurno from './checkListTurno/ModalActividadesNextTurno';
import ModalNotasOperacionales from './checkListTurno/ModalNotasOperacionales';
import { fetchNotasOperacionales } from '@/stores/apiCheckListTurno';
import { useEffect, useState, useCallback } from 'react';
import { fetchCheckListTurno, fetchShowCheckListTurno, eliminar, fetchCheckListPendiente,validarNotaOperacional } from '@/stores/apiCheckListTurno';
import { Plus, ChevronLeft, ChevronRight, Edit2, CheckCircle2, AlertCircle, ClipboardList, StickyNote,ShieldCheck  } from 'lucide-react';
import PdfExporterTurno from './checkListTurno/sections/PdfExporterTurno';
import Swal from 'sweetalert2';
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
const breadcrumbs: BreadcrumbItem[] = [{ title: 'CheckList de Turno' }];

export default function CheckListTurno() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [idPendiente, setIdPendiente] = useState<number | null>(null);
    const [openActividades, setOpenActividades] = useState(false);
    const [isValidationMode, setIsValidationMode] = useState(false);
    const [notas, setNotas] = useState<any[]>([]);
    const [loadingNotas, setLoadingNotas] = useState(false);
    const [openNotasModal, setOpenNotasModal] = useState(false);
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user?.roles[0]?.slug;

    const formatFecha = (fecha: string) => {
        if (!fecha) return 'N/A';
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    };


    // CARGA DE NOTAS OPERACIONALES
    const cargarNotas = async () => {
        try {
            setLoadingNotas(true);
            const res = await fetchNotasOperacionales();
            if (res.ok) {
                setNotas(res.data || []);
            }
        } catch (error) {
            console.error("Error cargando notas operacionales:", error);
        } finally {
            setLoadingNotas(false);
        }
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchCheckListTurno({ page, search, per_page: 10 });
            setData(res.data || []);
            setMeta(res);

            const pendiente = await fetchCheckListPendiente();
            if (pendiente && pendiente.id) {
                setIdPendiente(pendiente.id);
            } else {
                setIdPendiente(null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrincipalAction = () => {
        if (idPendiente) {
            show(idPendiente);
        } else {
            setIsEdit(false);
            setDetalle(null);
            setOpenForm(true);
        }
    };
    const handlePdfDone = useCallback(() => setPdfId(null), []);

    const show = async (id: number) => {
        try {
            const dat = await fetchShowCheckListTurno(id);
            setDetalle(dat);
            setIsEdit(true);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
    };
    const abrirParaValidar = async (id: number) => {
        try {
            const dat = await fetchShowCheckListTurno(id);
            setDetalle(dat);
            setIsEdit(false);            // No es edición común
            setIsValidationMode(true);   // Activamos modo validación
            setOpenForm(true);           // Abrimos el contenedor/modal del formulario
        } catch (error) {
            console.error(error);
        }
    };
    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setIsValidationMode(false);
        setDetalle(null);
    };

    const handleCloseActividades = () => {
        setOpenActividades(false);
        cargarNotas();
    };
    const handleEliminar = async (id: number) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "El registro se marcará como inactivo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                const res = await eliminar(id);
                if (res.ok) {
                    Swal.fire({ title: '¡Eliminado!', icon: 'success', timer: 1500, showConfirmButton: false });
                    cargarDatos();
                }
            } catch (error: any) {
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    useEffect(() => {
        cargarDatos();
        cargarNotas(); // Consulta las notas automáticamente al montar la vista
    }, [page, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList de Turno" />
            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">CheckList de Turno</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Historial y entregas</p>
                            </div>

                            <button
                                onClick={() => setOpenNotasModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all active:scale-95 group relative"
                                title="Ver Notas Operacionales"
                            >
                                <StickyNote size={14} className="group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-tight">Actividades</span>
                                <span className="inline-flex items-center justify-center h-5 px-1.5 text-[9px] font-black bg-indigo-600 text-white rounded-full min-w-[20px]">
                                    {loadingNotas ? '...' : notas.length}
                                </span>
                            </button>
                        </div>

                        {/* GRUPO DE BOTONES DE ACCIÓN */}
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setOpenActividades(true)}
                                className="text-[10px] font-black px-4 py-2 rounded shadow-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <ClipboardList size={14} className="text-slate-500" />
                                AGREGAR ACTIVIDADES
                            </button>

                            <button
                                onClick={handlePrincipalAction}
                                className={`text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white flex items-center gap-2 ${idPendiente
                                        ? "bg-orange-500 hover:bg-orange-600 shadow-orange-100 ring-4 ring-orange-100"
                                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                                    }`}
                            >
                                {idPendiente ? (
                                    <>
                                        <AlertCircle size={14} className="animate-pulse" />
                                        FINALIZAR TURNO PENDIENTE
                                    </>
                                ) : (
                                    <>
                                        <Plus size={14} /> NUEVO REGISTRO
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Estructura de Tabla nativa */}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">ID</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha de Registro</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Responsable</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Estado</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : data.length > 0 ? (
                                        data.map((row) => {
                                            const esFinalizado = row.estado_entrega === 'finalizado';
                                            return (
                                                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">#{row.id}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                            {formatFecha(row.fecha)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center gap-2 justify-center">
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 border border-slate-200 shrink-0">
                                                                {row.nombre_empleado?.charAt(0) || '?'}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{row.nombre_empleado}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border ${esFinalizado ? "bg-green-50 text-green-600 border-green-200" : "bg-orange-50 text-orange-600 border-orange-200"
                                                            }`}>
                                                            {esFinalizado ? <CheckCircle2 size={12} /> : <AlertCircle size={12} className="animate-pulse" />}
                                                            {row.estado_entrega}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                className={`p-2 rounded transition-colors ${esFinalizado ? "text-slate-400 hover:text-indigo-600" : "text-orange-500 hover:text-orange-600"
                                                                    }`}
                                                                onClick={() => show(row.id)}
                                                                title="Editar Registro"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            {!row.validado_por_user_id && (
                                                                <button
                                                                    onClick={() => abrirParaValidar(row.id)}
                                                                    className={`p-2 rounded transition-colors text-slate-400 hover:text-indigo-600`}
                                                                    title="Validar Registro"
                                                                    disabled={!!row.validado_por_user_id}
                                                                >
                                                                    <ShieldCheck size={16} />
                                                                </button>
                                                            )}

                                                            <button className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]" onClick={() => setPdfId(row.id)} title="Descargar PDF">
                                                                PDF
                                                            </button>
                                                            <button onClick={() => handleEliminar(row.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Eliminar Registro">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                No hay registros disponibles
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Paginación */}
                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Mostrando {meta.from || 0} - {meta.to || 0} de {meta.total || 0}
                            </div>
                            <div className="flex gap-1 items-center">
                                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors">
                                    <ChevronLeft size={14} /> ANTERIOR
                                </button>
                                <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                                    PÁGINA {meta.current_page} DE {meta.last_page}
                                </span>
                                <button disabled={page === meta.last_page} onClick={() => setPage(page + 1)} className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors">
                                    SIGUIENTE <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DEL FORMULARIO DE CHECKLIST */}
            {openForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    {isEdit ? 'Editar Entrega de Turno' : 'Registrar Entrega de Turno'}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Módulo de Operaciones Diarias</p>
                            </div>
                            <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <CheckListTurnoForm
                                isEdit={isEdit}
                                isValidationMode={isValidationMode}
                                data={detalle}
                                open={openForm}
                                onSuccess={() => { handleBack(); cargarDatos(); }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <ModalActividadesNextTurno
                isOpen={openActividades}
                onClose={handleCloseActividades}
            />

            <ModalNotasOperacionales
                isOpen={openNotasModal}
                onClose={() => setOpenNotasModal(false)}
                notas={notas}
                loading={loadingNotas}
                onValidar={async (id) => {
                    const result = await Swal.fire({
                        title: '¿Validar esta nota?',
                        text: "Se registrará tu usuario como el validador de esta incidencia.",
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonColor: '#4f46e5',
                        cancelButtonColor: '#slate-400',
                        confirmButtonText: 'Sí, validar',
                        cancelButtonText: 'Cancelar'
                    });

                    if (result.isConfirmed) {
                        try {
                            const res = await validarNotaOperacional(id);
                            if (res.ok) {
                                Swal.fire({ title: '¡Validada!', icon: 'success', timer: 1500, showConfirmButton: false });
                                cargarNotas();
                            }
                        } catch (error) {
                            Swal.fire('Error', 'No se pudo validar la nota', 'error');
                        }
                    }
                }}
            />

            <PdfExporterTurno id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
