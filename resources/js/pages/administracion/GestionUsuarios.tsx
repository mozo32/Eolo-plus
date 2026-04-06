import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState, useMemo } from 'react';
import { fetchUsers } from '@/stores/apiGestionUsuario';
import TablaAsignacion from './components/administracion/TablaAsignacion';

type Role = {
    slug: string;
    nombre: string;
};

type User = {
    id: number;
    name: string;
    email: string;
    roles: Role[];
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
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

export default function GestionUsuarios() {
    const [users, setUsers] = useState<Paginated<User> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        if (!user) return [{ title: "Gestión de usuarios" }];
        const roleLabels: Record<string, string> = {
            admin: "Administrador",
            empleado: "Empleado",
            jefe_area: "Jefe de Área",
            fbo: "FBO",
        };
        const roleName = user.roles.map((r) => roleLabels[r.slug] ?? r.nombre).join(", ");
        return [{ title: roleName ? `Gestión de usuarios · ${roleName}` : "Gestión de usuarios" }];
    }, [user]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchUsers({ page, search });
            setUsers(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [page, search]);

    const toggleUserSelection = (id: number) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (!users) return;
        if (selectedUserIds.length === users.data.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(users.data.map(u => u.id));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de usuarios" />

            <div className="flex flex-col gap-4 p-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Usuarios del sistema
                            </h1>
                            {selectedUserIds.length > 0 && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                                >
                                    Gestionar seleccionados ({selectedUserIds.length})
                                </button>
                            )}
                        </div>

                        <input
                            type="text"
                            placeholder="Buscar usuario…"
                            value={search}
                            onChange={(e) => {
                                setPage(1);
                                setSearch(e.target.value);
                            }}
                            className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                <tr>
                                    <th className="px-3 py-2 text-left">
                                        <input
                                            type="checkbox"
                                            onChange={toggleSelectAll}
                                            checked={users?.data.length === selectedUserIds.length && selectedUserIds.length > 0}
                                        />
                                    </th>
                                    <th className="px-3 py-2 text-left">Nombre</th>
                                    <th className="px-3 py-2 text-left">Correo</th>
                                    <th className="px-3 py-2 text-center">Roles</th>
                                    <th className="px-3 py-2 text-center">Opciones</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Cargando usuarios…</td>
                                    </tr>
                                ) : users?.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No hay usuarios</td>
                                    </tr>
                                ) : (
                                    users?.data.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                            <td className="px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.includes(u.id)}
                                                    onChange={() => toggleUserSelection(u.id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2">{u.name}</td>
                                            <td className="px-3 py-2">{u.email}</td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex justify-center gap-1 flex-wrap">
                                                    {u.roles.map((role) => (
                                                        <span
                                                            key={role.slug}
                                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                                                role.slug === 'admin'
                                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                            }`}
                                                        >
                                                            {role.nombre}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUserIds([u.id]);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="text-indigo-600 hover:underline"
                                                >
                                                    Gestionar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Asignación Masiva ({selectedUserIds.length} usuarios)
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setSelectedUserIds([]);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                                ✕
                            </button>
                        </div>

                        <TablaAsignacion
                            userIds={selectedUserIds}
                            onSaved={() => {
                                setIsModalOpen(false);
                                setSelectedUserIds([]);
                                loadUsers();
                            }}
                            onCancel={() => {
                                setIsModalOpen(false);
                                setSelectedUserIds([]);
                            }}
                        />
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
