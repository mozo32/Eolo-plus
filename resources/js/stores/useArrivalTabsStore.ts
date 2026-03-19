import { create } from 'zustand';

interface TabInstance {
    id: string;
    label: string;
    data: any;
}

interface TabsState {
    tabs: TabInstance[];
    activeTabId: string | null;
    addTab: (moduloNombre?: string) => void;
    updateTabData: (id: string, data: any) => void;
    removeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
}

export const useArrivalTabsStore = create<TabsState>((set) => ({
    tabs: [],
    activeTabId: null,
    addTab: (moduloNombre) => {
        const id = crypto.randomUUID();
        const initialData = {
            id: null,
            matricula: '',
            equipo: '',
            hora: '',
            procedencia: '',
            pax: null,
            equipaje: null,
            tipo_cliente: '',
            departamento: moduloNombre,
            movimiento: 'Llegada',
            fecha: new Date().toLocaleDateString('sv-SE'),
            observaciones: '',
            nombre: '',
            impulso: ''
        };
        set((state) => ({
            tabs: [...state.tabs, { id, label: 'Nuevo Arribo', data: initialData }],
            activeTabId: id
        }));
    },
    updateTabData: (id, data) => set((state) => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, data, label: data.matricula || 'Nuevo Arribo' } : t)
    })),
    removeTab: (id) => set((state) => {
        const newTabs = state.tabs.filter(t => t.id !== id);
        return {
            tabs: newTabs,
            activeTabId: state.activeTabId === id ? (newTabs[0]?.id || null) : state.activeTabId
        };
    }),
    setActiveTab: (id) => set({ activeTabId: id })
}));
