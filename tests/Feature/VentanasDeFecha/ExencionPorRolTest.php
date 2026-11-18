<?php

use App\Models\ControlMedicamento;
use App\Models\Role;
use App\Models\User;
use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * La exención de `fbo` y `admin` probada donde importa: un endpoint real y la
 * prop que alimenta el calendario. Las pruebas de `VentanasDeFechaTest` cubren
 * el predicado; éstas cubren que llega.
 *
 * Los nombres de los ayudantes no deben repetirse en otros archivos: los
 * ayudantes de Pest son funciones globales y repetirlos sería un fatal.
 */

function usuarioExentoConRol(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/** @return array<string, mixed> */
function cargaDeMedicamentoParaExencion(string $fecha): array
{
    return [
        'responsable' => 'Responsable Uno',
        'fecha' => $fecha,
        'dia' => 'Lunes',
        'aparatos' => ['Baumanometro'],
        'firma' => 'sin-firma',
        'medicamentos' => ['Paracetamol' => ['inicio' => 5, 'final' => 3]],
    ];
}

test('un exento guarda una fecha de hace un mes', function (string $slug) {
    $this->actingAs(usuarioExentoConRol($slug), 'sanctum');
    $antes = ControlMedicamento::count();

    $this->postJson(
        '/api/ControlMedicamento',
        cargaDeMedicamentoParaExencion(Carbon::today()->subMonth()->toDateString()),
    )->assertSuccessful();

    expect(ControlMedicamento::count())->toBe($antes + 1);
})->with(['fbo', 'admin']);

test('un exento guarda una fecha futura aunque la clave no admita futuro', function () {
    $this->actingAs(usuarioExentoConRol('fbo'), 'sanctum');

    $this->postJson(
        '/api/ControlMedicamento',
        cargaDeMedicamentoParaExencion(Carbon::today()->addDays(5)->toDateString()),
    )->assertSuccessful();
});

test('quien no esta exento sigue recibiendo 422 con la MISMA fecha', function (string $slug) {
    /*
     * El par con la prueba de arriba es lo que la hace honesta: misma fecha,
     * mismo endpoint. Sin él, un 200 del exento podría venir de que la fecha
     * estaba dentro de la ventana y nadie se enteraría.
     */
    $this->actingAs(usuarioExentoConRol($slug), 'sanctum');
    $antes = ControlMedicamento::count();

    $this->postJson(
        '/api/ControlMedicamento',
        cargaDeMedicamentoParaExencion(Carbon::today()->subMonth()->toDateString()),
    )->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(ControlMedicamento::count())->toBe($antes);
})->with(['empleado', 'jefe_area']);

test('la prop de inertia llega sin limites para un exento', function () {
    /*
     * Las claves llevan PUNTOS literales, así que no se leen con
     * `->where('ventanasDeFecha.csae.entrada')`: hay que sacar el arreglo y
     * comprobarlo en PHP. Lo avisa el docblock de VentanasDeFecha.
     */
    $this->actingAs(usuarioExentoConRol('admin'));

    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $ventanas = $page->toArray()['props']['ventanasDeFecha'];

        expect($ventanas['csae.entrada'])->toBe(['min' => null, 'max' => null]);
    });
});

test('la prop de inertia conserva los limites para quien no esta exento', function () {
    $this->actingAs(usuarioExentoConRol('empleado'));

    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $ventanas = $page->toArray()['props']['ventanasDeFecha'];

        expect($ventanas['csae.entrada'])->toBe(VentanasDeFecha::para('csae.entrada'));
    });
});
