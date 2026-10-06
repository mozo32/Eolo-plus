<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'initials',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    public function departamento()
    {
        return $this->belongsTo(Departamento::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function departamentos()
    {
        return $this->belongsToMany(
            Departamento::class,
            'user_departamentos',
            'user_id',
            'departamento_id'
        )->with('subdepartamentos');
    }

    public function subdepartamentos()
    {
        return $this->belongsToMany(
            SubDepartamento::class,
            'user_subdepartamentos',
            'user_id',
            'subdepartamento_id'
        );
    }

    /**
     * Usuarios del área de Tráfico con vínculo activo.
     *
     * Lo usan el selector "Quién entrega" de Control de Medicamentos y el de
     * Préstamo de chalecos. Se acepta el nombre con y sin acento por si el
     * catálogo se corrige más adelante.
     */
    public function scopeDelAreaDeTrafico($query)
    {
        return $query->whereHas('departamentos', function ($q) {
            $q->whereIn('departamentos.nombre', ['Trafico', 'Tráfico'])
                ->where('departamentos.status', 'A')
                ->where('user_departamentos.status', 'A');
        });
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    public function hasRole(string $slug): bool
    {
        return $this->roles()->where('slug', $slug)->exists();
    }

    public function hasAnyRole(array $roles): bool
    {
        return $this->roles()->whereIn('slug', $roles)->exists();
    }

    /**
     * Los roles que se rigen por subdepartamentos. Cualquier otro rol (salvo `admin`, que pasa siempre) no entra
     * a ningun modulo protegido por `subdep:`.
     *
     * @var list<string>
     */
    public const ROLES_CON_SUBDEPARTAMENTOS = ['empleado', 'jefe_area', 'fbo'];

    /**
     * La regla de acceso a un subdepartamento, en UN solo sitio: la usan el middleware `subdep:` (que decide el 403) y la
     * bandera que la pantalla lee para ofrecer o no un boton (`puede_reabrir`). Si vivieran en dos, podrian divergir.
     *
     * El admin pasa siempre. Los roles de `ROLES_CON_SUBDEPARTAMENTOS` necesitan tener el subdepartamento asignado AL USUARIO
     * (no anidado bajo un departamento). Cualquier otro rol no pasa.
     */
    public function puedeEnSubdepartamento(string $nombre): bool
    {
        if ($this->hasRole('admin')) {
            return true;
        }

        return $this->tieneRolConSubdepartamentos()
            && $this->subdepartamentos()->where('subdepartamentos.nombre', $nombre)->exists();
    }

    /**
     * Distingue, cuando `puedeEnSubdepartamento()` dice que no, QUE mensaje de 403 corresponde: el rol esta permitido pero
     * falta el subdepartamento, o el rol ni siquiera es de los que se rigen por subdepartamentos.
     */
    public function tieneRolConSubdepartamentos(): bool
    {
        return $this->hasAnyRole(self::ROLES_CON_SUBDEPARTAMENTOS);
    }

    public function checklists()
    {
        return $this->hasMany(ChecklistEquipoSeguridad::class, 'user_id');
    }
}
