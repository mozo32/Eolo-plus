<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AdministracionController extends Controller
{
    public function index(Request $request)
    {
        $this->soloAdmin($request);

        $perPage = $request->integer('per_page', 10);
        $sortBy = $request->input('sort_by', 'name');
        $sortDir = $request->input('sort_dir', 'asc');

        $query = $this->usuariosFiltrados($request)
            ->select('users.id', 'users.name', 'users.email', 'users.created_at')
            ->with([
                'roles:id,slug,nombre',
                // La relacion trae subdepartamentos por defecto; el listado solo
                // necesita el nombre del area, asi que se descarta esa carga.
                'departamentos' => fn ($q) => $q->select('departamentos.id', 'departamentos.nombre')->without('subdepartamentos'),
            ]);

        $allowedSorts = ['name', 'email', 'created_at'];

        if (! in_array($sortBy, $allowedSorts)) {
            $sortBy = 'name';
        }

        $query->orderBy($sortBy, $sortDir === 'desc' ? 'desc' : 'asc');

        $users = $query->paginate($perPage)->withQueryString();

        return response()->json($users);
    }

    /**
     * Solo los IDs del grupo filtrado, para "seleccionar todo el departamento"
     * sin recorrer las páginas ni traer las filas completas.
     */
    public function ids(Request $request)
    {
        $this->soloAdmin($request);

        return response()->json([
            'ids' => $this->usuariosFiltrados($request)
                ->orderBy('users.name')
                ->pluck('users.id'),
        ]);
    }

    /**
     * Catálogo de departamentos con su conteo de usuarios y sus
     * subdepartamentos. Alimenta el selector del filtro y el catálogo en
     * blanco del modal de asignación masiva.
     */
    public function departamentos(Request $request)
    {
        $this->soloAdmin($request);

        // Los conteos excluyen al propio administrador, igual que el listado:
        // asi el boton "Seleccionar los N" coincide con las filas que se ven.
        $yo = $request->user()->id;

        $departamentos = Departamento::query()
            ->where('status', 'A')
            ->with(['subdepartamentos' => fn ($q) => $q->select('id', 'departamento_id', 'nombre')->orderBy('nombre')])
            ->withCount(['users as usuarios' => fn ($q) => $q
                ->where('user_departamentos.status', 'A')
                ->where('users.id', '!=', $yo)])
            ->orderBy('nombre')
            ->get()
            ->map(fn (Departamento $dep) => [
                'id' => $dep->id,
                'nombre' => $dep->nombre,
                'usuarios' => $dep->usuarios,
                'subdepartamentos' => $dep->subdepartamentos
                    ->map(fn ($sub) => ['id' => $sub->id, 'nombre' => $sub->nombre])
                    ->values(),
            ]);

        return response()->json([
            'departamentos' => $departamentos,
            'sin_departamento' => $this->sinDepartamento(User::query()->where('users.id', '!=', $yo))->count(),
        ]);
    }

    /**
     * Base compartida por el listado y por el endpoint de IDs: mismo filtro,
     * misma exclusión del propio administrador.
     */
    private function usuariosFiltrados(Request $request): Builder
    {
        $query = User::query()->where('users.id', '!=', $request->user()->id);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', "%{$search}%")
                    ->orWhere('users.email', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('sin_departamento')) {
            return $this->sinDepartamento($query);
        }

        if ($departamentoId = $request->integer('departamento_id')) {
            $query->whereHas('departamentos', function ($q) use ($departamentoId) {
                $q->where('departamentos.id', $departamentoId)
                    ->where('departamentos.status', 'A')
                    ->where('user_departamentos.status', 'A');
            });
        }

        return $query;
    }

    /** Usuarios sin ningún vínculo activo a un departamento. */
    private function sinDepartamento(Builder $query): Builder
    {
        return $query->whereDoesntHave('departamentos', function ($q) {
            $q->where('departamentos.status', 'A')
                ->where('user_departamentos.status', 'A');
        });
    }

    private function soloAdmin(Request $request): void
    {
        $user = $request->user();

        if (! $user || ! $user->hasRole('admin')) {
            abort(403, 'No autorizado');
        }
    }
}
