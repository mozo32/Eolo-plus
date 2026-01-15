<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Illuminate\Support\Str;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user();

        return [
            ...parent::share($request),

            'name' => config('app.name'),

            'quote' => [
                'message' => trim($message),
                'author' => trim($author),
            ],

            'auth' => [
                'user' => $user
                    ? $this->mapUser($user)
                    : null,
            ],

            'sidebarOpen' =>
                ! $request->hasCookie('sidebar_state')
                || $request->cookie('sidebar_state') === 'true',
        ];
    }

    private function mapUser($user): array
    {
        $user->loadMissing([
            'roles:id,slug,nombre',
            'subdepartamentos:id,nombre,departamento_id',
            'departamentos:id,nombre',
        ]);

        $isAdmin = $user->hasRole('admin');
        $userSubIds = $user->subdepartamentos->pluck('id')->toArray();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,

            'roles' => $user->roles->map(fn ($role) => [
                'slug' => $role->slug,
                'nombre' => $role->nombre,
            ])->values(),

            'isAdmin' => $isAdmin,

            'departamentos' => $isAdmin
                ? []
                : $user->departamentos->map(function ($dep) use ($userSubIds) {

                    $subs = $dep->subdepartamentos
                        ->whereIn('id', $userSubIds)
                        ->values();

                    if ($subs->isEmpty()) {
                        return null;
                    }

                    return [
                        'id' => $dep->id,
                        'nombre' => $dep->nombre,
                        'subdepartamentos' => $subs->map(fn ($sub) => [
                            'id' => $sub->id,
                            'nombre' => $sub->nombre,
                            'route' => Str::slug($dep->nombre) . '.' . Str::slug($sub->nombre),
                        ])->values(),
                    ];
                })
                ->filter()
                ->values(),
        ];
    }
}
