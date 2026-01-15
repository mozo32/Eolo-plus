import { useEffect, useState } from 'react';
import {
    fetchDepartamentosUsuario,
    saveDepartamentosUsuario,
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

type Props = {
    userId: number;
    onSaved: () => void;
    onCancel?: () => void;
};
type Role = {
    id: number;
    slug: string;
    nombre: string;
};
export default function TablaAsignacion({
    userId,
    onSaved,
    onCancel,
}: Props) {
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [selectedDepId, setSelectedDepId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    async function fetchDepartamentos() {
        try {
            setLoading(true);

            const data = await fetchDepartamentosUsuario(userId);
            setDepartamentos(Array.isArray(data.departamentos) ? data.departamentos : []);
            setRoles(Array.isArray(data.roles) ? data.roles : []);
            setSelectedRoleId(data.userRoleId ?? null);
            setSelectedDepId(data.departamentos?.[0]?.id ?? null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchDepartamentos();
    }, [userId]);

    const selectedDep = Array.isArray(departamentos) ? departamentos.find((d) => d.id === selectedDepId) : undefined;

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
        if (!selectedRoleId) {
            alert('Debes seleccionar un rol');
            return;
        }

        try {
            setSaving(true);

            const payload = {
                role_id: selectedRoleId,
                asignaciones: departamentos.map((dep) => ({
                    departamento_id: dep.id,
                    subdepartamentos: dep.subdepartamentos
                        .filter((s) => s.activo)
                        .map((s) => s.id),
                })),
            };

            await saveDepartamentosUsuario(userId, payload);

            onSaved();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p>Cargando…</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-semibold mb-1">
                        Rol del usuario
                    </label>
                    <select
                        disabled={saving}
                        value={selectedRoleId ?? ''}
                        onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                        className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                    >
                        <option value="" disabled>
                            Selecciona un rol
                        </option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.nombre}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* BODY */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* DEPARTAMENTOS */}
                <aside className="md:col-span-1 border rounded-xl p-3 dark:border-gray-700">
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                        Departamentos
                    </p>

                    <div className="space-y-1">
                        {departamentos.map((dep) => {
                            const activeCount = dep.subdepartamentos.filter(s => s.activo).length;

                            return (
                                <button
                                    key={dep.id}
                                    onClick={() => setSelectedDepId(dep.id)}
                                    className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition
                                        ${dep.id === selectedDepId
                                            ? 'bg-primary text-white'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <span>{dep.nombre}</span>
                                    <span className="text-xs opacity-70">
                                        {activeCount}/{dep.subdepartamentos.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* SUBDEPARTAMENTOS */}
                <section className="md:col-span-3 border rounded-xl p-5 dark:border-gray-700">
                    {selectedDep ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">
                                    {selectedDep.nombre}
                                </h3>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedDep.subdepartamentos.every(s => s.activo)}
                                        onChange={(e) =>
                                            toggleAll(selectedDep.id, e.target.checked)
                                        }
                                    />
                                    Activar todo
                                </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {selectedDep.subdepartamentos.map((sub) => (
                                    <label
                                        key={sub.id}
                                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer
                                            ${sub.activo
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:border-gray-700'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={sub.activo}
                                            onChange={() =>
                                                toggleSub(selectedDep.id, sub.id)
                                            }
                                        />
                                        {sub.nombre}
                                    </label>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm">
                            Selecciona un departamento
                        </p>
                    )}
                </section>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border px-4 py-2 text-sm"
                >
                    Cancelar
                </button>

                <button
                    disabled={saving}
                    onClick={guardarCambios}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
            </div>
        </div>
    );
}
