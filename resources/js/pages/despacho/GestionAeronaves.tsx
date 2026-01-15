import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { gestionarAeronaves } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import GestionAeronaveForm from './components/gestionAeronave/GestionAeronaveForm';
import NuevoTipoAeronave from './components/gestionAeronave/NuevoTipoAeronave';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'GestionarAeronaves',
        href: gestionarAeronaves().url,
    },
];

const AERONAVES_FAKE = [
    { id: 1, matricula: 'XA-ABC', tipo: 'Learjet 45', tipoAeronave: 'Avión' },
    { id: 2, matricula: 'XA-HEL', tipo: 'Bell 407', tipoAeronave: 'Helicóptero' },
    { id: 3, matricula: 'XB-123', tipo: 'Cessna 172', tipoAeronave: 'Avión' },
];

export default function GestionarAeronaves() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalTipoOpen, setIsModalTipoOpen] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="GestionarAeronaves" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 p-6 dark:border-sidebar-border md:min-h-min">
                    <div className="flex items-center justify-between pb-4">
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Gestión de aeronaves
                        </h1>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsModalTipoOpen(true)}
                                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm
                                    transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                            >
                                Nuevo tipo de aeronave
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm
                                    transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                            >
                                Registrar aeronave
                            </button>
                        </div>
                    </div>

                    {/* Tabla con datos de ejemplo */}
                    <div className="p-4 text-sm text-gray-700 dark:text-gray-300">
                        <table className="min-w-full border-collapse rounded-lg overflow-hidden shadow-sm">
                            <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium border-b border-gray-300 dark:border-gray-700">
                                        #
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium border-b border-gray-300 dark:border-gray-700">
                                        Matrícula
                                    </th>
                                    <th className="px-4 py-2 text-center font-medium border-b border-gray-300 dark:border-gray-700">
                                        Tipo
                                    </th>
                                    <th className="px-4 py-2 text-center font-medium border-b border-gray-300 dark:border-gray-700">
                                        Tipo Aeronave
                                    </th>
                                    <th className="px-4 py-2 text-center font-medium border-b border-gray-300 dark:border-gray-700">
                                        Opciones
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {AERONAVES_FAKE.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                                    >
                                        <td className="px-4 py-2">{item.id}</td>
                                        <td className="px-4 py-2 font-medium">{item.matricula}</td>
                                        <td className="px-4 py-2 text-center">{item.tipo}</td>
                                        <td className="px-4 py-2 text-center">
                                            {item.tipoAeronave}
                                        </td>

                                        <td className="px-4 py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* Editar */}
                                                <button
                                                    type="button"
                                                    onClick={() => console.log('Editar', item)}
                                                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white
                                                        hover:bg-blue-700 transition dark:bg-blue-500 dark:hover:bg-blue-600"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828z" />
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M2 15.25V18h2.75l8.486-8.486-2.75-2.75L2 15.25z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    Editar
                                                </button>

                                                {/* Eliminar */}
                                                <button
                                                    type="button"
                                                    onClick={() => console.log('Eliminar', item)}
                                                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white
                                                        hover:bg-red-700 transition dark:bg-red-500 dark:hover:bg-red-600"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M6 8a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm5-3h-3.5l-.71-.71A1 1 0 0 0 10.59 3H8.41a1 1 0 0 0-.7.29L7 4.29H3a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2zM5 7h10l-.8 9.59A2 2 0 0 1 12.21 18H7.79a2 2 0 0 1-1.99-1.41L5 7z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL Registrar aeronave */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
                    <div className="relative w-full max-w-3xl rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-900">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Registrar nueva aeronave
                            </h2>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                                    hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            >
                                <span className="text-lg leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="max-h-[80vh] overflow-y-auto px-1 pb-2">
                            <GestionAeronaveForm onClose={() => setIsModalOpen(false)} />
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL Nuevo tipo de aeronave */}
            {isModalTipoOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
                    <div className="relative w-full max-w-3xl rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-900">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Registrar nuevo tipo de aeronave
                            </h2>

                            <button
                                type="button"
                                onClick={() => setIsModalTipoOpen(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                                    hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            >
                                <span className="text-lg leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="max-h-[80vh] overflow-y-auto px-1 pb-2">
                            <NuevoTipoAeronave onClose={() => setIsModalTipoOpen(false)} />
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
