export type SubDepartamentoApi = {
    id: number;
    nombre: string;
    activo: boolean;
};

export type DepartamentoApi = {
    id: number;
    nombre: string;
    subdepartamentos: SubDepartamentoApi[];
};

export type RoleApi = {
    id: number;
    slug: string;
    nombre: string;
};

/** Cómo se aplica la asignación: sumando módulos o dejando solo los marcados. */
export type ModoAsignacion = 'agregar' | 'reemplazar';

export type SaveDepartamentosUsuarioPayload = {
    modo: ModoAsignacion;
    /** En modo 'agregar' puede ir null: cada usuario conserva su rol. */
    role_id: number | null;
    user_ids: number[];
    asignaciones: {
        departamento_id: number;
        subdepartamentos: number[];
    }[];
};

export type DepartamentoCatalogo = {
    id: number;
    nombre: string;
    usuarios: number;
    subdepartamentos: { id: number; nombre: string }[];
};

/** Filtro del listado: un departamento, los que no tienen ninguno, o todos. */
export type FiltroUsuarios = {
    page?: number;
    search?: string;
    departamento_id?: number | null;
    sin_departamento?: boolean;
};

async function handleResponse(res: Response) {
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || 'Error en la petición');
    }
    return data;
}

function queryDeFiltro(filtro: FiltroUsuarios): string {
    const qs = new URLSearchParams();

    if (filtro.page) qs.set('page', String(filtro.page));
    if (filtro.search) qs.set('search', filtro.search);
    if (filtro.sin_departamento) qs.set('sin_departamento', '1');
    else if (filtro.departamento_id) qs.set('departamento_id', String(filtro.departamento_id));

    return qs.toString();
}

export async function fetchUsers(filtro: FiltroUsuarios = {}) {
    const res = await fetch(`/api/administracion/users?${queryDeFiltro(filtro)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
    });
    return handleResponse(res);
}

/**
 * Catálogo de departamentos con su conteo de usuarios. Llena el selector del
 * filtro y, en la asignación masiva, la lista de módulos en blanco.
 */
export async function fetchDepartamentosCatalogo(): Promise<{
    departamentos: DepartamentoCatalogo[];
    sin_departamento: number;
}> {
    const res = await fetch('/api/administracion/departamentos', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
    });
    return handleResponse(res);
}

/**
 * IDs de todos los usuarios del grupo filtrado, incluidos los de otras
 * páginas. Es lo que permite seleccionar un departamento completo.
 */
export async function fetchIdsDelGrupo(filtro: FiltroUsuarios): Promise<number[]> {
    const { page, ...sinPagina } = filtro;
    void page;

    const res = await fetch(`/api/administracion/users/ids?${queryDeFiltro(sinPagina)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
    });
    const data = await handleResponse(res);
    return Array.isArray(data?.ids) ? data.ids : [];
}

export type FetchDepartamentosUsuarioResponse = {
    departamentos: DepartamentoApi[];
    roles: RoleApi[];
    userRoleId: number | null;
};

export async function fetchDepartamentosUsuario(
    userId: number
): Promise<FetchDepartamentosUsuarioResponse> {
    const res = await fetch(
        `/api/administracion/users/${userId}/departamentos`,
        {
            headers: { Accept: 'application/json' },
            credentials: 'include',
        }
    );
    return handleResponse(res);
}

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function saveDepartamentosUsuario(
    payload: SaveDepartamentosUsuarioPayload
): Promise<void> {
    await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const xsrf = getXsrfToken();

    const res = await fetch(
        `/api/administracion/users/departamentos-masivo`,
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf,
            },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message || 'Error al guardar');
    }
}
