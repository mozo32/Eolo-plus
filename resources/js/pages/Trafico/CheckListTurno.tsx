import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
import { DataTable, Column } from "@/components/DataTable";
import { useEffect, useState } from 'react';
import { fetchCheckListTurno, fetchShowCheckListTurno } from '@/stores/apiCheckListTurno';
import { Plus, FileEdit, X } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'CheckList de Turno',
    },
];

export default function CheckListTurno() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);

    const formatFecha = (fecha: string) => {
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchCheckListTurno({
                page,
                search,
                per_page: 10,
            });
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
            setLoadingDetalle(true);
            const dat = await fetchShowCheckListTurno(id);
            setDetalle(dat)
            setOpenForm(true);
            setIsEdit(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingDetalle(false);
        }
    }

    const columns: Column<any>[] = [
        {
            key: "id",
            header: "ID",
            render: (row) => <span className="font-mono text-xs text-gray-500">#{row.id}</span>
        },
        {
            key: "fecha",
            header: "Fecha de Registro",
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatFecha(row.fecha)}</span>
                    <span className="text-xs text-gray-400 font-normal">Entrega puntual</span>
                </div>
            ),
        },
        {
            key: "nombre_empleado",
            header: "Responsable",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-200 font-bold text-xs">
                        {row.nombre_empleado.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{row.nombre_empleado}</span>
                </div>
            ),
        },
        {
            key: "acciones",
            header: "Acciones",
            render: (row) => (
                <button
                    className="p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg"
                    onClick={() => show(row.id)}
                    title="Editar registro"
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
            <Head title="CheckListTurno" />

            <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">CheckList de Turno</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Administra y visualiza el historial de entregas de turno.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsEdit(false);
                            setDetalle(null);
                            setOpenForm(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        <Plus size={18} />
                        Nuevo Registro
                    </button>
                </div>

                <DataTable
                    data={data}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    search={search}
                    onSearchChange={(value) => {
                        setPage(1);
                        setSearch(value);
                    }}
                    meta={meta}
                    onPageChange={(p) => setPage(p)}
                    emptyMessage="No se encontraron registros de entrega de turno."
                />
            </div>

            {/* Modal Form */}
            {openForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                    onClick={() => { setOpenForm(false); setIsEdit(false); }}
                >
                    <div className="fixed inset-0 bg-gray-500/75 backdrop-blur-sm transition-opacity dark:bg-gray-950/80" />

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl transition-all dark:bg-gray-900 flex flex-col"
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {isEdit ? 'Actualizar Entrega de Turno' : 'Nueva Entrega de Turno'}
                            </h3>
                            <button
                                onClick={() => { setOpenForm(false); setIsEdit(false); }}
                                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6">
                            <CheckListTurnoForm
                                isEdit={isEdit}
                                data={detalle}
                                open={openForm}
                                onSuccess={() => {
                                    setOpenForm(false);
                                    setIsEdit(false);
                                    setDetalle(null);
                                    cargarDatos();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
