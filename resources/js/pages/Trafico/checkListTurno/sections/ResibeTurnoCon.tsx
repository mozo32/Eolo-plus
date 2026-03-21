import { Package } from "lucide-react";
import { useEffect } from "react";

export const EQUIPOS = [
    { id: "areas_limpias", label: "Areas Limpias", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg> },
    { id: "periodicos", label: "Periódicos", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg> },
    { id: "mesa_vip", label: "Mesa VIP Llena", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12H3M5 12v6m14-6v6m-9-6V7a3 3 0 016 0v5" /></svg> },
    { id: "hielos", label: "Hielos Nuevos", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { id: "refrigerador", label: "Refrigerador Surtido", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-3-3v6" /></svg> },
    { id: "control_med", label: "Control de Med. Lleno", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    { id: "coffee_despacho", label: "Coffee B. Despacho", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg> },
    { id: "paraguas", label: "Cantidad de Paraguas", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v13m0 0l-3-3m3 3l3-3M5 19h14" /></svg> },
    { id: "formatos", label: "Formatos de Turno Llenos", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: "radios", label: "Radios Cargados", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v4" /></svg> },
    { id: "telefonos", label: "Telefonos Cargados", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
    { id: "cafeteras", label: "Cafeteras Preparadas", icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
];

type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function ResibeTurnoCon({ form, updateField }: Props) {
    useEffect(() => {
        const currentData = form.recibeTurnoCon || {};

        const fullData = EQUIPOS.reduce((acc, equipo) => {
            acc[equipo.id] = currentData[equipo.id] === true;
            return acc;
        }, {} as Record<string, boolean>);

        const needsInitialization = EQUIPOS.some(e => currentData[e.id] === undefined);

        if (needsInitialization) {
            updateField("recibeTurnoCon", fullData);
        }
    }, [form.recibeTurnoCon, updateField]);

    const toggleEquipo = (id: string) => {
        const isChecked = form.recibeTurnoCon?.[id] === true;
        updateField(`recibeTurnoCon.${id}`, !isChecked);
    };
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {EQUIPOS.map(({ id, label, icon }) => {
                const isChecked = form.recibeTurnoCon?.[id] === true;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => toggleEquipo(id)}
                        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-5 transition-all ${
                            isChecked ? "border-sky-600 bg-sky-50" : "border-slate-100 bg-white"
                        }`}
                    >
                        <div className={`h-5 w-5 rounded-full border-2 transition-colors ${
                            isChecked ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"
                        }`} />
                        <div className={isChecked ? "text-sky-600" : "text-slate-400 opacity-60"}>
                            {icon("h-8 w-8")}
                        </div>
                        <span className={`text-[10px] font-black uppercase text-center ${
                            isChecked ? "text-sky-900" : "text-slate-500"
                        }`}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
