import type { ReactNode } from 'react';
import { campoConError, errorStyle, labelStyle } from './estilos';

interface Props {
    id: string;
    etiqueta: string;
    valor: string;
    onChange: (valor: string) => void;
    error?: string;
    obligatorio?: boolean;
    placeholder?: string;
    /** Texto de apoyo bajo el campo. */
    ayuda?: ReactNode;
    /** Contenido al lado de la etiqueta (por ejemplo, la insignia de estado). */
    junto?: ReactNode;
    /** Contenido bajo el campo, antes del error (explicaciones de herencia, botones). */
    pie?: ReactNode;
    autoFocus?: boolean;
    disabled?: boolean;
}

/**
 * Campo de importe. Es de texto (no `type="number"`) para que "0" y "" lleguen
 * tal cual al padre: cero es una tarifa válida y vacío no lo es.
 */
export default function CampoMonto({ id, etiqueta, valor, onChange, error, obligatorio = false, placeholder = '0.00', ayuda, junto, pie, autoFocus, disabled }: Props) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor={id} className={`${labelStyle} mb-0`}>
                    {etiqueta} {obligatorio && <span className="text-red-500">*</span>}
                </label>
                {junto}
            </div>

            <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-slate-400">$</span>
                <input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus={autoFocus}
                    disabled={disabled}
                    value={valor}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-invalid={error ? true : undefined}
                    className={`${campoConError(!!error)} pl-8`}
                />
            </div>

            {pie}
            {error && <p className={errorStyle}>{error}</p>}
            {ayuda && !error && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">{ayuda}</p>}
        </div>
    );
}
