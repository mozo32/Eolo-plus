export interface TipoAeronaveApi {
    id: number;
    nombre: string; // ajusta si en tu API viene con otro nombre
}

export async function fetchTiposAeronaveApi(): Promise<TipoAeronaveApi[]> {
    const resp = await fetch('/api/tipo-aeronaves', {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!resp.ok) {
        throw new Error('Error al cargar tipos de aeronave');
    }

    const data = await resp.json();
    return data as TipoAeronaveApi[];
}
