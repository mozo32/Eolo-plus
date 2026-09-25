import AppLayout from '@/layouts/app-layout';
import {
    fetchDepartamentosCatalogo,
    fetchIdsDelGrupo,
    fetchUsers,
    type DepartamentoCatalogo,
    type FiltroUsuarios,
    type ModoAsignacion,
} from '@/stores/apiGestionUsuario';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
    departamentos?: { id: number; nombre: string }[];
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

/** Valor del selector: un departamento, los que no tienen ninguno, o todos. */
const SIN_DEPARTAMENTO = 'sin';
const TODOS = '';

export default function GestionUsuarios() {
    const [users, setUsers] = useState<Paginated<User> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modoModal, setModoModal] = useState<ModoAsignacion>('agregar');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [grupo, setGrupo] = useState<string>(TODOS);

    const [catalogo, setCatalogo] = useState<DepartamentoCatalogo[]>([]);
    const [sinDepartamentoTotal, setSinDepartamentoTotal] = useState(0);
    const [seleccionandoGrupo, setSeleccionandoGrupo] = useState(false);

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        if (!user) return [{ title: 'Gestión de usuarios' }];
        const roleLabels: Record<string, string> = {
            admin: 'Administrador',
            empleado: 'Empleado',
            jefe_area: 'Jefe de Área',
            fbo: 'FBO',
        };
        const roleName = user.roles.map((r) => roleLabels[r.slug] ?? r.nombre).join(', ');
        return [{ title: roleName ? `Gestión de usuarios · ${roleName}` : 'Gestión de usuarios' }];
    }, [user]);

    const filtro = useMemo<FiltroUsuarios>(
        () => ({
            page,
            search,
            sin_departamento: grupo === SIN_DEPARTAMENTO,
            departamento_id: grupo && grupo !== SIN_DEPARTAMENTO ? Number(grupo) : null,
        }),
        [page, search, grupo],
    );

    const departamentoElegido = useMemo(
        () => catalogo.find((d) => String(d.id) === grupo) ?? null,
        [catalogo, grupo],
    );

    /** Cuántos usuarios tiene el grupo filtrado, para el botón de selección. */
    const totalDelGrupo = grupo === SIN_DEPARTAMENTO ? sinDepartamentoTotal : departamentoElegido?.usuarios ?? 0;

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setUsers(await fetchUsers(filtro));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    }, [filtro]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const loadCatalogo = useCallback(async () => {
        try {
            const data = await fetchDepartamentosCatalogo();
            setCatalogo(data.departamentos);
            setSinDepartamentoTotal(data.sin_departamento);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar los departamentos');
        }
    }, []);

    useEffect(() => {
        loadCatalogo();
    }, [loadCatalogo]);

    const toggleUserSelection = (id: number) => {
        setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]));
    };

    /**
     * La casilla del encabezado solo manda sobre la página visible: la
     * selección puede abarcar varias páginas y no debe perderse al navegar.
     */
    const idsEnPagina = users?.data.map((u) => u.id) ?? [];
    const paginaCompleta = idsEnPagina.length > 0 && idsEnPagina.every((id) => selectedUserIds.includes(id));

    const togglePaginaCompleta = () => {
        setSelectedUserIds((prev) =>
            paginaCompleta
                ? prev.filter((id) => !idsEnPagina.includes(id))
                : [...new Set([...prev, ...idsEnPagina])],
        );
    };

    /** Trae los IDs de todo el grupo filtrado, incluidos los de otras páginas. */
    const seleccionarGrupoCompleto = async () => {
        try {
            setSeleccionandoGrupo(true);
            setError(null);
            const ids = await fetchIdsDelGrupo(filtro);
            setSelectedUserIds(ids);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al seleccionar el grupo');
        } finally {
            setSeleccionandoGrupo(false);
        }
    };

    const abrirModal = (modo: ModoAsignacion, ids?: number[]) => {
        if (ids) setSelectedUserIds(ids);
        setModoModal(modo);
        setIsModalOpen(true);
    };

    const cerrarModal = () => {
        setIsModalOpen(false);
        setSelectedUserIds([]);
    };

    const nombreDelGrupo = grupo === SIN_DEPARTAMENTO ? 'sin departamento' : departamentoElegido?.nombre ?? '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de usuarios" />

            <div className="flex flex-col gap-4 p-4">
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Usuarios del sistema</h1>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={grupo}
                                onChange={(e) => {
                                    setPage(1);
                                    setGrupo(e.target.value);
                                }}
                                className="rounded-lg border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                                aria-label="Filtrar por departamento"
                            >
                                <option value={TODOS}>Todos los departamentos</option>
                                {catalogo.map((dep) => (
                                    <option key={dep.id} value={String(dep.id)}>
                                        {dep.nombre} ({dep.usuarios})
                                    </option>
                                ))}
                                <option value={SIN_DEPARTAMENTO}>Sin departamento ({sinDepartamentoTotal})</option>
                            </select>

                            <input
                                type="text"
                                placeholder="Buscar usuario…"
                                value={search}
                                onChange={(e) => {
                                    setPage(1);
                                    setSearch(e.target.value);
                                }}
                                className="rounded-lg border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                            />
                        </div>
                    </div>

                    {(grupo !== TODOS || selectedUserIds.length > 0) && (
                        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                            {grupo !== TODOS && totalDelGrupo > 0 && (
                                <button
                                    type="button"
                                    onClick={seleccionarGrupoCompleto}
                                    disabled={seleccionandoGrupo}
                                    className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                                >
                                    {seleccionandoGrupo
                                        ? 'Seleccionando…'
                                        : `Seleccionar los ${totalDelGrupo} de ${nombreDelGrupo}`}
                                </button>
                            )}

                            {selectedUserIds.length > 0 && (
                                <>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {selectedUserIds.length} seleccionados
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUserIds([])}
                                        className="text-sm text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Limpiar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => abrirModal('agregar')}
                                        className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                                    >
                                        Asignar módulos a los seleccionados ({selectedUserIds.length})
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                <tr>
                                    <th className="px-3 py-2 text-left">
                                        <input
                                            type="checkbox"
                                            onChange={togglePaginaCompleta}
                                            checked={paginaCompleta}
                                            aria-label="Seleccionar los usuarios de esta página"
                                        />
                                    </th>
                                    <th className="px-3 py-2 text-left">Nombre</th>
                                    <th className="px-3 py-2 text-left">Correo</th>
                                    <th className="px-3 py-2 text-left">Departamentos</th>
                                    <th className="px-3 py-2 text-center">Roles</th>
                                    <th className="px-3 py-2 text-center">Opciones</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                                            Cargando usuarios…
                                        </td>
                                    </tr>
                                ) : users?.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                                            No hay usuarios
                                        </td>
                                    </tr>
                                ) : (
                                    users?.data.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                            <td className="px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.includes(u.id)}
                                                    onChange={() => toggleUserSelection(u.id)}
                                                    aria-label={`Seleccionar a ${u.name}`}
                                                />
                                            </td>
                                            <td className="px-3 py-2">{u.name}</td>
                                            <td className="px-3 py-2">{u.email}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {u.departamentos?.length ? (
                                                        u.departamentos.map((dep) => (
                                                            <span
                                                                key={dep.id}
                                                                className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                            >
                                                                {dep.nombre}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Sin departamento</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex flex-wrap justify-center gap-1">
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
                                                    onClick={() => abrirModal('reemplazar', [u.id])}
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

                    {users && users.last_page > 1 && (
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                            <span className="text-sm text-gray-500">
                                {users.total} usuarios · página {users.current_page} de {users.last_page}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={users.current_page <= 1 || loading}
                                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700"
                                >
                                    Anterior
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={users.current_page >= users.last_page || loading}
                                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}

                    {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="max-h-[95vh] w-full max-w-7xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                {modoModal === 'agregar'
                                    ? `Agregar módulos (${selectedUserIds.length} usuarios)`
                                    : 'Permisos del usuario'}
                            </h2>
                            <button
                                type="button"
                                onClick={cerrarModal}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        <TablaAsignacion
                            userIds={selectedUserIds}
                            modo={modoModal}
                            onSaved={() => {
                                cerrarModal();
                                loadUsers();
                                loadCatalogo();
                            }}
                            onCancel={cerrarModal}
                        />
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
