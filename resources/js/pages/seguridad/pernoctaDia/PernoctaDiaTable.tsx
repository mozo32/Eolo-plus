import React from "react";
import { PernoctaDiaItem } from "./PernoctaDiaForm";
import {
    CalendarDays,
    FileText,
    MapPin,
    Plane,
    Trash2,
    User,
} from "lucide-react";

interface Props {
    items: PernoctaDiaItem[];
    onRemove: (index: number) => void;
}

const formatearFecha = (fecha: string) => {
    if (!fecha) {
        return "Sin fecha";
    }

    const [year, month, day] = fecha.split("-");

    if (!year || !month || !day) {
        return fecha;
    }

    return `${day}/${month}/${year}`;
};

const PernoctaDiaTable: React.FC<Props> = ({
    items,
    onRemove,
}) => {
    if (!items.length) {
        return (
            <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-50" />
                <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-slate-100" />

                <div className="relative flex min-h-[190px] flex-col items-center justify-center px-6 py-10 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-500">
                        <Plane size={25} />
                    </div>

                    <h5 className="text-xs font-black uppercase tracking-tight text-slate-700">
                        Lista de pernocta vacía
                    </h5>

                    <p className="mt-1 max-w-md text-[10px] font-medium leading-relaxed text-slate-400">
                        Las aeronaves agregadas aparecerán en esta sección
                        antes de guardar la pernocta.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {items.map((item, index) => (
                <div
                    key={`${item.matricula}-${index}`}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                    <div className="absolute bottom-0 left-0 top-0 w-1 bg-indigo-500" />

                    <div className="p-4 pl-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                                    <Plane size={19} />

                                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 px-1 text-[7px] font-black text-white">
                                        {index + 1}
                                    </span>
                                </div>

                                <div className="min-w-0">
                                    <p className="truncate text-base font-black uppercase tracking-wider text-slate-800">
                                        {item.matricula}
                                    </p>

                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[8px] font-black uppercase text-indigo-600">
                                            <MapPin size={9} />

                                            {item.ubicacion === "H1"
                                                ? "Hangar 1"
                                                : "Hangar 2"}
                                        </span>

                                        <span className="inline-flex items-center gap-1 text-[8px] font-bold text-slate-400">
                                            <CalendarDays size={9} />
                                            {formatearFecha(item.fecha)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => onRemove(index)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-300 transition-all hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500 active:scale-90"
                                title="Quitar aeronave"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                            <div className="flex items-start gap-2">
                                <User
                                    size={13}
                                    className="mt-0.5 shrink-0 text-slate-400"
                                />

                                <div className="min-w-0">
                                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">
                                        Responsable
                                    </p>

                                    <p className="mt-0.5 truncate text-[10px] font-bold text-slate-700">
                                        {item.nombre || "Sin responsable"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <FileText
                                    size={13}
                                    className="mt-0.5 shrink-0 text-slate-400"
                                />

                                <div className="min-w-0">
                                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">
                                        Observaciones
                                    </p>

                                    <p
                                        className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-relaxed text-slate-600"
                                        title={
                                            item.observaciones ||
                                            "Sin observaciones"
                                        }
                                    >
                                        {item.observaciones ||
                                            "Sin observaciones"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PernoctaDiaTable;
