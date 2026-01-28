import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ServicioComisariatoForm from './servicioComisariato/ServicioComisariatoForm';
import { DataTable, Column } from '@/components/DataTable';
import { useState, useEffect } from 'react';
import { fetchServicioComisariato, fetchShowServicioComisariato } from '@/stores/apiServicioComisariato';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ServicioComisariato',
    },
];

export default function ServicioComisariato() {
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchServicioComisariato({
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
    const formatFecha = (fecha: string) => {
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
    };
    const show = async (id: number) => {
        try {
            setLoadingDetalle(true);
            const dat = await fetchShowServicioComisariato(id);
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
        { key: "id", header: "ID" },
        {
            key: "fecha_entrega",
            header: "Fecha",
            render: (row) => formatFecha(row.fecha_entrega),
        },
        {
            key: "catering",
            header: "Catering",
            render: (row) => row.catering,
        },
        {
            key: "matricula",
            header: "Matricula",
            render: (row) => row.matricula,
        },
        {
            key: "forma_pago",
            header: "Forma de Pago",
            render: (row) => row.forma_pago,
        },
        {
            key: "acciones",
            header: "Acciones",
            render: (row) => (
                <button
                    className="text-blue-600 hover:underline"
                    onClick={() => show(row.id)}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="25"
                        height="25"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#007aff"
                        stroke-width="1.75"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                        <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
                        <path d="M16 5l3 3" />
                    </svg>
                </button>
            ),
        },
    ];
    useEffect(() => {
        cargarDatos();

    }, [page, search]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ServicioComisariato" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="relative flex-1 rounded-xl border p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Registros</h2>
                        <button
                            onClick={() => setOpenForm(true)}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
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
                        emptyMessage="No hay registros de entrega de turno"
                    />
                </div>
            </div>

            {openForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => {
                        setOpenForm(false);
                        setIsEdit(false);
                        setDetalle(null);
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full
                                    ${isEdit
                                        ? 'bg-orange-100 text-orange-600'
                                        : 'bg-[#00677F]/10 text-[#00677F]'}
                                    `}
                                >
                                    {isEdit ? (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                        </svg>
                                    ) : (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M12 5v14" />
                                            <path d="M5 12h14" />
                                        </svg>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">
                                        {isEdit
                                            ? 'Actualizar Servicio de Comisariato'
                                            : 'Nuevo Servicio de Comisariato'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Área Operativa
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setOpenForm(false);
                                    setIsEdit(false);
                                    setDetalle(null);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                                aria-label="Cerrar"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <ServicioComisariatoForm
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
