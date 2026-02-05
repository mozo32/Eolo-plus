import { useMatriculaAutocompleteStore } from "@/stores/useMatriculaAutocompleteStore";

interface Props {
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    value: string;
    onSelect: (matricula: string) => void;
}

export default function InputMatricula({
    label = "Matrícula",
    placeholder = "Escribe la matrícula…",
    disabled = false,
    required = false,
    value,
    onSelect,
}: Props) {
    const {
        suggestions,
        loading,
        buscar,
        obtenerTipo,
        setMatricula,
        clear,
    } = useMatriculaAutocompleteStore();

    return (
        <div className="relative w-full">
            {label && (
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                        const val = e.target.value;
                        setMatricula(val);
                        buscar(val);
                        onSelect(val); // ← mantiene sincronía
                    }}
                    disabled={disabled}
                    required={required}
                    placeholder={placeholder}
                    className="w-full rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />

                {loading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        Buscando…
                    </span>
                )}
            </div>

            {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg">
                    {suggestions.map((item) => (
                        <li
                            key={item.id}
                            onClick={() => {
                                setMatricula(item.matricula);
                                obtenerTipo(item.matricula);
                                onSelect(item.matricula);
                                clear();
                            }}
                            className="px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                        >
                            {item.matricula}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
