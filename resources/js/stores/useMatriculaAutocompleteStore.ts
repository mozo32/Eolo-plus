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
    buscar: (value: string) => Promise<void>;
    obtenerTipo: (matricula: string) => Promise<void>;
    clear: () => void;
}

export const useMatriculaAutocompleteStore =
    create<MatriculaAutocompleteState>((set) => ({
        matricula: "",
        tipoAeronave: null,
        suggestions: [],
        loading: false,
        loadingTipo: false,

        setMatricula: (value) => set({ matricula: value }),

        // ================= AUTOCOMPLETE =================
        buscar: async (value: string) => {
            if (!value) {
                set({ suggestions: [] });
                return;
            }

            set({ loading: true });

            try {
                const res = await fetch(
                    `/api/aeronaves/autocomplete?q=${encodeURIComponent(value)}`
                );

                if (!res.ok) {
                    set({ suggestions: [], loading: false });
                    return;
                }

                const data = await res.json();
                set({ suggestions: data, loading: false });
            } catch (error) {
                console.error(error);
                set({ suggestions: [], loading: false });
            }
        },

        // ================= TIPO AERONAVE =================
        obtenerTipo: async (matricula: string) => {
            if (!matricula) return;

            set({ loadingTipo: true });

            try {
                const res = await fetch(
                    `/api/aeronaves/tipo/${encodeURIComponent(matricula)}`
                );

                if (!res.ok) {
                    set({ tipoAeronave: null, loadingTipo: false });
                    return;
                }

                const data = await res.json();
                // se asume { tipo: "JET" } o similar
                set({
                    tipoAeronave: data.tipo ?? null,
                    loadingTipo: false,
                });
            } catch (error) {
                console.error(error);
                set({ tipoAeronave: null, loadingTipo: false });
            }
        },

        // ================= LIMPIEZA =================
        clear: () =>
            set({
                suggestions: [],
            }),
    }));
