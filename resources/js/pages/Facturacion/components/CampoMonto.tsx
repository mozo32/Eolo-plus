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
    /** Símbolo antes del valor; null lo quita (un porcentaje no lleva "$"). */
    prefijo?: string | null;
    /** Símbolo después del valor ("%"). */
    sufijo?: string;
}

/**
 * Campo de importe. Es de texto (no `type="number"`) para que "0" y "" lleguen
 * tal cual al padre: cero es una tarifa válida y vacío no lo es.
 */
export default function CampoMonto({ id, etiqueta, valor, onChange, error, obligatorio = false, placeholder = '0.00', ayuda, junto, pie, autoFocus, disabled, prefijo = '$', sufijo }: Props) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor={id} className={`${labelStyle} mb-0`}>
                    {etiqueta} {obligatorio && <span className="text-red-500">*</span>}
                </label>
                {junto}
            </div>

            <div className="relative">
                {prefijo && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-slate-400">{prefijo}</span>}
                {sufijo && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-slate-400">{sufijo}</span>}
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
                    className={`${campoConError(!!error)} ${prefijo ? 'pl-8' : ''} ${sufijo ? 'pr-10' : ''}`}
                />
            </div>

            {pie}
            {error && <p className={errorStyle}>{error}</p>}
            {ayuda && !error && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">{ayuda}</p>}
        </div>
    );
}
