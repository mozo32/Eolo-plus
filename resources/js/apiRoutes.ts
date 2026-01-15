
const API_BASE = '';

export const apiRoutes = {
    aeronaves: {
        autocomplete: (q: string) =>
            `${API_BASE}/api/aeronaves/autocomplete?q=${encodeURIComponent(q)}`,

        buscarPorMatricula: (matricula: string) =>
            `${API_BASE}/api/aeronaves/buscar/${encodeURIComponent(matricula)}`,
    },

};
