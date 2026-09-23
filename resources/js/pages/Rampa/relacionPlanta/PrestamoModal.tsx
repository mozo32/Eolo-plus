import InputMatricula from '@/pages/InputMatricula';
import { fechaHoy } from '@/pages/despacho/operacionesProgramadas/types';
import { obtenerEmpresasPlantaApi } from '@/stores/apiRelacionPlanta';
import { BatteryCharging, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EQUIPO_GPU, formatearHoras, type PrestamoPayload } from './types';

interface Props {
    /** Horómetro final del préstamo anterior: se sugiere como lectura inicial. */
    ultimoHorometroFin?: string | null;
    onCerrar: () => void;
    /** Devuelve true si se guardó; el modal se cierra solo en ese caso. */
    onGuardar: (payload: PrestamoPayload) => Promise<boolean>;
}

const CAMPO =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-[#00677F] focus:ring-1 focus:ring-[#00677F]';
const ETIQUETA = 'mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500';
const ERROR = 'mt-1 text-[10px] font-bold text-red-600';

/** Alta del préstamo: fecha local editable, empresa, matrícula y horómetro inicial. */
export default function PrestamoModal({ ultimoHorometroFin = null, onCerrar, onGuardar }: Props) {
    const [fecha, setFecha] = useState(() => fechaHoy());
    const [empresa, setEmpresa] = useState('');
    const [matricula, setMatricula] = useState('');
    // El horómetro es continuo: arranca en la lectura con la que cerró el anterior.
    const [horometro, setHorometro] = useState(() => (ultimoHorometroFin ? formatearHoras(ultimoHorometroFin) : ''));
    const [guardando, setGuardando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [empresas, setEmpresas] = useState<string[]>([]);

    // Sugerencias de empresas ya usadas en este módulo (no es un catálogo).
    useEffect(() => {
        obtenerEmpresasPlantaApi()
            .then(setEmpresas)
            .catch(() => setEmpresas([]));
    }, []);

    const validar = (): boolean => {
        const nuevos: Record<string, string> = {};

        if (!fecha) nuevos.fecha = 'La fecha es obligatoria.';
        if (!empresa.trim()) nuevos.empresa = 'La empresa es obligatoria.';
        if (!matricula.trim()) nuevos.matricula = 'La matrícula es obligatoria.';

        const h = Number(horometro);
        if (horometro === '' || !Number.isFinite(h)) nuevos.horometro = 'El horómetro inicial es obligatorio.';
        else if (h < 0) nuevos.horometro = 'El horómetro inicial no puede ser negativo.';

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando || !validar()) return;

        setGuardando(true);
        const ok = await onGuardar({
            fecha,
            empresa: empresa.trim(),
            matricula: matricula.trim().toUpperCase(),
            horometro_inicio: Math.round(Number(horometro) * 100) / 100,
        });
        setGuardando(false);

        if (ok) onCerrar();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCerrar} />
            <form
                onSubmit={enviar}
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
            >
                <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-emerald-100 p-2 text-emerald-600">
                            <BatteryCharging size={20} />
                        </span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight text-slate-800">Registrar préstamo</h3>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{EQUIPO_GPU}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </header>

                <div className="space-y-4 p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={ETIQUETA}>Fecha</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={CAMPO} required />
                            {errores.fecha && <p className={ERROR}>{errores.fecha}</p>}
                        </div>
                        <div>
                            <label className={ETIQUETA}>Horómetro inicial</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={horometro}
                                onChange={e => setHorometro(e.target.value)}
                                placeholder="125.30"
                                className={CAMPO}
                                required
                            />
                            {errores.horometro && <p className={ERROR}>{errores.horometro}</p>}
                            {ultimoHorometroFin && (
                                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                                    Último registrado en la entrega anterior: {formatearHoras(ultimoHorometroFin)}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className={ETIQUETA}>Empresa</label>
                        <input
                            type="text"
                            list="empresas-planta"
                            value={empresa}
                            onChange={e => setEmpresa(e.target.value.toUpperCase())}
                            placeholder="Nombre de la empresa"
                            className={`${CAMPO} uppercase`}
                            maxLength={120}
                            required
                        />
                        <datalist id="empresas-planta">
                            {empresas.map(nombre => (
                                <option key={nombre} value={nombre} />
                            ))}
                        </datalist>
                        {errores.empresa && <p className={ERROR}>{errores.empresa}</p>}
                    </div>

                    <div>
                        <InputMatricula label="Matrícula" value={matricula} onSelect={setMatricula} required />
                        {errores.matricula && <p className={ERROR}>{errores.matricula}</p>}
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={guardando}
                        className="rounded-xl bg-[#00677F] px-5 py-2 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#00586D] disabled:opacity-50"
                    >
                        {guardando ? 'Guardando…' : 'Registrar préstamo'}
                    </button>
                </footer>
            </form>
        </div>
    );
}
