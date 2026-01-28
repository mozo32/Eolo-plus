import { useState, useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { guardarCheckListEquipoSeguridadApi, buscarUsuariosApi, actualizarCheckListEquipoApi } from "@/stores/apiCheckListEquipoSeguridad";
import Swal from "sweetalert2";
import { fetchCheckUser } from "@/stores/apiCheckListEquipoSeguridad";
const MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
];

const EQUIPOS = [
    "Lentes",
    "Guantes",
    "Cascos",
    "Chaleco",
    "Botas",
    "Gorras",
    "Rodilleras",
    "Fajas",
    "Guantes PVC",
    "Bandas de luces",
    "Impermeable",
    "Tenis",
    "Botas de hule",
];
const now = new Date();
const MES_ACTUAL = MESES[now.getMonth()];
const ANIO_ACTUAL = now.getFullYear();
type Role = {
    slug: string;
    nombre: string;
};
export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: {
            id: number;
            nombre: string;
            route: string;
        }[];
    }[];
};
type Props = {
    isEdit: boolean;
    data?: any;
    open: boolean;
    onSuccess?: () => void;
};
const getInitialForm = (data?: any) => ({
    user_id: data?.user_id ?? "",
    nombre: data?.nombre ?? "",
    checklist: data?.checklist ?? {},
    observaciones: data?.observaciones ?? "",
});
export default function CheckListEquipoForm({
    isEdit,
    data,
    open,
    onSuccess,
}: Props) {
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [bloqueado, setBloqueado] = useState(false);
    const [buscando, setBuscando] = useState(false);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;

    const [form, setForm] = useState(() => getInitialForm(data));
    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
    }, [data, isEdit]);

    const toggleEquipo = (equipo: string) => {
        setForm((prev: any) => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [MES_ACTUAL]: {
                    ...(prev.checklist[MES_ACTUAL] || {}),
                    [equipo]: !prev.checklist?.[MES_ACTUAL]?.[equipo],
                },
            },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (isEdit && data?.id) {
                await actualizarCheckListEquipoApi(data.id, form);

            } else {
                await guardarCheckListEquipoSeguridadApi(form);
            }
            await Swal.fire({
                icon: "success",
                title: "CheckList guardado",
            });
            onSuccess?.();
        } catch (error: any) {

            if (error?.errors) {
                const messages = Object.values(error.errors)
                    .flat()
                    .join("<br>");

                Swal.fire({
                    icon: "error",
                    title: "Error",
                    html: messages,
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: error?.message || "Error inesperado",
                });
            }
        }
    };
    const consultNombre = async (id: number) => {
        try {
            const res = await fetchCheckUser(id);

            if (res.message) {
                Swal.fire({
                    icon: res.alreadyCheckedThisMonth ? "info" : "warning",
                    title: "Aviso",
                    text: res.message,
                });
            }

            if (res.data) {
                setForm((prev: any) => ({
                    ...prev,
                    user_id: res.data.user_id,
                    nombre: res.data.nombre,
                    checklist: res.data.checklist || {},
                    observaciones: res.data.observaciones || "",
                }));
            }

            const esAdmin = !!auth?.user?.isAdmin;

            setBloqueado(
                !!res.alreadyCheckedThisMonth && !esAdmin
            );

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo consultar el checklist",
            });
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-6xl space-y-8 rounded-xl border border-slate-300 bg-white p-8 shadow-md"
        >
            <div className="border-b pb-4">
                <h2 className="text-center text-2xl font-extrabold uppercase tracking-wider text-[#00677F]">
                    Checklist de Equipo de Seguridad
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-2 relative">
                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                        Nombre del empleado
                    </label>

                    <input
                        className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                        placeholder="Nombre completo"
                        value={form.nombre}
                        onChange={async (e) => {
                            const value = e.target.value;
                            setForm({ ...form, nombre: value });

                            if (value.length < 2) {
                                setUsuarios([]);
                                return;
                            }

                            setBuscando(true);
                            try {
                                const data = await buscarUsuariosApi(value);
                                setUsuarios(data);
                            } catch {
                                setUsuarios([]);
                            } finally {
                                setBuscando(false);
                            }
                        }}
                    />

                    {/* LISTA DESPLEGABLE */}
                    {usuarios.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
                            {usuarios.map((u) => (
                                <li
                                    key={u.id}
                                    onClick={() => {
                                        setForm({
                                            ...form,
                                            nombre: u.name,
                                            user_id: u.id,
                                        });
                                        setUsuarios([]);
                                        consultNombre(u.id);
                                    }}
                                    className="cursor-pointer px-4 py-2 text-sm hover:bg-[#E6F2F6]"
                                >
                                    <div className="font-semibold">{u.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {u.clave} · {u.puesto}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {buscando && (
                        <div className="absolute right-3 top-10 text-xs text-slate-400">
                            Buscando...
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center rounded-md border border-[#00677F] bg-[#E6F2F6] py-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#00677F]">
                        Registro mensual del {ANIO_ACTUAL}
                    </span>
                    <span className="text-sm font-extrabold uppercase text-[#004B5C]">
                        {MES_ACTUAL}
                    </span>
                </div>

            </div>

            <div className="rounded-xl border-2 border-[#00677F] bg-[#E6F2F6] p-6">
                <h3 className="mb-5 text-sm font-extrabold uppercase tracking-widest text-[#00677F]">
                    {MES_ACTUAL} {ANIO_ACTUAL}
                </h3>
                {bloqueado && (
                    <div className="rounded-md border border-blue-400 bg-blue-50 p-3 text-sm text-blue-700">
                        Este checklist ya fue realizado este mes y no puede modificarse.
                    </div>
                )}
                <br />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                    {EQUIPOS.map((equipo) => (
                        <label
                            key={equipo}
                            className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
                        >
                            <input
                                type="checkbox"
                                disabled={bloqueado}
                                checked={!!form.checklist?.[MES_ACTUAL]?.[equipo]}
                                onChange={() => toggleEquipo(equipo)}
                                className={`h-5 w-5 accent-[#00677F] ${bloqueado ? "cursor-not-allowed opacity-50" : ""
                                    }`}
                            />
                            {equipo}
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Observaciones generales
                </label>
                <textarea
                    disabled={bloqueado}
                    className={`w-full min-h-[140px] rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-medium focus:outline-none
                        ${bloqueado ? "opacity-60 cursor-not-allowed" : "focus:border-[#00677F]"}
                    `}
                    value={form.observaciones}
                    onChange={(e) =>
                        setForm({ ...form, observaciones: e.target.value })
                    }
                />
            </div>

            {/* ===== ACCIÓN ===== */}
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={bloqueado}
                    className={`rounded-md px-10 py-3 text-sm font-extrabold uppercase tracking-wide text-white
                        ${bloqueado
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-[#00677F] hover:bg-[#00586D]"
                        }`}
                >
                    {isEdit ? "Actualizar Checklist" : " Guardar Checklist"}
                </button>
            </div>
        </form>
    );


}
