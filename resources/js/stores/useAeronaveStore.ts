import { create } from 'zustand';
import { AeronaveApiData } from '@/pages/despacho/components/walkAround/MatriculaAutocomplete';
// ajusta la ruta según tu estructura real

interface AeronaveSuggestion {
    id: number;
    matricula: string;
    movimiento: string;
}

interface AeronaveState {
    suggestions: AeronaveSuggestion[];
    loadingSuggestions: boolean;

    fetchSuggestions: (query: string) => Promise<void>;
    fetchAeronave: (matricula: string) => Promise<AeronaveApiData | null>;
    clearSuggestions: () => void;
}

export const useAeronaveStore = create<AeronaveState>((set) => ({
    suggestions: [],
    loadingSuggestions: false,

    fetchSuggestions: async (query: string) => {
        if (!query) {
            set({ suggestions: [] });
            return;
        }

        set({ loadingSuggestions: true });

        try {
            const res = await fetch(
                `/api/aeronaves/autocomplete?q=${encodeURIComponent(query)}`
            );

            if (!res.ok) {
                set({ suggestions: [], loadingSuggestions: false });
                return;
            }

            const data = await res.json();
            set({ suggestions: data, loadingSuggestions: false });
        } catch (error) {
            console.error(error);
            set({ suggestions: [], loadingSuggestions: false });
        }
    },

    fetchAeronave: async (matricula: string) => {
        try {
            const res = await fetch(
                `/api/aeronaves/buscar/${encodeURIComponent(matricula)}`
            );

            if (!res.ok) return null;

            const data = await res.json();
            return data as AeronaveApiData;
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    clearSuggestions: () => set({ suggestions: [] }),
}));
