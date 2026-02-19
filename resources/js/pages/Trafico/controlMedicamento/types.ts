export type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: {
            id: number;
            nombre: string;
            route: string;
        }[];
    }[];
};
export interface Medicamento {
    id: number;
    nombre: string;
    cantidad: number;
    total_entregado: number;
    created_at?: string;
    updated_at?: string;
}
export type ViewType = 'entrega' | 'inventario' | 'cierre';
