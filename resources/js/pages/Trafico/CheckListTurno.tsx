import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
import UniversalTable from '../UniversalTable';
import { useEffect, useState, useCallback } from 'react';
import { fetchCheckListTurno, fetchShowCheckListTurno, eliminar, fetchCheckListPendiente} from '@/stores/apiCheckListTurno';
import { Plus, ChevronLeft, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import PdfExporterTurno from './checkListTurno/sections/PdfExporterTurno';
import Swal from 'sweetalert2';

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

    const formatFecha = (fecha: string) => {
        if (!fecha) return 'N/A';
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
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

    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setDetalle(null);
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

    const columns = [
        {
            header: "ID",
            render: (row: any) => <span className="font-mono text-xs font-bold text-slate-900">#{row.id}</span>
        },
        {
            header: "Fecha de Registro",
            render: (row: any) => (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {formatFecha(row.fecha)}
                </span>
            ),
        },
        {
            header: "Responsable",
            render: (row: any) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                        {row.nombre_empleado?.charAt(0) || '?'}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{row.nombre_empleado}</span>
                </div>
            ),
        },
        {
            header: "Estado",
            render: (row: any) => {
                const esFinalizado = row.estado_entrega === 'finalizado';
                return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border ${
                        esFinalizado ? "bg-green-50 text-green-600 border-green-200" : "bg-orange-50 text-orange-600 border-orange-200"
                    }`}>
                        {esFinalizado ? <CheckCircle2 size={12} /> : <AlertCircle size={12} className="animate-pulse" />}
                        {row.estado_entrega}
                    </span>
                );
            }
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (row: any) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        className={`p-2.5 rounded-xl transition-all shadow-sm ${
                            row.estado_entrega === 'finalizado'
                            ? "text-slate-400 hover:text-white hover:bg-indigo-600"
                            : "text-orange-500 bg-orange-50 hover:bg-orange-600 hover:text-white border border-orange-200"
                        }`}
                        onClick={() => show(row.id)}
                    >
                        <Edit2 size={18} />
                    </button>
                    <button className="p-2.5 text-slate-400 hover:text-white hover:bg-amber-600 rounded-xl transition-all shadow-sm" onClick={() => setPdfId(row.id)} >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                    </button>
                    <button onClick={() => handleEliminar(row.id)} className="p-2.5 text-slate-400 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M4 7h3m4 0h9" /><path d="M10 11l0 6" /><path d="M14 14l0 3" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l.077 -.923" /><path d="M18.384 14.373l.616 -7.373" /><path d="M9 5v-1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                    </button>
                </div>
            ),
        },
    ];

    useEffect(() => { cargarDatos(); }, [page, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList de Turno" />
            <div className="p-6">
                {!openForm ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">CheckList de Turno</h2>
                                <p className="text-sm text-slate-500 font-medium uppercase">Historial y entregas.</p>
                            </div>
                            <button
                                onClick={handlePrincipalAction}
                                className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition-all shadow-lg ${
                                    idPendiente
                                    ? "bg-orange-500 hover:bg-orange-600 ring-4 ring-orange-100"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                            >
                                {idPendiente ? (
                                    <>
                                        <AlertCircle size={18} strokeWidth={3} className="animate-pulse" />
                                        FINALIZAR TURNO PENDIENTE
                                    </>
                                ) : (
                                    <>
                                        <Plus size={18} strokeWidth={3} /> NUEVO REGISTRO
                                    </>
                                )}
                            </button>
                        </div>
                        <UniversalTable
                            columns={columns}
                            data={data}
                            loading={loading}
                            pagination={{
                                current_page: meta?.current_page || 1,
                                last_page: meta?.last_page || 1,
                                total: meta?.total || 0
                            }}
                            onPageChange={(p) => setPage(p)}
                            emptyMessage="No hay registros disponibles"
                        />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <button onClick={handleBack} className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                                <ChevronLeft size={20} strokeWidth={3} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">{isEdit ? 'Editar Entrega' : 'Nueva Entrega'}</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Panel principal</p>
                            </div>
                        </div>
                        <CheckListTurnoForm
                            isEdit={isEdit}
                            data={detalle}
                            open={openForm}
                            onSuccess={() => { handleBack(); cargarDatos(); }}
                        />
                    </div>
                )}
            </div>
            <PdfExporterTurno id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
