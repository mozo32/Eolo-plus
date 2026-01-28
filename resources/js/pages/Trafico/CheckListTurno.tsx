import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
import { DataTable, Column } from "@/components/DataTable";
import { useEffect, useState } from 'react';
import { fetchCheckListTurno, fetchShowCheckListTurno} from '@/stores/apiCheckListTurno';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'CheckListTurno',
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
                month: "long",
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
    const show = async(id: number) => {
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
        { key: "id", header: "ID" },
        {
            key: "fecha",
            header: "Fecha",
            render: (row) => formatFecha(row.fecha),
        },
        {
            key: "nombre_empleado",
            header: "Nombre",
            render: (row) => row.nombre_empleado,
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
            <Head title="CheckListTurno" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="relative flex-1 rounded-xl border p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Registros</h2>
                        <button
                            onClick={() => setOpenForm(true)}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Nuevo Check de Turno
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
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                    onClick={() => {setOpenForm(false), setIsEdit(false)}}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
                    >
                        <div className="sticky top-0 mb-4 flex items-center justify-between bg-white pb-2 dark:bg-gray-900">
                            <h3 className="text-lg font-semibold">
                                {isEdit ? 'Actualizar Entrega de Turno' : 'Nueva Entrega de Turno'}
                            </h3>
                            <button
                                onClick={() =>{ setOpenForm(false), setIsEdit(false)}}
                                className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
                            >
                                ✕
                            </button>
                        </div>
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
            )}
        </AppLayout>
    );
}
