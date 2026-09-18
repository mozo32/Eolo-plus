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
export type ViewType = 'entrega' | 'inventario' | 'cierre' | 'medicamentos';

/** Roles que pueden reabastecer stock (mismos slugs que valida el backend). */
export const ROLES_REABASTECER = ['admin', 'jefe_area', 'fbo'] as const;

export const puedeReabastecerStock = (usuario?: AuthUser | null): boolean => {
    if (!usuario) return false;
    if (usuario.isAdmin) return true;

    return (usuario.roles ?? []).some(rol => (ROLES_REABASTECER as readonly string[]).includes(rol.slug));
};

/** Usuario mínimo para el selector "Quién entrega". */
export interface UsuarioPersonal {
    id: number;
    name: string;
}

/** Entrega tal como la devuelve /ControlMedicamento/index dentro de cada cierre. */
export interface EntregaCierre {
    id: number;
    receptor: string;
    cantidad: number;
    created_at: string;
    medicamento: { id: number; nombre: string } | null;
    entregado_por: { id: number; name: string } | null;
    capturado_por: { id: number; name: string } | null;
}
