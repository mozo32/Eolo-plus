import { useEffect, useRef } from "react";
import { useAeronaveStore } from "@/stores/useAeronaveStore";

export interface AeronaveApiData {
    matricula?: string;
    destino?: string | null;
    procedensia?: string | null;
    hora?: string | null;
    idTipoAeronave?: number | null;
    movimiento?: string | null;
    tipo_aeronave?: string | null;
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

    const selectingRef = useRef(false);

    const userTypingRef = useRef(false);
    useEffect(() => {
        if (
            selectingRef.current ||
            !userTypingRef.current ||
            !matricula ||
            loadingSuggestions ||
            suggestions.length > 0
        ) {
            return;
        }

        onNuevaMatricula?.();
    }, [suggestions, loadingSuggestions, matricula]);
    useEffect(() => {
        if (
            !userTypingRef.current ||
            !matricula ||
            selectingRef.current
        ) {
            clearSuggestions();
            return;
        }

        const timeout = setTimeout(() => {
            void fetchSuggestions(matricula);
        }, 250);

        return () => clearTimeout(timeout);
    }, [matricula, fetchSuggestions, clearSuggestions]);

    const handleSelect = async (mat: string) => {
        selectingRef.current = true;
        userTypingRef.current = false;

        onMatriculaChange(mat);

        if (onAeronaveData) {
            const data = await fetchAeronave(mat);
            if (data) onAeronaveData(data);
        }

        clearSuggestions();

        setTimeout(() => {
            selectingRef.current = false;
        }, 0);
    };
    const EntradaIcon = () => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4cd964"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M15.157 11.81l4.83 1.295a2 2 0 1 1 -1.036 3.863l-14.489 -3.882l-1.345 -6.572l2.898 .776l1.414 2.45l2.898 .776l-.12 -7.279l2.898 .777l2.052 7.797z" />
            <path d="M3 21h18" />
        </svg>
    );

    const SalidaIcon = () => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ff3b30"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M14.639 10.258l4.83 -1.294a2 2 0 1 1 1.035 3.863l-14.489 3.883l-4.45 -5.02l2.897 -.776l2.45 1.414l2.897 -.776l-3.743 -6.244l2.898 -.777l5.675 5.727z" />
            <path d="M3 21h18" />
        </svg>

    );
    const NuevoIcon = () => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M3.59 7h8.82a1 1 0 0 1 .902 1.433l-1.44 3a1 1 0 0 1 -.901 .567h-5.942a1 1 0 0 1 -.901 -.567l-1.44 -3a1 1 0 0 1 .901 -1.433" />
            <path d="M6 7l-.78 -2.342a.5 .5 0 0 1 .473 -.658h4.612a.5 .5 0 0 1 .475 .658l-.78 2.342" />
            <path d="M8 2v2" />
            <path d="M6 12v9h4v-9" />
            <path d="M3 21h18" />
            <path d="M22 5h-6l-1 -1" />
            <path d="M18 3l2 2l-2 2" />
            <path d="M10 17h7a2 2 0 0 1 2 2v2" />
        </svg>
    );
    return (
        <div className="relative grid gap-2">
            <label
                htmlFor="matricula"
                className="text-xs font-medium text-gray-700 dark:text-gray-200"
            >
                Matrícula
            </label>

            <input
                id="matricula"
                name="matricula"
                type="text"
                value={matricula}
                onChange={(e) => {
                    userTypingRef.current = true;
                    onMatriculaChange(e.target.value.toUpperCase());
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base
                    outline-none focus:border-primary focus:ring-1 focus:ring-primary
                    dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Ingrese la matrícula"
                autoComplete="off"
            />

            {loadingSuggestions && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    Buscando...
                </div>
            )}

            {suggestions.length > 0 && (
                <div
                    className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto
                        rounded-lg border border-gray-200 bg-white shadow
                        dark:border-gray-700 dark:bg-gray-900"
                >
                    {suggestions.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => void handleSelect(s.matricula)}
                            className="flex w-full items-center justify-between px-4 py-3
                                text-left text-base hover:bg-gray-50
                                dark:hover:bg-gray-800"
                        >
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {s.matricula}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">

                                {s.movimiento === null && 'Nueva'}
                                {s.movimiento === "entrada" && <EntradaIcon />}
                                {s.movimiento === "salida" && <SalidaIcon />}
                                {s.movimiento === null && <NuevoIcon />}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
