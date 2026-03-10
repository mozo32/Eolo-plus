import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
import { DataTable, Column } from "@/components/DataTable";
import { useEffect, useState } from 'react';
import { fetchCheckListTurno, fetchShowCheckListTurno } from '@/stores/apiCheckListTurno';
import { Plus, ChevronLeft, FileEdit } from 'lucide-react';

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

    const formatFecha = (fecha: string) => {
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchCheckListTurno({ page, search, per_page: 10 });
            setData(res.data);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

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

    const columns: Column<any>[] = [
        { key: "id", header: "ID", render: (row) => <span className="font-mono text-xs">#{row.id}</span> },
        {
            key: "fecha",
            header: "Fecha de Registro",
            render: (row) => <span className="font-semibold">{formatFecha(row.fecha)}</span>,
        },
        {
            key: "nombre_empleado",
            header: "Responsable",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                        {row.nombre_empleado.charAt(0)}
                    </div>
                    <span className="text-sm">{row.nombre_empleado}</span>
                </div>
            ),
        },
        {
            key: "acciones",
            header: "Acciones",
            render: (row) => (
                <button
                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-[#007aff]"
                    onClick={() => show(row.id)}
                >
                    <FileEdit size={18} />
                </button>
            ),
        },
    ];

    useEffect(() => {
        cargarDatos();
    }, [page, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList de Turno" />
            <div className="p-6">
                {!openForm ? (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-800">CheckList de Turno</h2>
                                <p className="text-sm text-slate-500">Historial y administración de entregas de turno.</p>
                            </div>
                            <button
                                onClick={() => setOpenForm(true)}
                                className="flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-600 shadow-lg shadow-blue-100"
                            >
                                <Plus size={18} />
                                Nuevo Registro
                            </button>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <DataTable
                                data={data}
                                columns={columns}
                                keyField="id"
                                loading={loading}
                                search={search}
                                onSearchChange={(value) => { setPage(1); setSearch(value); }}
                                meta={meta}
                                onPageChange={(p) => setPage(p)}
                                emptyMessage="No hay registros disponibles"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <button onClick={handleBack} className="flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-all">
                                <ChevronLeft size={20} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{isEdit ? 'Editar Entrega' : 'Nueva Entrega'}</h2>
                                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Volver al panel principal</p>
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
        </AppLayout>
    );
}
