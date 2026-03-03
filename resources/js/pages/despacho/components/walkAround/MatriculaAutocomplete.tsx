import React, { useEffect, useRef } from 'react';
import { useAeronaveStore } from '@/stores/useAeronaveStore';

export interface AeronaveApiData {
    matricula?: string;
    destino?: string | null;
    procedensia?: string | null;
    hora?: string | null;
    idTipoAeronave?: number | null;
    movimiento?: string | null;
    tipo_aeronave?: string | null;
    tipo?: string;
}

interface MatriculaAutocompleteProps {
    matricula: string;
    onMatriculaChange: (value: string) => void;
    onAeronaveData?: (data: AeronaveApiData) => void;
    onNuevaMatricula?: () => void;
}

export default function MatriculaAutocomplete({
    matricula,
    onMatriculaChange,
    onAeronaveData,
    onNuevaMatricula,
}: MatriculaAutocompleteProps) {
    const {
        suggestions,
        loadingSuggestions,
        fetchSuggestions,
        fetchAeronave,
        clearSuggestions,
    } = useAeronaveStore();

    const userTypingRef = useRef(false);

    // --- LÓGICA DE FORMATO ---
    const aplicarFormato = (input: string, prev: string): string => {
        // Limpiamos espacios y convertimos a mayúsculas
        let val = input.toUpperCase().replace(/\s/g, "");

        // Si el usuario está borrando (longitud menor a la anterior), no aplicamos formato
        // para permitir que borre el guion.
        if (val.length < (prev || "").length) return val;

        const prefijos2 = ["XA", "XB", "XC", "EC", "CC", "LV", "LQ", "HK", "HJ", "TG", "TI", "HC", "YV", "ZP", "OB"];

        // Caso 1: Exactamente 2 letras de prefijo -> agregar guion
        if (val.length === 2 && prefijos2.includes(val)) {
            return `${val}-`;
        }

        // Caso 2: Escribió más de 2 letras pero olvidó el guion (ej: pegado de texto)
        if (val.length > 2 && !val.includes("-")) {
            const possiblePrefix = val.substring(0, 2);
            if (prefijos2.includes(possiblePrefix)) {
                return `${possiblePrefix}-${val.substring(2)}`;
            }
        }

        return val;
    };

    // --- HANDLERS ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        userTypingRef.current = true;

        // Aplicamos el formato usando el valor actual del input vs el valor que ya teníamos
        const formattedValue = aplicarFormato(e.target.value, matricula);

        // Notificamos al componente padre
        onMatriculaChange(formattedValue);

        // Disparar búsqueda de sugerencias si hay contenido
        if (formattedValue.length > 1) {
            void fetchSuggestions(formattedValue);
        } else {
            clearSuggestions();
        }
    };

    const handleSelect = async (mat: string) => {
        userTypingRef.current = false;
        const matUpper = mat.toUpperCase();

        onMatriculaChange(matUpper);
        clearSuggestions();

        if (onAeronaveData) {
            const data = await fetchAeronave(matUpper);
            if (data) onAeronaveData(data);
        }
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <input
                    id="matricula"
                    type="text"
                    value={matricula}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-700 font-medium focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 outline-none transition-all placeholder:text-slate-300 shadow-sm text-sm uppercase"
                    placeholder="XA-ABC"
                    autoComplete="off"
                />

                {loadingSuggestions && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {/* Lista de Sugerencias */}
            {suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {suggestions.map((s) => (
                        <li
                            key={s.id}
                            onClick={() => void handleSelect(s.matricula)}
                            className="px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-none"
                        >
                            <span className="font-bold text-slate-800">{s.matricula.toUpperCase()}</span>
                            {s.movimiento && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    s.movimiento === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {s.movimiento}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
