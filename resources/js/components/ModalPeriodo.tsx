import { X } from 'lucide-react';
import { useState } from 'react';
/** Modos del filtro de fechas, iguales a los de Operaciones Diarias. */
export const PERIODOS = ['dia', 'rango', 'mes', 'año'] as const;

export type PeriodoFiltro = (typeof PERIODOS)[number];

/** Lo mínimo que el modal necesita; cada módulo tiene sus propios filtros. */
export interface RangoPeriodo {
    periodo: PeriodoFiltro;
    fecha_inicio: string;
    fecha_fin: string;
}

interface Props {
    filtros: RangoPeriodo;
    /** Se aplica solo al presionar Aplicar, con el periodo y las fechas elegidos. */
    onAplicar: (cambio: RangoPeriodo) => void;
    onCerrar: () => void;
}

const CAMPO = 'w-full border border-slate-200 p-2 rounded-lg text-sm';

/** Último día del mes indicado (mes 1-12). */
const ultimoDiaDelMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();

/**
 * Selector de periodo: día, rango, mes o año. Misma estructura y clases que el
 * modal de fechas de Operaciones Diarias. Lo comparten Relación de planta y
 * Préstamo de chalecos.
 *
 * Se edita sobre un borrador y solo se aplica al presionar Aplicar.
 */
export default function ModalPeriodo({ filtros, onAplicar, onCerrar }: Props) {
    const [borrador, setBorrador] = useState(() => ({
        periodo: filtros.periodo,
        fecha_inicio: filtros.fecha_inicio,
        fecha_fin: filtros.fecha_fin,
    }));

    const cambiarPeriodo = (modo: PeriodoFiltro) => {
        setBorrador(actual => {
            const ahora = new Date();
            const anio = ahora.getFullYear();
            const numeroMes = ahora.getMonth() + 1;
            const mes = String(numeroMes).padStart(2, '0');

            if (modo === 'mes') {
                return {
                    ...actual,
                    periodo: modo,
                    fecha_inicio: `${anio}-${mes}-01`,
                    fecha_fin: `${anio}-${mes}-${String(ultimoDiaDelMes(anio, numeroMes)).padStart(2, '0')}`,
                };
            }

            if (modo === 'año') {
                return { ...actual, periodo: modo, fecha_inicio: `${anio}-01-01`, fecha_fin: `${anio}-12-31` };
            }

            return { ...actual, periodo: modo };
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCerrar} />

            <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-black uppercase text-slate-700">Período</h3>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 p-4">
                    <div className="flex rounded-lg bg-slate-100 p-1">
                        {PERIODOS.map(modo => (
                            <button
                                type="button"
                                key={modo}
                                onClick={() => cambiarPeriodo(modo)}
                                className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase transition-all ${
                                    borrador.periodo === modo ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {modo}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {borrador.periodo === 'dia' && (
                            <input
                                type="date"
                                className={CAMPO}
                                value={borrador.fecha_inicio}
                                onChange={e => setBorrador({ ...borrador, fecha_inicio: e.target.value, fecha_fin: e.target.value })}
                            />
                        )}

                        {borrador.periodo === 'rango' && (
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    className={CAMPO}
                                    value={borrador.fecha_inicio}
                                    onChange={e => setBorrador({ ...borrador, fecha_inicio: e.target.value })}
                                />
                                <input
                                    type="date"
                                    className={CAMPO}
                                    value={borrador.fecha_fin}
                                    onChange={e => setBorrador({ ...borrador, fecha_fin: e.target.value })}
                                />
                            </div>
                        )}

                        {borrador.periodo === 'mes' && (
                            <input
                                type="month"
                                className={CAMPO}
                                value={borrador.fecha_inicio.substring(0, 7)}
                                onChange={e => {
                                    const valor = e.target.value;

                                    if (!valor) {
                                        setBorrador({ ...borrador, fecha_inicio: '', fecha_fin: '' });
                                        return;
                                    }

                                    const [anioTexto, mesTexto] = valor.split('-');
                                    const ultimo = ultimoDiaDelMes(Number(anioTexto), Number(mesTexto));

                                    setBorrador({
                                        ...borrador,
                                        fecha_inicio: `${valor}-01`,
                                        fecha_fin: `${valor}-${String(ultimo).padStart(2, '0')}`,
                                    });
                                }}
                            />
                        )}

                        {borrador.periodo === 'año' && (
                            <input
                                type="number"
                                min="2020"
                                max="2100"
                                placeholder="Año"
                                className={CAMPO}
                                value={borrador.fecha_inicio ? borrador.fecha_inicio.split('-')[0] : ''}
                                onChange={e => {
                                    const anio = e.target.value;

                                    setBorrador({
                                        ...borrador,
                                        fecha_inicio: anio ? `${anio}-01-01` : '',
                                        fecha_fin: anio ? `${anio}-12-31` : '',
                                    });
                                }}
                            />
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onAplicar(borrador)}
                        className="w-full rounded-lg bg-slate-800 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
}
