<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bitacora;
use App\Models\Departamento;
use App\Models\Role;
use App\Models\SubDepartamento;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserDepartamentoController extends Controller
{
    /** Suma los módulos marcados a lo que cada usuario ya tiene. */
    private const MODO_AGREGAR = 'agregar';

    /** Deja a cada usuario exactamente con lo marcado. */
    private const MODO_REEMPLAZAR = 'reemplazar';

    public function index(Request $request, User $user)
    {
        $this->soloAdmin($request);

        $userSubIds = $user->subdepartamentos()
            ->pluck('subdepartamentos.id')
            ->toArray();

        $departamentos = Departamento::with('subdepartamentos')
            ->get()
            ->map(function ($dep) use ($userSubIds) {
                return [
                    'id' => $dep->id,
                    'nombre' => $dep->nombre,
                    'subdepartamentos' => $dep->subdepartamentos->map(function ($sub) use ($userSubIds) {
                        return [
                            'id' => $sub->id,
                            'nombre' => $sub->nombre,
                            'activo' => in_array($sub->id, $userSubIds),
                        ];
                    }),
                ];
            });

        return response()->json([
            'departamentos' => $departamentos,
            'roles' => Role::select('id', 'slug', 'nombre')->get(),
            'userRoleId' => $user->roles()->value('roles.id'),
        ]);
    }

    public function storeMasivo(Request $request)
    {
        $this->soloAdmin($request);

        $datos = $request->validate([
            'modo' => ['required', 'in:'.self::MODO_AGREGAR.','.self::MODO_REEMPLAZAR],
            // En modo agregar el rol es opcional: si no viene, cada usuario
            // conserva el suyo (en un área hay jefes y empleados mezclados).
            'role_id' => [
                $request->input('modo') === self::MODO_AGREGAR ? 'nullable' : 'required',
                'integer',
                'exists:roles,id',
            ],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'asignaciones' => ['required', 'array'],
            'asignaciones.*.departamento_id' => ['required', 'integer'],
            'asignaciones.*.subdepartamentos' => ['array'],
            'asignaciones.*.subdepartamentos.*' => ['integer', 'exists:subdepartamentos,id'],
        ]);

        $modo = $datos['modo'];
        $roleId = $datos['role_id'] ?? null;

        $subIds = collect($datos['asignaciones'])
            ->pluck('subdepartamentos')
            ->flatten()
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($modo === self::MODO_AGREGAR && empty($subIds) && $roleId === null) {
            throw ValidationException::withMessages([
                'asignaciones' => 'Selecciona al menos un módulo o un rol para aplicar.',
            ]);
        }

        $depIds = SubDepartamento::whereIn('id', $subIds)
            ->pluck('departamento_id')
            ->unique()
            ->values()
            ->all();

        try {
            DB::beginTransaction();

            $users = User::whereIn('id', $datos['user_ids'])->get();

            foreach ($users as $user) {
                if ($modo === self::MODO_AGREGAR) {
                    // Nadie pierde accesos: solo se suman los que faltaban.
                    $user->subdepartamentos()->syncWithoutDetaching($subIds);
                    $user->departamentos()->syncWithoutDetaching($depIds);

                    if ($roleId !== null) {
                        $user->roles()->syncWithoutDetaching([$roleId]);
                    }

                    continue;
                }

                $user->subdepartamentos()->sync($subIds);
                $user->departamentos()->sync($depIds);
                $user->roles()->sync([$roleId]);
            }

            $this->registrarEnBitacora($modo, $users->pluck('id')->all(), $subIds, $roleId);

            DB::commit();

            return response()->json([
                'message' => $modo === self::MODO_AGREGAR
                    ? 'Módulos agregados a '.$users->count().' usuarios sin quitarles los que ya tenían'
                    : 'Asignaciones aplicadas correctamente a '.$users->count().' usuarios',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al procesar la asignación masiva',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Un cambio de permisos deja rastro: quién lo hizo, a quiénes, qué módulos
     * y en qué modo.
     */
    private function registrarEnBitacora(string $modo, array $userIds, array $subIds, ?int $roleId): void
    {
        $modulos = SubDepartamento::whereIn('id', $subIds)->pluck('nombre')->all();

        Bitacora::log(
            modulo: Bitacora::MODULO_GESTION_USUARIOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: $modo === self::MODO_AGREGAR
                ? 'Se agregaron módulos a '.count($userIds).' usuarios'
                : 'Se reemplazaron los módulos de '.count($userIds).' usuarios',
            datosNuevos: [
                'modo' => $modo,
                'usuarios' => $userIds,
                'modulos' => $modulos,
                'role_id' => $roleId,
            ],
        );
    }

    private function soloAdmin(Request $request): void
    {
        $user = $request->user();

        if (! $user || ! $user->hasRole('admin')) {
            abort(403, 'No autorizado');
        }
    }
}
