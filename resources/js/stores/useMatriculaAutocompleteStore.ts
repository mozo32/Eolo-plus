import { create } from 'zustand';

interface AeronaveSuggestion {
    id: number;
    matricula: string;
}

interface MatriculaAutocompleteState {
    matricula: string;
    suggestions: AeronaveSuggestion[];
    loading: boolean;

    setMatricula: (value: string) => void;
    buscar: (value: string) => Promise<void>;
    clear: () => void;
}

export const useMatriculaAutocompleteStore =
    create<MatriculaAutocompleteState>((set) => ({
        matricula: '',
        suggestions: [],
        loading: false,

        setMatricula: (value) => set({ matricula: value }),

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

        clear: () => set({ matricula: '', suggestions: [] }),
    }));
