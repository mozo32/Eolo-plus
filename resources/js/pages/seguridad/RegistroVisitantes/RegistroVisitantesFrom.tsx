import React, { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  PenTool,
  ShieldCheck,
  User,
} from "lucide-react";
import Swal from "sweetalert2";
import { guardarRegistroVisitantes } from "@/stores/apiRegistroVisitantes";
import FirmaCanvas from "@/pages/FirmaCanvas";

interface Props {
  onSuccess?: () => void;
}

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

const obtenerFechaActual = () => new Date().toLocaleDateString("en-CA");

function FirmaBox({
  label,
  value,
  onClick,
  disabled = false,
}: {
  label: string;
  value?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative flex h-36 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-indigo-400 hover:bg-indigo-50/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {value ? (
        <>
          <img
            src={value}
            alt={label}
            className="h-full w-full object-contain p-3"
          />
          <span className="absolute bottom-2 right-2 rounded bg-indigo-600 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
            Presione para cambiar
          </span>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-white p-3 shadow-sm transition-colors group-hover:bg-indigo-100">
            <PenTool
              size={20}
              className="text-slate-400 group-hover:text-indigo-600"
            />
          </div>
          <div className="text-center">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500">
              Capturar firma
            </span>
            <span className="mt-1 block text-[9px] font-bold text-slate-300">
              Presione para abrir el panel
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

const RegistroVisitantesForm = ({ onSuccess }: Props) => {
  const { auth } = usePage<{
    auth: { user: AuthUser | null };
  }>().props;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [guardando, setGuardando] = useState(false);
  const [openFirma, setOpenFirma] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    procedencia: "",
    a_quien_visita: "",
    gafete: "",
    tipo_gafete: "" as "" | "Rojo" | "Verde",
    empresa: "Eolo Plus",
    autoriza: auth?.user?.name ?? "",
    firma_entrada: "",
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!formData.autoriza && auth?.user?.name) {
      setFormData((previous) => ({
        ...previous,
        autoriza: auth.user?.name ?? "",
      }));
    }
  }, [auth?.user?.name, formData.autoriza]);

  const timeString = currentTime.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const dateString = currentTime.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.tipo_gafete) {
      await Swal.fire({
        icon: "warning",
        title: "Tipo de gafete requerido",
        text: "Seleccione si el gafete asignado es rojo o verde.",
        confirmButtonColor: "#4f46e5",
      });
      return;
    }

    if (!formData.firma_entrada) {
      await Swal.fire({
        icon: "warning",
        title: "Firma requerida",
        text: "Solicite la firma del visitante antes de registrar la entrada.",
        confirmButtonColor: "#4f46e5",
      });
      return;
    }

    const dataForm = {
      ...formData,
      horaEntrada: timeString,
      fechaRegistro: obtenerFechaActual(),
    };

    try {
      setGuardando(true);

      Swal.fire({
        title: "Procesando...",
        text: "Registrando la entrada del visitante",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await guardarRegistroVisitantes(dataForm);

      await Swal.fire({
        icon: "success",
        title: "Guardado correctamente",
        text: "La entrada del visitante fue registrada.",
        timer: 1400,
        showConfirmButton: false,
      });

      onSuccess?.();
    } catch (error: any) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo guardar",
        text: error?.message || "Ocurrió un error al registrar la entrada.",
        confirmButtonColor: "#4f46e5",
      });
    } finally {
      setGuardando(false);
    }
  };

  const formFields = [
    {
      label: "Nombre completo",
      icon: User,
      placeholder: "Ingrese el nombre del visitante",
      name: "nombre",
    },
    {
      label: "Procedencia",
      icon: Building2,
      placeholder: "Empresa o lugar de procedencia",
      name: "procedencia",
    },
    {
      label: "Persona a quien visita",
      icon: ShieldCheck,
      placeholder: "Nombre de quien recibe al visitante",
      name: "a_quien_visita",
    },
    {
      label: "Número de gafete",
      icon: CreditCard,
      placeholder: "Gafete asignado por seguridad",
      name: "gafete",
    },
  ];

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-[#f8fafc] p-4 md:p-6"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 lg:col-span-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-tight text-blue-900">
                Control de acceso de visitantes
              </h4>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Complete los datos para generar el pase de entrada
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Fecha y hora de entrada
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">
                {dateString}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-orange-600">
              <Clock size={14} className="animate-pulse" />
              <span className="text-[10px] font-black tracking-widest">
                {timeString}
              </span>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">
              Datos del visitante
            </h4>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Información general para el registro de entrada
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
            {formFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500"
                >
                  <field.icon size={13} className="text-indigo-500" />
                  {field.label}
                </label>
                <input
                  id={field.name}
                  type="text"
                  name={field.name}
                  value={formData[field.name as keyof typeof formData]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  required
                  disabled={guardando}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            ))}

            <fieldset className="space-y-2 md:col-span-2">
              <legend className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <CreditCard size={13} className="text-indigo-500" />
                Tipo de gafete
              </legend>

              <div
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Tipo de gafete"
              >
                {([
                  {
                    value: "Rojo" as const,
                    dotClass: "bg-red-500",
                    selectedClass:
                      "border-red-400 bg-red-50 text-red-700 ring-2 ring-red-100",
                  },
                  {
                    value: "Verde" as const,
                    dotClass: "bg-emerald-500",
                    selectedClass:
                      "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100",
                  },
                ]).map((opcion) => {
                  const seleccionado = formData.tipo_gafete === opcion.value;

                  return (
                    <button
                      key={opcion.value}
                      type="button"
                      role="radio"
                      aria-checked={seleccionado}
                      disabled={guardando}
                      onClick={() =>
                        setFormData((previous) => ({
                          ...previous,
                          tipo_gafete: opcion.value,
                        }))
                      }
                      className={`flex items-center justify-center gap-3 rounded-lg border px-4 py-3 text-xs font-black uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        seleccionado
                          ? opcion.selectedClass
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full ${opcion.dotClass}`}
                        aria-hidden="true"
                      />
                      Gafete {opcion.value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">
                  Firma del visitante
                </h4>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Solicite la firma dentro del recuadro
                </p>
              </div>
              <PenTool size={17} className="text-slate-400" />
            </div>

            <div className="p-5">
              <FirmaBox
                label="Firma del visitante"
                value={formData.firma_entrada}
                disabled={guardando}
                onClick={() => setOpenFirma(true)}
              />
            </div>
          </section>

          <section className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Empresa
                </p>
                <p className="mt-1 text-xs font-black uppercase text-slate-700">
                  {formData.empresa}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Autoriza el acceso
                </p>
                <p className="mt-1 text-xs font-black uppercase text-slate-700">
                  {formData.autoriza || "Usuario actual"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded border border-emerald-100 bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={15} />
              <span className="text-[9px] font-black uppercase tracking-wider">
                Información protegida
              </span>
            </div>
          </section>
        </div>

        <div className="flex justify-end rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="submit"
            disabled={guardando}
            className="flex w-full items-center justify-center gap-2 rounded bg-indigo-600 px-6 py-3 text-[10px] font-black text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none sm:w-auto"
          >
            {guardando ? "REGISTRANDO ENTRADA..." : "REGISTRAR ENTRADA"}
            {!guardando && <ChevronRight size={15} />}
          </button>
        </div>
      </form>

      <FirmaCanvas
        open={openFirma}
        title="Firma del visitante"
        value={formData.firma_entrada}
        onClose={() => setOpenFirma(false)}
        onChange={(base64: string) =>
          setFormData((previous) => ({
            ...previous,
            firma_entrada: base64,
          }))
        }
      />
    </>
  );
};

export default RegistroVisitantesForm;
