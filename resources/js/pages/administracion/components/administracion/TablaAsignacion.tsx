import { useCallback, useEffect, useState } from 'react';
import {
    fetchDepartamentosUsuario,
    saveDepartamentosUsuario,
    type ModoAsignacion,
} from '@/stores/apiGestionUsuario';

type SubDepartamento = {
    id: number;
    nombre: string;
    activo: boolean;
};

type Departamento = {
    id: number;
    nombre: string;
    subdepartamentos: SubDepartamento[];
};

type Role = {
    id: number;
    slug: string;
    nombre: string;
};

type Props = {
    userIds: number[];
    /**
     * 'agregar' (masivo): arranca en blanco y suma lo marcado a lo que cada
     * usuario ya tiene. 'reemplazar' (individual): precarga sus permisos y
     * destildar los quita.
     */
    modo: ModoAsignacion;
    onSaved: () => void;
    onCancel?: () => void;
};

export default function TablaAsignacion({
    userIds,
    modo,
    onSaved,
    onCancel,
}: Props) {
    const esAgregar = modo === 'agregar';
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [selectedDepId, setSelectedDepId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const idToFetch = userIds[0];
            const data = await fetchDepartamentosUsuario(idToFetch);

            const catalogo = Array.isArray(data.departamentos) ? data.departamentos : [];

            // En modo agregar el formulario arranca en blanco: lo que se marque
            // se suma, así que precargar los permisos de un usuario confundiría.
            setDepartamentos(
                esAgregar
                    ? catalogo.map((dep) => ({
                          ...dep,
                          subdepartamentos: dep.subdepartamentos.map((s) => ({ ...s, activo: false })),
                      }))
                    : catalogo,
            );
            setRoles(Array.isArray(data.roles) ? data.roles : []);
            setSelectedRoleId(esAgregar ? null : (data.userRoleId ?? null));

            setSelectedDepId(data.departamentos?.[0]?.id ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar la configuración');
        } finally {
            setLoading(false);
        }
    }, [userIds, esAgregar]);

    useEffect(() => {
        if (userIds.length > 0) {
            fetchData();
        }
    }, [userIds, fetchData]);

    const selectedDep = departamentos.find((d) => d.id === selectedDepId);

    function toggleSub(depId: number, subId: number) {
        setDepartamentos((prev) =>
            prev.map((dep) =>
                dep.id === depId
                    ? {
                        ...dep,
                        subdepartamentos: dep.subdepartamentos.map((s) =>
                            s.id === subId ? { ...s, activo: !s.activo } : s
                        ),
                    }
                    : dep
            )
        );
    }

    function toggleAll(depId: number, value: boolean) {
        setDepartamentos((prev) =>
            prev.map((dep) =>
                dep.id === depId
                    ? {
                        ...dep,
                        subdepartamentos: dep.subdepartamentos.map((s) => ({
                            ...s,
                            activo: value,
                        })),
                    }
                    : dep
            )
        );
    }

    async function guardarCambios() {
        if (!esAgregar && !selectedRoleId) {
            alert('Debes seleccionar un rol');
            return;
        }

        const marcados = departamentos.flatMap((dep) => dep.subdepartamentos.filter((s) => s.activo));

        if (esAgregar && marcados.length === 0 && !selectedRoleId) {
            alert('Selecciona al menos un módulo o un rol para aplicar.');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                modo,
                role_id: selectedRoleId,
                asignaciones: departamentos.map((dep) => ({
                    departamento_id: dep.id,
                    subdepartamentos: dep.subdepartamentos
                        .filter((s) => s.activo)
                        .map((s) => s.id),
                })),
                user_ids: userIds,
            };

            await saveDepartamentosUsuario(payload);
            onSaved();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-10 text-center">Cargando configuración…</div>;
    if (error) return <div className="p-10 text-center text-red-600">{error}</div>;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 space-y-6">
            {esAgregar && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
                    Los módulos que marques se <strong>agregarán</strong> a los {userIds.length} usuarios
                    seleccionados, sin quitarles los que ya tenían. Para retirarle un módulo a alguien, usa el
                    botón Gestionar de ese usuario.
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-semibold mb-1">
                        {esAgregar ? 'Rol (opcional)' : 'Rol para los usuarios seleccionados'}
                    </label>
                    <select
                        disabled={saving}
                        value={selectedRoleId ?? ''}
                        onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                    >
                        {esAgregar ? (
                            <option value="">Mantener el rol actual de cada usuario</option>
                        ) : (
                            <option value="" disabled>Selecciona un rol</option>
                        )}
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>{role.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <aside className="md:col-span-1 border rounded-xl p-3 dark:border-gray-700">
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Departamentos</p>
                    <div className="space-y-1">
                        {departamentos.map((dep) => {
                            const activeCount = dep.subdepartamentos.filter(s => s.activo).length;
                            return (
                                <button
                                    key={dep.id}
                                    onClick={() => setSelectedDepId(dep.id)}
                                    className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition ${
                                        dep.id === selectedDepId ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <span>{dep.nombre}</span>
                                    <span className="text-xs opacity-70">{activeCount}/{dep.subdepartamentos.length}</span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section className="md:col-span-3 border rounded-xl p-5 dark:border-gray-700">
                    {selectedDep ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">{selectedDep.nombre}</h3>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedDep.subdepartamentos.length > 0 && selectedDep.subdepartamentos.every(s => s.activo)}
                                        onChange={(e) => toggleAll(selectedDep.id, e.target.checked)}
                                    />
                                    Activar todo
                                </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {selectedDep.subdepartamentos.map((sub) => (
                                    <label
                                        key={sub.id}
                                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer transition ${
                                            sub.activo ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={sub.activo}
                                            onChange={() => toggleSub(selectedDep.id, sub.id)}
                                        />
                                        {sub.nombre}
                                    </label>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm">Selecciona un departamento</p>
                    )}
                </section>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">
                    Cancelar
                </button>
                <button
                    disabled={saving}
                    onClick={guardarCambios}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700"
                >
                    {saving
                        ? 'Guardando…'
                        : esAgregar
                          ? `Agregar a ${userIds.length} usuarios`
                          : `Aplicar a ${userIds.length} usuarios`}
                </button>
            </div>
        </div>
    );
}
