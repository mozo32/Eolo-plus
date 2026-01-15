// resources/js/stores/useAeronaveStore.ts
import { create } from "zustand";

export interface TipoAeronave {
    id: number;
    nombre: string; // ajusta al nombre real de tu columna (nombre, descripcion, etc.)
}

export interface AeronaveState {
    tipoAeronaves: TipoAeronave[];
    isLoading: boolean;
    fetchTiposAeronave: () => Promise<void>;
}

export const useAeronaveStore = create<AeronaveState>((set) => ({
    tipoAeronaves: [],
    isLoading: false,

    fetchTiposAeronave: async () => {
        try {
            set({ isLoading: true });

            const resp = await fetch("/api/tipo-aeronaves");

            if (!resp.ok) {
                throw new Error("Error al consultar tipos de aeronave");
            }

            const data = await resp.json();

            // Si tu API devuelve { data: [...] }:
            // const tipos = data.data as TipoAeronave[];
            // Si devuelve un array plano:
            const tipos = data as TipoAeronave[];

            set({
                tipoAeronaves: tipos,
                isLoading: false,
            });
        } catch (error) {
            console.error("Error cargando tipos de aeronave:", error);
            set({ isLoading: false });
        }
    },
}));
