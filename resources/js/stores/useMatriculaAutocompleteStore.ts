// useMatriculaAutocompleteStore.ts
import { create } from "zustand";

interface AeronaveSuggestion {
    id: number;
    matricula: string;
}

interface MatriculaAutocompleteState {
    matricula: string;
    tipoAeronave: string | null;
    suggestions: AeronaveSuggestion[];
    loading: boolean;
    loadingTipo: boolean;
    setMatricula: (value: string) => void;
    buscar: (value: string) => Promise<AeronaveSuggestion[]>; // Cambiado a Promise<AeronaveSuggestion[]>
    obtenerTipo: (matricula: string) => Promise<void>;
    clear: () => void;
}

export const useMatriculaAutocompleteStore = create<MatriculaAutocompleteState>((set) => ({
    matricula: "",
    tipoAeronave: null,
    suggestions: [],
    loading: false,
    loadingTipo: false,

    setMatricula: (value) => set({ matricula: value }),

    buscar: async (value: string) => {
        if (!value) {
            set({ suggestions: [] });
            return [];
        }

        set({ loading: true });

        try {
            const res = await fetch(`/api/aeronaves/autocomplete?q=${encodeURIComponent(value)}`);

            if (!res.ok) {
                set({ suggestions: [], loading: false });
                return [];
            }

            const data = await res.json();
            set({ suggestions: data, loading: false });
            return data; // <--- VITAL: Retornar los datos para el uso local
        } catch (error) {
            console.error(error);
            set({ suggestions: [], loading: false });
            return [];
        }
    },

    obtenerTipo: async (matricula: string) => {
        if (!matricula) return;
        set({ loadingTipo: true });
        try {
            const res = await fetch(`/api/aeronaves/tipo/${encodeURIComponent(matricula)}`);
            if (!res.ok) {
                set({ tipoAeronave: null, loadingTipo: false });
                return;
            }
            const data = await res.json();
            set({ tipoAeronave: data.tipo ?? null, loadingTipo: false });
        } catch (error) {
            console.error(error);
            set({ tipoAeronave: null, loadingTipo: false });
        }
    },

    clear: () => set({ suggestions: [] }),
}));
