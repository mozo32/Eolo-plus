import React, { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import Swal from "sweetalert2";
import SignaturePad from "./SignaturePad";
import MatriculaAutocomplete from "./MatriculaAutocomplete";
import ChecklistAvion from "./ChecklistAvion";
import ChecklistHelicoptero from "./ChecklistHelicoptero";
import EvidenciFotografica, { FotoItem } from "./EvidenciFotografica";
import TimePickerInput24 from "./TimePickerInput24";
import {
    validarPaso,
    validarWalkAroundFinal,
    PREGUNTAS_AVION,
    PREGUNTAS_HELICOPTERO,
} from "./validacionesWalkAround";
import { guardarWalkAroundApi, updateWalkaroundApi } from "@/stores/apiWalkaround";
import { fetchTiposAeronaveApi, TipoAeronaveApi } from "@/stores/apiAeronave";
import MapaDanios3D, { PuntoDanio } from "./MapaDanios3D";
import SignaturePadModal from "./SignaturePadModal";
import { ChecklistHelicopteroEstado, ChecklistAvionEstado, TipoDanio } from "@/types/typesChecklist";
import { usePage } from '@inertiajs/react';


interface SalidaFormData {
    movimiento: string;
    matricula: string;
    tipo: string;
    tipoAeronave: string;
    AeronaveId: number;
    hora: string;
    destino: string;
    procedensia: string;
    marcaDanos: PuntoDanio[];
    fecha: string;
    checklistAvion: ChecklistAvionEstado;
    checklistHelicoptero: ChecklistHelicopteroEstado;
    fotos: FotoItem[];
    numeroEstatica: number | "";
    observaciones: string;
    elabora_departamento_id: number | "";
    elabora_personal_id: number | "";
    elabora: string;
    responsable: string;
    jefeArea: string;
    fbo: string;
    firmaJefeAreaBase64: string;
    firmaFboBase64: string;
    firmaResponsableBase64: string;
    esNuevaMatricula?: boolean;
}

interface GestionWalkAroundFormProps {
    open: boolean;
    onClose?: () => void;
    onSaved?: () => void;
    mode?: "create" | "edit" | "firma";
    walkaroundId?: number;
    initialData?: Partial<SalidaFormData>;
}

type Step = 1 | 2 | 3 | 4;
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
const DRAFT_KEY = (id?: number) => id ? `walkaround_form_draft_${id}` : "walkaround_form_draft_new";

export default function WalkAroundForm({
    open,
    onClose,
    onSaved,
    mode = "create",
    walkaroundId,
    initialData,
}: GestionWalkAroundFormProps) {
    const today = new Date().toISOString().slice(0, 10);
    const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
    const [personal, setPersonal] = useState<{ id: number; nombre: string }[]>([]);
    const [step, setStep] = useState<Step>(1);
    const [tiposAeronave, setTiposAeronave] = useState<TipoAeronaveApi[]>([]);
    const [openFirma, setOpenFirma] = useState<null | "jefe" | "fbo" | "responsable">(null);
    const [buttonForm, setButtonForm] = useState(false);
    const isFirmaMode = mode === "firma";
    const draftKey = useMemo(
        () => DRAFT_KEY(mode === "edit" ? walkaroundId : undefined),
        [mode, walkaroundId]
    );

    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const [form, setForm] = useState<SalidaFormData>({
        movimiento: "",
        matricula: "",
        tipo: "",
        tipoAeronave: "",
        marcaDanos: [],
        AeronaveId: 0,
        hora: "",
        destino: "",
        procedensia: "",
        fecha: today,
        checklistAvion: {},
        checklistHelicoptero: {},
        fotos: [],
        numeroEstatica: "",
        observaciones: "",
        elabora_departamento_id: "",
        elabora_personal_id: "",
        elabora: auth?.user?.name ?? "",
        responsable: "",
        jefeArea: "",
        fbo: "",
        firmaJefeAreaBase64: "",
        firmaFboBase64: "",
        firmaResponsableBase64: "",
        esNuevaMatricula: false,
    });
    const user = auth?.user;
    useEffect(() => {
        if (!user) return;

        setForm(prev => ({
            ...prev,
            elabora: user.name,
            elabora_personal_id: user.id,
        }));
    }, [user]);

    const currentComponent = usePage().component;
    const departamento = currentComponent.split('/')[0];
    const departamentoActual = useMemo(() => {
        if (!auth?.user) return null;

        const component = usePage().component.toLowerCase();
        // despacho/walkaround

        const componentRoute = component.replace('/', '.');
        // despacho.walkaround

        for (const dep of auth.user.departamentos) {
            for (const sub of dep.subdepartamentos) {
                if (componentRoute === sub.route.toLowerCase()) {
                    return dep.nombre;
                }
            }
        }

        return null;
    }, [auth?.user, usePage().component]);


    useEffect(() => {
        if (!open) return;
        if (buttonForm) return;
        if (!form.matricula && !form.movimiento) return;

        localStorage.setItem(
            draftKey,
            JSON.stringify({ form, step, timestamp: Date.now() })
        );
    }, [form, step, buttonForm, draftKey, open]);
    useEffect(() => {
        if (!open) return;
        if (initialData) return;

        const raw = localStorage.getItem(draftKey);
        if (!raw) return;

        try {
            const draft = JSON.parse(raw);
            if (!draft?.form) return;

            Swal.fire({
                icon: "question",
                title: "Borrador encontrado",
                text: "Se encontró un formulario sin guardar. ¿Deseas continuar donde lo dejaste?",
                showCancelButton: true,
                confirmButtonText: "Sí, continuar",
                cancelButtonText: "No, empezar de nuevo",
            }).then(async (res) => {
                if (res.isConfirmed) {
                    setForm(draft.form);
                    setStep(draft.step ?? 1);

                    if (draft.form.matricula) {
                        await refrescarDatosMatricula(draft.form.matricula);
                    }
                } else {
                    localStorage.removeItem(draftKey);
                }
            });
        } catch {
            localStorage.removeItem(draftKey);
        }
    }, [open, draftKey, initialData]);

    useEffect(() => {
        fetch("/api/walkarounds/departamentos")
            .then(res => res.json())
            .then(setDepartamentos)
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!form.elabora_departamento_id) {
            setPersonal([]);
            return;
        }

        fetch(`/api/walkarounds/personal?departamento_id=${form.elabora_departamento_id}`)
            .then(res => res.json())
            .then(setPersonal)
            .catch(console.error);
    }, [form.elabora_departamento_id]);
    /** Precarga (modo edit) */
    useEffect(() => {
        if (!initialData) return;

        setForm((prev) => ({
            ...prev,
            ...initialData,
            checklistAvion: initialData.checklistAvion ?? prev.checklistAvion,
            checklistHelicoptero: initialData.checklistHelicoptero ?? prev.checklistHelicoptero,
            marcaDanos: initialData.marcaDanos ?? prev.marcaDanos,
            fotos: initialData.fotos ?? prev.fotos,
            numeroEstatica: initialData.numeroEstatica ?? prev.numeroEstatica,
            firmaJefeAreaBase64: initialData.firmaJefeAreaBase64 ?? prev.firmaJefeAreaBase64,
            firmaFboBase64: initialData.firmaFboBase64 ?? prev.firmaFboBase64,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    /** Reseteos cuando cambia tipo */
    const prevTipoRef = useRef<string>("");
    const refrescarDatosMatricula = async (matricula: string) => {
        try {
            const res = await fetch(`/api/aeronaves/buscar/${matricula}`);
            if (!res.ok) return;

            const data = await res.json();

            const tipo =
                data.idTipoAeronave === 1
                    ? "avion"
                    : data.idTipoAeronave === 2
                        ? "helicoptero"
                        : "";

            const movimiento =
                data.movimiento === "salida"
                    ? "entrada"
                    : data.movimiento === "entrada"
                        ? "salida"
                        : "";

            setForm((prev) => ({
                ...prev,
                movimiento,
                destino: data.destino ?? "",
                procedensia: data.procedensia ?? "",
                tipo,
                AeronaveId: data.idTipoAeronave ?? prev.AeronaveId,
                esNuevaMatricula: false,
            }));
        } catch (e) {
            console.error("Error refrescando matrícula", e);
        }
    };
    useEffect(() => {
        const prevTipo = prevTipoRef.current;
        const nextTipo = form.tipo;

        if (!prevTipo) {
            prevTipoRef.current = nextTipo;
            return;
        }

        if (prevTipo === nextTipo) return;

        setForm((prev) => {
            if (nextTipo === "avion") {
                return { ...prev, checklistHelicoptero: {}, marcaDanos: [] };
            }
            if (nextTipo === "helicoptero") {
                return { ...prev, checklistAvion: {}, marcaDanos: [] };
            }
            return { ...prev, checklistAvion: {}, checklistHelicoptero: {}, marcaDanos: [] };
        });

        prevTipoRef.current = nextTipo;
    }, [form.tipo]);

    /** Cargar tipos */
    useEffect(() => {
        const loadTipos = async () => {
            try {
                const data = await fetchTiposAeronaveApi();
                setTiposAeronave(data);
            } catch (err) {
                console.error("Error al cargar tipos de aeronave", err);
            }
        };
        loadTipos();
    }, []);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]:
                name === "numeroEstatica"
                    ? value === ""
                        ? ""
                        : Number(value)
                    : value,
        }));
    };

    useEffect(() => {
        if (form.movimiento === "entrada") {
            setForm(prev => ({ ...prev, destino: "" }));
        }

        if (form.movimiento === "salida") {
            setForm(prev => ({ ...prev, procedensia: "" }));
        }
    }, [form.movimiento]);

    /**  Checklist completo: cada pregunta debe tener al menos 1 opción */



    const fotosActivasCount = form.fotos.filter((f) => {
        if (f.kind === "new") return true;
        return (f.status ?? "A") === "A";
    }).length;

    const fotosIncompletas = fotosActivasCount < 4;

    const progressLabel = useMemo(() => {
        const map: Record<Step, string> = {
            1: "Información",
            2: "Checklist",
            3: "Daños",
            4: "Firmas",
        };
        return map[step];
    }, [step]);

    const canGoNext = () => {
        const errores = validarPaso(step, form);

        if (errores.length) {
            Swal.fire({
                icon: "warning",
                title: "Faltan datos",
                html: `<ul style="text-align:left;padding-left:18px">
                    ${errores.map((e) => `<li>${e}</li>`).join("")}
                </ul>`,
            });
            return false;
        }

        return true;
    };

    const nextStep = () => {
        if (!canGoNext()) return;
        setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
    };

    const prevStep = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setButtonForm(true);

        const errores = validarWalkAroundFinal(form);

        if (errores.length) {

            Swal.fire({
                icon: "warning",
                title: "Faltan datos",
                html: `<ul style="text-align:left;padding-left:18px">
                    ${errores.map((e) => `<li>${e}</li>`).join("")}
                </ul>`,
            });
            setButtonForm(false);
            return;
        }


        try {
            const fotosNuevasBase64 = form.fotos
                .filter((f) => f.kind === "new")
                .map((f) => f.dataUrl);

            const imagenesDesactivarIds =
                mode === "edit"
                    ? form.fotos
                        .filter((f) => f.kind === "existing" && (f.status ?? "A") === "N")
                        .map((f) => (f as any).id)
                    : [];

            const payload = {
                ...form,
                fotos: fotosNuevasBase64,
                desactivar_imagen_ids: imagenesDesactivarIds,
            };

            const resp =
                mode === "edit"
                    ? await updateWalkaroundApi(walkaroundId!, payload)
                    : await guardarWalkAroundApi(payload);

            await Swal.fire({
                icon: "success",
                title: mode === "edit" ? "WalkAround actualizado" : "WalkAround guardado",
            });
            localStorage.removeItem(draftKey);
            onSaved?.();
            onClose?.();
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: err?.message || "No se pudo guardar el WalkAround",
            });
        } finally {
            setButtonForm(false);
        }
    };

    const fechaLabel = (() => {
        const raw = String(form.fecha ?? "");
        const iso = raw.includes("T") ? raw.split("T")[0] : raw;
        const [y, m, d] = iso.split("-");
        return y && m && d ? `${d}/${m}/${y}` : raw;
    })();

    const fechaDateInput = (() => {
        const raw = String(form.fecha ?? "");
        return raw.includes("T") ? raw.split("T")[0] : raw;
    })();

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isFirmaMode} className="space-y-4">
                {/* Header Wizard */}
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">WalkAround</h2>
                            <p className="text-xs text-gray-500">
                                Paso {step} / 4 · {progressLabel}
                            </p>
                        </div>
                        <span className="rounded-full bg-gray-200 px-3 py-1 text-xs dark:bg-gray-800">
                            Fecha: {fechaLabel}
                        </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                            className="h-full bg-gray-900 dark:bg-gray-100"
                            style={{ width: `${(step / 4) * 100}%` }}
                        />
                    </div>
                </div>

                {/* ====== STEP 1 ====== */}
                {step === 1 && (
                    <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 dark:bg-slate-900/40">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold">Información general</h2>
                                <p className="text-xs text-gray-500">Datos del movimiento</p>
                            </div>
                        </div>

                        <div className="mb-4 rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
                            <div className="grid gap-4 md:grid-cols-2 items-end">
                                {/* ===== Matrícula ===== */}
                                <MatriculaAutocomplete
                                    matricula={form.matricula}
                                    onMatriculaChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            matricula: value,
                                            esNuevaMatricula: false,
                                        }))
                                    }
                                    onNuevaMatricula={() =>
                                        setForm((prev) => ({
                                            ...prev,
                                            esNuevaMatricula: true,
                                            AeronaveId: 0,
                                            tipo: "",
                                            destino: "",
                                            procedensia: "",
                                            hora: "",
                                        }))
                                    }
                                    onAeronaveData={(data) =>
                                        setForm((prev) => {

                                            const tipo =
                                                data.idTipoAeronave === 1
                                                    ? "avion"
                                                    : data.idTipoAeronave === 2
                                                        ? "helicoptero"
                                                        : "";

                                            const movimiento =
                                                data.movimiento === "salida"
                                                    ? "entrada"
                                                    : data.movimiento === "entrada"
                                                        ? "salida"
                                                        : "sm";
                                            const esNueva = movimiento === "sm" ? true : false;
                                            const aeronave = {
                                                tipoAeronave: data.tipo_aeronave,
                                                idTipoAeronave: data.idTipoAeronave,
                                            };
                                            return {
                                                ...prev,
                                                esNuevaMatricula: esNueva,
                                                matricula: data.matricula ?? prev.matricula,
                                                destino: data.destino ?? prev.destino,
                                                procedensia: data.procedensia ?? prev.procedensia,
                                                hora: data.hora ?? prev.hora,
                                                AeronaveId: data.idTipoAeronave ?? prev.AeronaveId,
                                                tipo,
                                                tipoAeronave: aeronave.tipoAeronave ?? prev.tipoAeronave,
                                                movimiento,
                                            };
                                        })
                                    }
                                />

                                {/* ===== Movimiento ===== */}
                                <div>
                                    <span className="block text-xs font-medium mb-2">
                                        Movimiento
                                    </span>
                                    <div className="flex gap-6 h-[44px] items-center">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="movimiento"
                                                value="entrada"
                                                checked={form.movimiento === "entrada"}
                                                onChange={handleChange}
                                                disabled={!form.esNuevaMatricula}
                                            />
                                            Entrada
                                        </label>

                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="movimiento"
                                                value="salida"
                                                checked={form.movimiento === "salida"}
                                                onChange={handleChange}
                                                disabled={!form.esNuevaMatricula}
                                            />
                                            Salida
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <div className="grid gap-1">
                                <label className="text-xs font-medium">Aeronave</label>
                                <select
                                    name="AeronaveId"
                                    value={form.AeronaveId}
                                    disabled={!form.esNuevaMatricula}
                                    onChange={(e) => {
                                        const id = Number(e.target.value);
                                        const tipoComputed =
                                            id === 1 ? "avion" : id === 2 ? "helicoptero" : "";

                                        setForm((prev) => ({
                                            ...prev,
                                            AeronaveId: id,
                                            tipo: tipoComputed,
                                        }));
                                    }}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm
                                        ${!form.esNuevaMatricula
                                            ? "cursor-not-allowed bg-gray-100 text-gray-600 dark:bg-gray-800"
                                            : "bg-white dark:bg-gray-900"
                                        }`}
                                >
                                    <option value="0">Seleccione una opción</option>
                                    {tiposAeronave.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-1">
                                <label className="text-xs font-medium">Tipo</label>
                                <input
                                    name="tipoAeronave"
                                    type="text"
                                    value={form.tipoAeronave}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            tipoAeronave: e.target.value.toUpperCase(),
                                        }))
                                    }
                                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-900 uppercase"
                                    placeholder="Tipo de aeronave"
                                />
                            </div>
                            <div className="grid gap-1">
                                <label className="text-xs font-medium">Hora</label>

                                <TimePickerInput24
                                    value={form.hora}
                                    onChange={(hora) =>
                                        setForm((prev) => ({ ...prev, hora }))
                                    }
                                />
                            </div>

                            <div className="grid gap-1">
                                <label className="text-xs font-medium">Destino</label>
                                <input
                                    name="destino"
                                    type="text"
                                    value={form.destino}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            destino: e.target.value.toUpperCase(),
                                        }))
                                    }
                                    disabled={form.movimiento === "entrada"}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm
                                        ${form.movimiento === "entrada"
                                            ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                            : "border-gray-300 dark:bg-gray-900 uppercase"
                                        }`}
                                    placeholder="Lugar de destino"
                                />
                            </div>

                            <div className="grid gap-1">
                                <label className="text-xs font-medium">Procedencia</label>
                                <input
                                    name="procedensia"
                                    type="text"
                                    value={form.procedensia}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            procedensia: e.target.value.toUpperCase(),
                                        }))
                                    }
                                    disabled={form.movimiento === "salida"}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm
                                    ${form.movimiento === "salida"
                                            ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                            : "border-gray-300 dark:bg-gray-900 uppercase"
                                        }`}
                                    placeholder="Lugar de procedencia"
                                />
                            </div>

                            <div className="grid gap-1">
                                <label htmlFor="fecha" className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                    Fecha (hoy)
                                </label>
                                <input
                                    id="fecha"
                                    type="date"
                                    value={fechaDateInput}
                                    disabled
                                    className="w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-3 py-2
                                    text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                />
                                <input type="hidden" name="fecha" value={fechaDateInput} />
                            </div>
                        </div>
                    </section>
                )}

                {/* ====== STEP 2 ====== */}
                {step === 2 && (
                    <section className="rounded-xl border p-4 dark:border-gray-700 dark:bg-slate-900/40 space-y-4">
                        {form.tipo === "avion" && (
                            <ChecklistAvion
                                value={form.checklistAvion}
                                onChange={(respuestas) => setForm((prev) => ({
                                    ...prev,
                                    checklistAvion: respuestas
                                }))
                                }
                                fotos={form.fotos}
                                onChangeFotos={(fotos) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        fotos,
                                    }))
                                }
                            />
                        )}

                        {form.tipo === "helicoptero" && (
                            <ChecklistHelicoptero
                                value={form.checklistHelicoptero}
                                onChange={(respuestas) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        checklistHelicoptero: respuestas,
                                    }))
                                }
                                fotos={form.fotos}
                                onChangeFotos={(fotos) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        fotos,
                                    }))
                                }
                            />
                        )}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label className="text-xs font-medium">Numero de estaticas</label>
                                <input
                                    name="numeroEstatica"
                                    type="number"
                                    value={form.numeroEstatica}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900"
                                />
                            </div>
                        </div>
                    </section>
                )}
                {step === 3 && (
                    <section className="rounded-xl border p-4 dark:border-gray-700 dark:bg-slate-900/40 space-y-4">
                        <div>
                            <h2 className="text-base font-semibold">Mapa de daños</h2>
                            <p className="text-xs text-gray-500">
                                Marque visualmente los daños detectados en la aeronave
                            </p>
                        </div>

                        {form.tipo === "avion" && (
                            <MapaDanios3D
                                value={form.marcaDanos}
                                onChange={(danos) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        marcaDanos: danos,
                                    }))
                                }
                                modelSrc="/models/Avion.obj"
                            />
                        )}

                        {form.tipo === "helicoptero" && (
                            <MapaDanios3D
                                value={form.marcaDanos}
                                onChange={(danos) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        marcaDanos: danos,
                                    }))
                                }
                                modelSrc="/models/18706 Fighter Helicopter_v1.obj"
                            />
                        )}

                        {form.marcaDanos.length === 0 && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                No se han marcado daños (opcional).
                            </p>
                        )}
                    </section>
                )}
                {/* ====== STEP 4 ====== */}
                {step === 4 && (
                    <section className="rounded-xl border p-4 dark:border-gray-700 dark:bg-slate-900/40">
                        <h2 className="mb-3 text-base font-semibold">Observaciones y firmas</h2>

                        <div className="mb-4">
                            <label className="text-xs font-medium">Observaciones</label>
                            <textarea
                                name="observaciones"
                                value={form.observaciones}
                                onChange={handleChange}
                                className="min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900"
                            />
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                            {/* ===== Elabora (SIN firma) ===== */}
                            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 space-y-2">
                                <label className="text-xs font-medium">Elabora</label>

                                <input
                                    type="text"
                                    value={form.elabora}
                                    disabled
                                    className="w-full rounded-lg border px-3 py-2 text-sm
                                        bg-gray-100 text-gray-700 cursor-not-allowed
                                        dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                                />

                                {departamentoActual && (
                                    <p className="text-[11px] text-gray-500">
                                        Departamento: <span className="font-semibold">{departamentoActual}</span>
                                    </p>
                                )}
                            </div>

                            {/* ===== Responsable (CON firma) ===== */}
                            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                    <label className="text-xs font-medium">Responsable</label>

                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            name="responsable"
                                            type="text"
                                            value={form.responsable}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    responsable: e.target.value.toUpperCase(),
                                                }))
                                            }
                                            disabled={false}
                                            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 uppercase"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setOpenFirma("responsable")}
                                            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                        >
                                            Firmar
                                        </button>
                                    </div>
                                </div>

                                {form.firmaResponsableBase64 ? (
                                    <div className="mt-3 flex items-center gap-2">
                                        <img
                                            src={form.firmaResponsableBase64}
                                            alt="Firma Responsable"
                                            className="h-14 w-40 rounded-md border bg-white object-contain p-1 dark:border-gray-700"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setOpenFirma("responsable")}
                                            className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-gray-700"
                                        >
                                            Ver
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm((p) => ({ ...p, firmaResponsableBase64: "" }))
                                            }
                                            className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-600 dark:border-gray-700"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-gray-500">Firma pendiente.</p>
                                )}
                            </div>
                            {/* ===== Jefe de área ===== */}
                            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                <label className="text-xs font-medium">Jefe de área</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        name="jefeArea"
                                        type="text"
                                        value={form.jefeArea}
                                        onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    jefeArea: e.target.value.toUpperCase(),
                                                }))
                                            }
                                        className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 uppercase"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setOpenFirma("jefe")}
                                        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                    >
                                        Firmar
                                    </button>
                                </div>

                                {form.firmaJefeAreaBase64 ? (
                                    <div className="mt-3 flex items-center gap-2">
                                        <img
                                            src={form.firmaJefeAreaBase64}
                                            alt="Firma Jefe de área"
                                            className="h-14 w-40 rounded-md border bg-white object-contain p-1 dark:border-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setOpenFirma("jefe")}
                                            className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-gray-700"
                                        >
                                            Ver
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm((p) => ({ ...p, firmaJefeAreaBase64: "" }))
                                            }
                                            className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-600 dark:border-gray-700"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-gray-500">Firma pendiente.</p>
                                )}
                            </div>

                            {/* ===== FBO ===== */}
                            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                <label className="text-xs font-medium">VoBo FBO</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        name="fbo"
                                        type="text"
                                        value={form.fbo}
                                        onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    fbo: e.target.value.toUpperCase(),
                                                }))
                                            }
                                        className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 uppercase"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setOpenFirma("fbo")}
                                        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                    >
                                        Firmar
                                    </button>
                                </div>

                                {form.firmaFboBase64 ? (
                                    <div className="mt-3 flex items-center gap-2">
                                        <img
                                            src={form.firmaFboBase64}
                                            alt="Firma FBO"
                                            className="h-14 w-40 rounded-md border bg-white object-contain p-1 dark:border-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setOpenFirma("fbo")}
                                            className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-gray-700"
                                        >
                                            Ver
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm((p) => ({ ...p, firmaFboBase64: "" }))
                                            }
                                            className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-600 dark:border-gray-700"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-gray-500">Firma pendiente.</p>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* ====== Navegación ====== */}
                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white/80 py-3 backdrop-blur dark:border-gray-700 dark:bg-slate-950/40">
                    <div className="flex gap-2">
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg bg-gray-300 px-5 py-2.5 text-sm dark:bg-gray-700"
                            >
                                Cerrar
                            </button>
                        )}

                        {step > 1 && (
                            <button
                                type="button"
                                onClick={prevStep}
                                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold
                hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                            >
                                ← Anterior
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {step < 4 && (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
                            >
                                Siguiente →
                            </button>
                        )}

                        {step === 4 && (
                            <button
                                type="submit"
                                disabled={buttonForm}
                                className={`rounded-lg px-5 py-2.5 text-sm font-semibold
                                    ${buttonForm
                                        ? "cursor-not-allowed bg-gray-300 text-gray-600 dark:bg-gray-800"
                                        : "bg-primary text-white hover:opacity-90"
                                    }`}
                            >
                                {buttonForm ? "Guardando..." : "Guardar registro"}
                            </button>
                        )}
                    </div>
                </div>
                <SignaturePadModal
                    open={openFirma === "jefe"}
                    title="Firma Jefe de área"
                    value={form.firmaJefeAreaBase64}
                    onClose={() => setOpenFirma(null)}
                    onChange={(b64) => setForm((p) => ({ ...p, firmaJefeAreaBase64: b64 }))}
                />

                <SignaturePadModal
                    open={openFirma === "fbo"}
                    title="Firma VoBo FBO"
                    value={form.firmaFboBase64}
                    onClose={() => setOpenFirma(null)}
                    onChange={(b64) => setForm((p) => ({ ...p, firmaFboBase64: b64 }))}
                />
                <SignaturePadModal
                    open={openFirma === "responsable"}
                    title="Firma Responsable"
                    value={form.firmaResponsableBase64}
                    onClose={() => setOpenFirma(null)}
                    onChange={(b64) =>
                        setForm((p) => ({ ...p, firmaResponsableBase64: b64 }))
                    }
                />
            </fieldset>
        </form>

    );
}
