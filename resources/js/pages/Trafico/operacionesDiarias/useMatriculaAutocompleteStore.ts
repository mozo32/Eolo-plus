import { create } from 'zustand';
import { obtenerInfoMatriculaApi, autocompleteMatriculaApi } from '@/stores/apiOperacionesDiarias';

interface AutocompleteState {
    sugerencias: any[];
    loading: boolean;
    buscar: (query: string) => Promise<void>;
    obtenerTipo: (matricula: string) => Promise<{ tipo: string } | null>;
}

export const useMatriculaAutocompleteStore = create<AutocompleteState>((set) => ({
    sugerencias: [],
    loading: false,

    buscar: async (query: string) => {
        if (query.length < 2) {
            set({ sugerencias: [] });
            return;
        }
        set({ loading: true });
        try {
            const data = await autocompleteMatriculaApi(query);
            set({ sugerencias: data, loading: false });
        } catch (error) {
            set({ sugerencias: [], loading: false });
        }
    },

    obtenerTipo: async (matricula: string) => {
        try {
            return await obtenerInfoMatriculaApi(matricula);
        } catch (error) {
            return null;
        }
    }
}));
