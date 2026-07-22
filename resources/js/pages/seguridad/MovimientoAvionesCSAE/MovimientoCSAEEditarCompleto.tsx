import MovimientoCSAEEntrada from "./MovimientoCSAEEntrada";
import MovimientoCSAESalida from "./MovimientoCSAESalida";

interface Props {
    data: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    updateField: (key: string, value: any) => void;
}

export default function MovimientoCSAEEditarCompleto({
    data,
    onChange,
    updateField,
}: Props) {
    return (
        <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">
                        Datos de Entrada
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Información de ingreso de la aeronave
                    </p>
                </div>

                <div className="p-4">
                    <MovimientoCSAEEntrada
                        data={data}
                        onChange={onChange}
                        updateField={updateField}
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">
                        Datos de Salida
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Información de salida de la aeronave
                    </p>
                </div>

                <div className="p-4">
                    <MovimientoCSAESalida
                        data={data}
                        onChange={onChange}
                        updateField={updateField}
                    />
                </div>
            </div>
        </div>
    );
}
