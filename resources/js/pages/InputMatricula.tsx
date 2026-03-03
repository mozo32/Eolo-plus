import { useEffect, useMemo } from "react";
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

    useEffect(() => {
        clear();

        return () => {
            clear();
            setMatricula("");
        };
    }, [clear, setMatricula]);

    const aplicarFormato = (input: string, prev: string): string => {
        let val = input.toUpperCase().replace(/\s/g, "");
        if (val.length < prev.length) return val;

        const prefijos2 = ["XA", "XB", "XC", "EC", "CC", "LV", "LQ", "HK", "HJ", "TG", "TI", "HC", "YV", "ZP", "OB"];

        if (val.length === 2 && prefijos2.includes(val)) {
            return `${val}-`;
        }
        if (val.length > 2 && !val.includes("-")) {
            const possiblePrefix = val.substring(0, 2);
            if (prefijos2.includes(possiblePrefix)) {
                return `${possiblePrefix}-${val.substring(2)}`;
            }
        }
        return val;
    };

    const status = useMemo(() => {
        if (!value) return { ok: true, msg: "" };
        const regexGeneral = /^[A-Z0-9]{1,3}-[A-Z0-9]{1,5}$/;
        const regexUSA = /^N[1-9][0-9A-Z]{0,4}$/;

        if (regexGeneral.test(value) || regexUSA.test(value)) {
            return { ok: true, msg: "Formato correcto" };
        }
        if (value.startsWith("N")) return { ok: true, msg: "Formato USA detectado" };
        if (value.length <= 3) return { ok: true, msg: "Ingresa el prefijo..." };

        return { ok: false, msg: "Formato inválido (Ej: XA-ABC o N12345)" };
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = aplicarFormato(e.target.value, value);
        setMatricula(newValue);
        onSelect(newValue);
        if (newValue.length > 1) {
            buscar(newValue);
        } else {
            clear();
        }
    };

    return (
        <div className="relative w-full">
            {label && (
                <label className={`block text-xs font-semibold mb-1 transition-colors ${
                    !status.ok && value.length > 3 ? 'text-red-600' : 'text-gray-700'
                }`}>
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    disabled={disabled}
                    required={required}
                    placeholder={placeholder}
                    className={`w-full rounded-lg border px-4 py-2 text-sm outline-none transition-all uppercase
                        ${!status.ok && value.length > 3
                            ? 'border-red-500 focus:ring-2 focus:ring-red-100'
                            : 'border-gray-300 focus:ring-2 focus:ring-blue-500'}`}
                />

                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {value && (
                <p className={`mt-1 text-[10px] font-medium ${status.ok ? 'text-blue-600' : 'text-red-500'}`}>
                    {status.msg}
                </p>
            )}

            {suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {suggestions.map((item) => (
                        <li
                            key={item.id}
                            onClick={() => {
                                const m = item.matricula.toUpperCase();
                                setMatricula(m);
                                obtenerTipo(m);
                                onSelect(m);
                                clear();
                            }}
                            className="px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b last:border-none"
                        >
                            <span className="font-bold text-gray-800">{item.matricula.toUpperCase()}</span>
                            <span className="text-[10px] text-gray-400">Sugerencia</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
