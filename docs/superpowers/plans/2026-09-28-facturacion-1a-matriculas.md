# Bloque 1a — Independizar el catálogo de matrículas · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Eolo-plus deje de depender de la base de datos de Prefacturas (`fact-fbo`) para resolver matrículas, tipos de aeronave y precio de combustible.

**Architecture:** Las matrículas pasan a vivir en la tabla local `aeronaves`, que se vuelve autoritativa y gana índice único. Los atributos de facturación (categoría, motor, estatus) van en una satélite `fact_aeronaves`. Un servicio único, `CatalogoAeronaves`, reemplaza la lógica de buscar-o-crear matrícula que hoy está duplicada en cinco controladores contra la conexión `remota`. Un comando de Artisan importa los datos desde `fact-fbo`.

**Tech Stack:** Laravel 12.41 · PHP 8.2 · Pest 4.1 (sqlite en memoria) · Inertia 2 + React 19 + TypeScript 5.7 · Tailwind 4

**Spec:** `docs/superpowers/specs/2026-09-28-facturacion-1a-matriculas-design.md`

## Global Constraints

- Las tablas nuevas del módulo llevan prefijo `fact_`. Las rutas de API **no** lo llevan.
- Ningún controlador puede quedar referenciando `DB::connection('remota')` al terminar. La conexión permanece en `config/database.php` solo para el importador.
- El contrato JSON hacia el frontend **no cambia** en ningún controlador reapuntado: mismos nombres de campo, mismos valores.
- Bajas lógicas con `status` char(1) `A`/`N`, atómicas: `UPDATE ... WHERE id = ? AND status = 'A'`, 409 si ya estaba dada de baja.
- Toda escritura en catálogos registra en bitácora con `Bitacora::MODULO_FACTURACION_CATALOGOS`.
- Fechas locales de México. Nunca `toISOString()` en el frontend.
- El índice único en `aeronaves.matricula` va en la **última** migración, después de importar y depurar.
- Cada pantalla tiene su propio subdepartamento; el menú se arma desde ellos.
- Correr `php artisan test` completo antes de cada commit: el baseline es **229 pruebas en verde**.

---

### Task 1: Catálogos de tarifas

Dos tablas que guardan lo que hoy está escrito en el código: pernocta y tránsitos por categoría, aterrizaje por tipo de motor.

**Files:**
- Create: `database/migrations/2026_09_28_090000_create_fact_categorias_aeronave_table.php`
- Create: `database/migrations/2026_09_28_090100_create_fact_tipos_motor_table.php`
- Create: `app/Models/FactCategoriaAeronave.php`
- Create: `app/Models/FactTipoMotor.php`
- Test: `tests/Feature/Facturacion/CatalogosTarifasTest.php`

**Interfaces:**
- Consumes: nada
- Produces: `FactCategoriaAeronave` con `$fillable = ['nombre','tarifa_pernocta','tarifa_transito_2h','tarifa_transito_12h','status']`, scope `activas()`, constantes `STATUS_ACTIVO = 'A'` y `STATUS_INACTIVO = 'N'`. `FactTipoMotor` con `$fillable = ['nombre','tarifa_aterrizaje','status']` y el mismo scope y constantes.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/CatalogosTarifasTest.php

use App\Models\FactCategoriaAeronave;
use App\Models\FactTipoMotor;

test('la categoria guarda sus tres tarifas con dos decimales', function () {
    $categoria = FactCategoriaAeronave::create([
        'nombre' => 'Ejecutiva',
        'tarifa_pernocta' => 1250.50,
        'tarifa_transito_2h' => 300,
        'tarifa_transito_12h' => 700.25,
    ]);

    $guardada = $categoria->fresh();

    expect($guardada->status)->toBe('A')
        ->and((float) $guardada->tarifa_pernocta)->toBe(1250.50)
        ->and((float) $guardada->tarifa_transito_12h)->toBe(700.25);
});

test('el tipo de motor guarda su tarifa de aterrizaje', function () {
    $motor = FactTipoMotor::create(['nombre' => 'Turbohelice', 'tarifa_aterrizaje' => 980.75]);

    expect((float) $motor->fresh()->tarifa_aterrizaje)->toBe(980.75)
        ->and($motor->fresh()->status)->toBe('A');
});

test('el scope activas excluye las dadas de baja', function () {
    FactCategoriaAeronave::create(['nombre' => 'Viva', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1]);
    FactCategoriaAeronave::create(['nombre' => 'Baja', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1, 'status' => 'N']);
    FactTipoMotor::create(['nombre' => 'Motor vivo', 'tarifa_aterrizaje' => 1]);
    FactTipoMotor::create(['nombre' => 'Motor baja', 'tarifa_aterrizaje' => 1, 'status' => 'N']);

    expect(FactCategoriaAeronave::activas()->pluck('nombre')->all())->toBe(['Viva'])
        ->and(FactTipoMotor::activas()->pluck('nombre')->all())->toBe(['Motor vivo']);
});

test('el nombre de la categoria y del motor son unicos', function () {
    FactCategoriaAeronave::create(['nombre' => 'Repetida', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1]);

    expect(fn () => FactCategoriaAeronave::create(['nombre' => 'Repetida', 'tarifa_pernocta' => 2, 'tarifa_transito_2h' => 2, 'tarifa_transito_12h' => 2]))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/CatalogosTarifasTest.php`
Expected: FAIL con `Class "App\Models\FactCategoriaAeronave" not found`

- [ ] **Step 3: Write the migrations**

```php
<?php
// database/migrations/2026_09_28_090000_create_fact_categorias_aeronave_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Categoría de la aeronave y sus tarifas de estancia.
 *
 * En el sistema viejo estas tarifas colgaban de cada matrícula por llave
 * foránea, pero `altamatri.php` las copiaba de otra matrícula de la misma
 * categoría: la dependencia real es de la categoría, no del avión.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_categorias_aeronave', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->decimal('tarifa_pernocta', 10, 2);
            $table->decimal('tarifa_transito_2h', 10, 2);
            $table->decimal('tarifa_transito_12h', 10, 2);
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_categorias_aeronave');
    }
};
```

```php
<?php
// database/migrations/2026_09_28_090100_create_fact_tipos_motor_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Tipo de motor y su tarifa de aterrizaje (en el sistema viejo, tb_aterrisaje). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_tipos_motor', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->decimal('tarifa_aterrizaje', 10, 2);
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_tipos_motor');
    }
};
```

- [ ] **Step 4: Write the models**

```php
<?php
// app/Models/FactCategoriaAeronave.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactCategoriaAeronave extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_categorias_aeronave';

    protected $fillable = [
        'nombre',
        'tarifa_pernocta',
        'tarifa_transito_2h',
        'tarifa_transito_12h',
        'status',
    ];

    protected $casts = [
        'tarifa_pernocta' => 'decimal:2',
        'tarifa_transito_2h' => 'decimal:2',
        'tarifa_transito_12h' => 'decimal:2',
    ];

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function aeronaves()
    {
        return $this->hasMany(FactAeronave::class, 'categoria_aeronave_id');
    }
}
```

```php
<?php
// app/Models/FactTipoMotor.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactTipoMotor extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_tipos_motor';

    protected $fillable = ['nombre', 'tarifa_aterrizaje', 'status'];

    protected $casts = ['tarifa_aterrizaje' => 'decimal:2'];

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function aeronaves()
    {
        return $this->hasMany(FactAeronave::class, 'tipo_motor_id');
    }
}
```

Las relaciones `aeronaves()` apuntan a `FactAeronave`, que se crea en la Task 2. No se ejecutan en las pruebas de esta task, así que no fallan.

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/CatalogosTarifasTest.php`
Expected: PASS, 4 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 233 pruebas (229 del baseline + 4)

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_28_0900*.php app/Models/FactCategoriaAeronave.php app/Models/FactTipoMotor.php tests/Feature/Facturacion/CatalogosTarifasTest.php
git commit -m "Catalogos de tarifas: categorias de aeronave y tipos de motor"
```

---

### Task 2: Satélite `fact_aeronaves` y arreglo de la tabla `aeronaves`

`aeronaves` se prepara para ser autoritativa: `aeronave_id` pasa a nullable (las altas automáticas no conocen el tipo) y se corrige la relación rota del modelo. El índice único **no** va aquí — va en la Task 11, después de importar.

**Files:**
- Create: `database/migrations/2026_09_28_090200_alter_aeronaves_tipo_nullable.php`
- Create: `database/migrations/2026_09_28_090300_create_fact_aeronaves_table.php`
- Create: `app/Models/FactAeronave.php`
- Modify: `app/Models/Aeronave.php`
- Modify: `app/Models/TipoAeronave.php`
- Test: `tests/Feature/Facturacion/FactAeronaveTest.php`

**Interfaces:**
- Consumes: `FactCategoriaAeronave`, `FactTipoMotor` de la Task 1
- Produces: `FactAeronave` con `$fillable = ['aeronave_id','categoria_aeronave_id','tipo_motor_id','estatus','cobra_derecho_vuelos']`, constantes `ESTATUS_GUARDA = 'guarda'` y `ESTATUS_TRANSITO = 'transito'`, relaciones `aeronave()`, `categoria()`, `tipoMotor()`. `Aeronave` gana `facturacion()` (hasOne) y su relación `tipoAeronave()` queda apuntando a `aeronave_id`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/FactAeronaveTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactTipoMotor;
use App\Models\TipoAeronave;

test('una aeronave puede existir sin tipo, como las altas automaticas', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-ABC']);

    expect($aeronave->fresh()->aeronave_id)->toBeNull();
});

test('la relacion tipoAeronave usa la columna aeronave_id', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $aeronave = Aeronave::create(['matricula' => 'XA-DEF', 'aeronave_id' => $tipo->id]);

    expect($aeronave->fresh()->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and($tipo->fresh()->aeronaves->pluck('matricula')->all())->toBe(['XA-DEF']);
});

test('la satelite cuelga de la aeronave y guarda sus atributos de cobro', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-GHI']);
    $categoria = FactCategoriaAeronave::create(['nombre' => 'Ejecutiva', 'tarifa_pernocta' => 100, 'tarifa_transito_2h' => 50, 'tarifa_transito_12h' => 80]);
    $motor = FactTipoMotor::create(['nombre' => 'Jet', 'tarifa_aterrizaje' => 900]);

    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'categoria_aeronave_id' => $categoria->id,
        'tipo_motor_id' => $motor->id,
    ]);

    $facturacion = $aeronave->fresh()->facturacion;

    expect($facturacion->estatus)->toBe('guarda')
        ->and($facturacion->cobra_derecho_vuelos)->toBeTrue()
        ->and($facturacion->categoria->nombre)->toBe('Ejecutiva')
        ->and($facturacion->tipoMotor->nombre)->toBe('Jet');
});

test('una matricula incompleta se guarda sin categoria ni motor', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-JKL']);

    $facturacion = FactAeronave::create(['aeronave_id' => $aeronave->id]);

    expect($facturacion->fresh()->categoria_aeronave_id)->toBeNull()
        ->and($facturacion->fresh()->tipo_motor_id)->toBeNull();
});

test('una aeronave no puede tener dos filas de facturacion', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-MNO']);
    FactAeronave::create(['aeronave_id' => $aeronave->id]);

    expect(fn () => FactAeronave::create(['aeronave_id' => $aeronave->id]))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

test('borrar la aeronave arrastra su fila de facturacion', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-PQR']);
    FactAeronave::create(['aeronave_id' => $aeronave->id]);

    $aeronave->delete();

    expect(FactAeronave::count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/FactAeronaveTest.php`
Expected: FAIL. La primera prueba falla por `NOT NULL constraint failed: aeronaves.aeronave_id` y el resto por `Class "App\Models\FactAeronave" not found`.

- [ ] **Step 3: Write the migrations**

```php
<?php
// database/migrations/2026_09_28_090200_alter_aeronaves_tipo_nullable.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `aeronaves` pasa a ser la tabla autoritativa de matrículas. Las altas
 * automáticas (una matrícula capturada en una operación que todavía no está en
 * el catálogo) no conocen el tipo de aeronave: en el sistema viejo se insertaba
 * con `id_tipo = 0`. Aquí se representa con null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->unsignedBigInteger('aeronave_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->unsignedBigInteger('aeronave_id')->nullable(false)->change();
        });
    }
};
```

```php
<?php
// database/migrations/2026_09_28_090300_create_fact_aeronaves_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Atributos de la matrícula que solo importan para cobrar. Van aparte de
 * `aeronaves` porque esa tabla la usan módulos que no facturan; una matrícula
 * que nunca se factura simplemente no tiene fila aquí.
 *
 * `categoria_aeronave_id` nula reproduce el `id_categoria = 0` del sistema
 * viejo: la matrícula existe pero todavía no se puede facturar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_aeronaves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('aeronave_id')->unique()->constrained('aeronaves')->cascadeOnDelete();
            $table->foreignId('categoria_aeronave_id')->nullable()->constrained('fact_categorias_aeronave')->nullOnDelete();
            $table->foreignId('tipo_motor_id')->nullable()->constrained('fact_tipos_motor')->nullOnDelete();
            $table->string('estatus', 10)->default('guarda')->index();
            $table->boolean('cobra_derecho_vuelos')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_aeronaves');
    }
};
```

- [ ] **Step 4: Write the model and fix the relations**

```php
<?php
// app/Models/FactAeronave.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactAeronave extends Model
{
    /** Tiene contrato de hangar: no paga estancia suelta. */
    public const ESTATUS_GUARDA = 'guarda';

    /** Está de paso: paga estancia (pernocta y tránsitos). Estatus de una matrícula nueva. */
    public const ESTATUS_TRANSITO = 'transito';

    protected $table = 'fact_aeronaves';

    protected $fillable = [
        'aeronave_id',
        'categoria_aeronave_id',
        'tipo_motor_id',
        'estatus',
        'cobra_derecho_vuelos',
    ];

    protected $casts = ['cobra_derecho_vuelos' => 'boolean'];

    public function aeronave()
    {
        return $this->belongsTo(Aeronave::class);
    }

    public function categoria()
    {
        return $this->belongsTo(FactCategoriaAeronave::class, 'categoria_aeronave_id');
    }

    public function tipoMotor()
    {
        return $this->belongsTo(FactTipoMotor::class, 'tipo_motor_id');
    }
}
```

En `app/Models/Aeronave.php`, corregir la llave de la relación y agregar la satélite. La llave era `tipo_aeronave_id`, columna que no existe en `aeronaves` (pertenece a `walk_arounds`), así que la relación devolvía null siempre:

```php
    public function tipoAeronave()
    {
        return $this->belongsTo(TipoAeronave::class, 'aeronave_id');
    }

    /** Atributos de cobro de esta matrícula; null si nunca se ha facturado. */
    public function facturacion()
    {
        return $this->hasOne(FactAeronave::class, 'aeronave_id');
    }
```

En `app/Models/TipoAeronave.php`, la misma corrección:

```php
    public function aeronaves()
    {
        return $this->hasMany(Aeronave::class, 'aeronave_id');
    }
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/FactAeronaveTest.php`
Expected: PASS, 6 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 239 pruebas. Si alguna prueba existente falla por el cambio de llave en `tipoAeronave()`, la relación estaba devolviendo null y alguien dependía de eso: corregir esa prueba, no revertir la llave.

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_28_0902*.php database/migrations/2026_09_28_0903*.php app/Models/FactAeronave.php app/Models/Aeronave.php app/Models/TipoAeronave.php tests/Feature/Facturacion/FactAeronaveTest.php
git commit -m "Satelite fact_aeronaves y correccion de la relacion tipoAeronave"
```

---

### Task 3: Precio de combustible con vigencias

Dos precios: el ASA (lo que cuesta) y el Eolo (lo que se cobra). `TurnoAutotanqueController` usa el primero y `RemisionController` el segundo. La fórmula del precio Eolo sale del código a una tabla de configuración.

**Files:**
- Create: `database/migrations/2026_09_28_090400_create_fact_precios_combustible_table.php`
- Create: `database/migrations/2026_09_28_090500_create_fact_configuracion_table.php`
- Create: `app/Models/FactPrecioCombustible.php`
- Create: `app/Models/FactConfiguracion.php`
- Test: `tests/Feature/Facturacion/PrecioCombustibleTest.php`

**Interfaces:**
- Consumes: nada
- Produces: `FactPrecioCombustible::vigente(): ?self` (estático), `FactPrecioCombustible::registrar(float $precioAsa, ?float $precioEolo, int $userId): self` (estático, cierra el anterior en una transacción), `FactConfiguracion::valor(string $clave, $default = null)` y `FactConfiguracion::precioEoloSugerido(float $precioAsa): float`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/PrecioCombustibleTest.php

use App\Models\FactConfiguracion;
use App\Models\FactPrecioCombustible;
use App\Models\User;

test('el primer precio queda vigente y sin fecha de cierre', function () {
    $usuario = User::factory()->create();

    $precio = FactPrecioCombustible::registrar(22.50, null, $usuario->id);

    expect($precio->vigencia_fin)->toBeNull()
        ->and((float) $precio->precio_asa)->toBe(22.50)
        ->and(FactPrecioCombustible::vigente()->id)->toBe($precio->id);
});

test('el precio Eolo se sugiere con la formula del sistema viejo', function () {
    // actualizar_combustible.php: $peolo = ($pasa + 0.50) * 1.15
    expect(FactConfiguracion::precioEoloSugerido(22.50))->toBe(26.45);
});

test('se puede sobrescribir el precio Eolo sugerido', function () {
    $usuario = User::factory()->create();

    $precio = FactPrecioCombustible::registrar(22.50, 30.00, $usuario->id);

    expect((float) $precio->precio_eolo)->toBe(30.00);
});

test('registrar un precio nuevo cierra la vigencia del anterior', function () {
    $usuario = User::factory()->create();

    $viejo = FactPrecioCombustible::registrar(20.00, null, $usuario->id);
    $nuevo = FactPrecioCombustible::registrar(23.00, null, $usuario->id);

    expect($viejo->fresh()->vigencia_fin)->not->toBeNull()
        ->and(FactPrecioCombustible::vigente()->id)->toBe($nuevo->id)
        ->and(FactPrecioCombustible::whereNull('vigencia_fin')->count())->toBe(1);
});

test('sin precios registrados, vigente devuelve null', function () {
    expect(FactPrecioCombustible::vigente())->toBeNull();
});

test('la configuracion devuelve el valor por omision si la clave no existe', function () {
    expect(FactConfiguracion::valor('inexistente', 'respaldo'))->toBe('respaldo');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/PrecioCombustibleTest.php`
Expected: FAIL con `Class "App\Models\FactPrecioCombustible" not found`

- [ ] **Step 3: Write the migrations**

```php
<?php
// database/migrations/2026_09_28_090400_create_fact_precios_combustible_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Precio del combustible con historial.
 *
 * En el sistema viejo `tb_combustible` es una sola fila que se sobrescribe
 * (`WHERE id_combustible = 1`), así que no hay historial: la importación trae
 * esa fila como el registro vigente. Se guardan los dos precios porque hay
 * controladores que usan cada uno: Remisiones cobra con el de Eolo y Turno de
 * autotanque calcula con el de ASA.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_precios_combustible', function (Blueprint $table) {
            $table->id();
            $table->decimal('precio_asa', 10, 4);
            $table->decimal('precio_eolo', 10, 4);
            $table->date('vigencia_inicio')->index();
            $table->date('vigencia_fin')->nullable();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_precios_combustible');
    }
};
```

```php
<?php
// database/migrations/2026_09_28_090500_create_fact_configuracion_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint as B;
use Illuminate\Support\Facades\Schema;

/**
 * Constantes del módulo que en el sistema viejo estaban escritas en el código.
 * Se siembran aquí con los valores exactos que usa Prefacturas hoy, para que
 * ningún cobro cambie al migrar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_configuracion', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 60)->unique();
            $table->string('valor', 60);
            $table->string('descripcion', 200);
            $table->timestamps();
        });

        DB::table('fact_configuracion')->insert([
            [
                'clave' => 'combustible_ajuste',
                'valor' => '0.50',
                'descripcion' => 'Se suma al precio ASA antes del margen (actualizar_combustible.php).',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'clave' => 'combustible_margen',
                'valor' => '1.15',
                'descripcion' => 'Multiplicador sobre el precio ASA ajustado para obtener el precio Eolo.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_configuracion');
    }
};
```

- [ ] **Step 4: Write the models**

```php
<?php
// app/Models/FactConfiguracion.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactConfiguracion extends Model
{
    protected $table = 'fact_configuracion';

    protected $fillable = ['clave', 'valor', 'descripcion'];

    public static function valor(string $clave, $default = null)
    {
        return static::query()->where('clave', $clave)->value('valor') ?? $default;
    }

    /**
     * Precio que se cobra, derivado del costo. Reproduce la fórmula de
     * `actualizar_combustible.php`: ($pasa + 0.50) * 1.15.
     */
    public static function precioEoloSugerido(float $precioAsa): float
    {
        $ajuste = (float) static::valor('combustible_ajuste', 0.50);
        $margen = (float) static::valor('combustible_margen', 1.15);

        return round(($precioAsa + $ajuste) * $margen, 4);
    }
}
```

```php
<?php
// app/Models/FactPrecioCombustible.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class FactPrecioCombustible extends Model
{
    protected $table = 'fact_precios_combustible';

    protected $fillable = [
        'precio_asa',
        'precio_eolo',
        'vigencia_inicio',
        'vigencia_fin',
        'user_id',
    ];

    protected $casts = [
        'precio_asa' => 'decimal:4',
        'precio_eolo' => 'decimal:4',
        'vigencia_inicio' => 'date',
        'vigencia_fin' => 'date',
    ];

    /** El precio en uso: el único sin fecha de cierre. */
    public static function vigente(): ?self
    {
        return static::query()->whereNull('vigencia_fin')->latest('id')->first();
    }

    /**
     * Registra un precio nuevo y cierra el anterior. Si no se indica el precio
     * de Eolo se calcula con la fórmula de la configuración.
     */
    public static function registrar(float $precioAsa, ?float $precioEolo, int $userId): self
    {
        return DB::transaction(function () use ($precioAsa, $precioEolo, $userId) {
            $hoy = now()->timezone('America/Mexico_City')->toDateString();

            static::query()
                ->whereNull('vigencia_fin')
                ->update(['vigencia_fin' => $hoy, 'updated_at' => now()]);

            return static::create([
                'precio_asa' => $precioAsa,
                'precio_eolo' => $precioEolo ?? FactConfiguracion::precioEoloSugerido($precioAsa),
                'vigencia_inicio' => $hoy,
                'vigencia_fin' => null,
                'user_id' => $userId,
            ]);
        });
    }

    public function capturadoPor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/PrecioCombustibleTest.php`
Expected: PASS, 6 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 245 pruebas

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_28_0904*.php database/migrations/2026_09_28_0905*.php app/Models/FactPrecioCombustible.php app/Models/FactConfiguracion.php tests/Feature/Facturacion/PrecioCombustibleTest.php
git commit -m "Precio de combustible con vigencias y formula en configuracion"
```

---

### Task 4: El servicio `CatalogoAeronaves`

Reemplaza la lógica que hoy está duplicada en cinco controladores contra la conexión remota. Esta es la pieza central del bloque: todas las tasks siguientes la consumen.

**Files:**
- Create: `app/Services/CatalogoAeronaves.php`
- Create: `app/Services/DatosAeronave.php`
- Test: `tests/Feature/Facturacion/CatalogoAeronavesTest.php`

**Interfaces:**
- Consumes: `Aeronave`, `TipoAeronave`, `FactAeronave`, `FactCategoriaAeronave` de las Tasks 1 y 2
- Produces:
  - `DatosAeronave` — objeto de solo lectura con las propiedades públicas `string $matricula`, `?string $tipo`, `string $estatus`, `?string $categoria`, y el método `toArray(): array`
  - `CatalogoAeronaves::buscar(string $matricula): ?DatosAeronave`
  - `CatalogoAeronaves::buscarOCrear(string $matricula, ?string $tipo = null): Aeronave`
  - `CatalogoAeronaves::autocompletar(string $texto, int $limite = 10): array` — arreglo de strings

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/CatalogoAeronavesTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\TipoAeronave;
use App\Services\CatalogoAeronaves;

function catalogo(): CatalogoAeronaves
{
    return app(CatalogoAeronaves::class);
}

test('buscar devuelve los cuatro campos que daba el join remoto', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $aeronave = Aeronave::create(['matricula' => 'XA-ABC', 'aeronave_id' => $tipo->id]);
    $categoria = FactCategoriaAeronave::create(['nombre' => 'Ejecutiva', 'tarifa_pernocta' => 100, 'tarifa_transito_2h' => 50, 'tarifa_transito_12h' => 80]);
    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'categoria_aeronave_id' => $categoria->id,
        'estatus' => 'transito',
    ]);

    $datos = catalogo()->buscar('XA-ABC');

    expect($datos->matricula)->toBe('XA-ABC')
        ->and($datos->tipo)->toBe('Learjet 45')
        ->and($datos->estatus)->toBe('transito')
        ->and($datos->categoria)->toBe('Ejecutiva');
});

test('buscar devuelve null si la matricula no existe', function () {
    expect(catalogo()->buscar('XA-NADA'))->toBeNull();
});

test('buscar funciona con una matricula incompleta, sin tipo ni categoria', function () {
    Aeronave::create(['matricula' => 'XA-DEF']);

    $datos = catalogo()->buscar('XA-DEF');

    expect($datos->tipo)->toBeNull()
        ->and($datos->categoria)->toBeNull()
        ->and($datos->estatus)->toBe('guarda');
});

test('buscar normaliza la matricula a mayusculas y sin espacios', function () {
    Aeronave::create(['matricula' => 'XA-GHI']);

    expect(catalogo()->buscar('  xa-ghi  ')->matricula)->toBe('XA-GHI');
});

test('buscarOCrear crea la matricula con su satelite cuando no existe', function () {
    $aeronave = catalogo()->buscarOCrear('XA-JKL', 'Cessna 208');

    expect(Aeronave::count())->toBe(1)
        ->and($aeronave->matricula)->toBe('XA-JKL')
        ->and($aeronave->tipoAeronave->nombre)->toBe('Cessna 208')
        ->and($aeronave->facturacion)->not->toBeNull()
        ->and($aeronave->facturacion->categoria_aeronave_id)->toBeNull();
});

test('buscarOCrear no duplica: dos llamadas dejan una sola fila', function () {
    $primera = catalogo()->buscarOCrear('XA-MNO', 'Learjet 45');
    $segunda = catalogo()->buscarOCrear('xa-mno', 'Learjet 45');

    expect($primera->id)->toBe($segunda->id)
        ->and(Aeronave::count())->toBe(1)
        ->and(TipoAeronave::count())->toBe(1);
});

test('buscarOCrear reutiliza el tipo si ya existe con ese nombre', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);

    $aeronave = catalogo()->buscarOCrear('XA-PQR', 'learjet 45');

    expect(TipoAeronave::count())->toBe(1)
        ->and($aeronave->aeronave_id)->toBe($tipo->id);
});

test('buscarOCrear sin tipo deja la aeronave sin tipo y no crea uno vacio', function () {
    $aeronave = catalogo()->buscarOCrear('XA-STU');

    expect($aeronave->aeronave_id)->toBeNull()
        ->and(TipoAeronave::count())->toBe(0);
});

test('buscarOCrear respeta una aeronave existente sin pisarle el tipo', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Original']);
    Aeronave::create(['matricula' => 'XA-VWX', 'aeronave_id' => $tipo->id]);

    $aeronave = catalogo()->buscarOCrear('XA-VWX', 'Otro distinto');

    expect($aeronave->aeronave_id)->toBe($tipo->id)
        ->and(TipoAeronave::count())->toBe(1);
});

test('buscarOCrear le pone satelite a una aeronave vieja que no la tenia', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-YZA']);

    catalogo()->buscarOCrear('XA-YZA');

    expect($aeronave->fresh()->facturacion)->not->toBeNull();
});

test('autocompletar busca por coincidencia parcial y respeta el limite', function () {
    foreach (['XA-AAA', 'XA-AAB', 'XB-CCC'] as $matricula) {
        Aeronave::create(['matricula' => $matricula]);
    }

    expect(catalogo()->autocompletar('xa-aa'))->toBe(['XA-AAA', 'XA-AAB'])
        ->and(catalogo()->autocompletar('xa-aa', 1))->toBe(['XA-AAA'])
        ->and(catalogo()->autocompletar(''))->toBe([])
        ->and(catalogo()->autocompletar('   '))->toBe([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/CatalogoAeronavesTest.php`
Expected: FAIL con `Target class [App\Services\CatalogoAeronaves] does not exist.`

- [ ] **Step 3: Write `DatosAeronave`**

```php
<?php
// app/Services/DatosAeronave.php

namespace App\Services;

/**
 * Los cuatro campos que el sistema viejo obtenía con un join entre
 * tb_matricula, tb_estatus, tb_tipo y tb_categoria. Es el contrato que
 * consumen los controladores reapuntados.
 */
final class DatosAeronave
{
    public function __construct(
        public readonly string $matricula,
        public readonly ?string $tipo,
        public readonly string $estatus,
        public readonly ?string $categoria,
    ) {}

    public function toArray(): array
    {
        return [
            'matricula' => $this->matricula,
            'tipo' => $this->tipo,
            'estatus' => $this->estatus,
            'categoria' => $this->categoria,
        ];
    }
}
```

- [ ] **Step 4: Write `CatalogoAeronaves`**

```php
<?php
// app/Services/CatalogoAeronaves.php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\TipoAeronave;
use Illuminate\Support\Facades\DB;

/**
 * Punto único de acceso al catálogo de matrículas.
 *
 * Reemplaza la lógica que vivía duplicada en cinco controladores contra la
 * conexión `remota` a la base de Prefacturas: buscar la matrícula y, si no
 * existía, insertarla con un cuerpo de ceros.
 */
class CatalogoAeronaves
{
    public function buscar(string $matricula): ?DatosAeronave
    {
        $aeronave = Aeronave::query()
            ->with(['tipoAeronave', 'facturacion.categoria'])
            ->where('matricula', $this->normalizar($matricula))
            ->first();

        if (! $aeronave) {
            return null;
        }

        return new DatosAeronave(
            matricula: $aeronave->matricula,
            tipo: $aeronave->tipoAeronave?->nombre,
            estatus: $aeronave->facturacion?->estatus ?? FactAeronave::ESTATUS_TRANSITO,
            categoria: $aeronave->facturacion?->categoria?->nombre,
        );
    }

    /**
     * Devuelve la aeronave, creándola si no existía. Una aeronave que ya
     * existe no cambia de tipo: el dato del catálogo manda sobre el que venga
     * en la captura.
     */
    public function buscarOCrear(string $matricula, ?string $tipo = null): Aeronave
    {
        $matricula = $this->normalizar($matricula);

        return DB::transaction(function () use ($matricula, $tipo) {
            $aeronave = Aeronave::query()->where('matricula', $matricula)->first();

            if (! $aeronave) {
                $aeronave = Aeronave::create([
                    'matricula' => $matricula,
                    'aeronave_id' => $this->resolverTipo($tipo),
                ]);
            }

            // Una aeronave dada de alta antes de este módulo no tiene satélite.
            FactAeronave::firstOrCreate(['aeronave_id' => $aeronave->id]);

            return $aeronave->load(['tipoAeronave', 'facturacion']);
        });
    }

    /** @return string[] */
    public function autocompletar(string $texto, int $limite = 10): array
    {
        $texto = $this->normalizar($texto);

        if ($texto === '') {
            return [];
        }

        return Aeronave::query()
            ->where('matricula', 'like', "%{$texto}%")
            ->orderBy('matricula')
            ->limit($limite)
            ->pluck('matricula')
            ->all();
    }

    /** Busca el tipo por nombre sin distinguir mayúsculas, o lo crea. */
    private function resolverTipo(?string $tipo): ?int
    {
        $tipo = trim((string) $tipo);

        if ($tipo === '') {
            return null;
        }

        $existente = TipoAeronave::query()
            ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($tipo)])
            ->first();

        return $existente?->id ?? TipoAeronave::create(['nombre' => $tipo])->id;
    }

    private function normalizar(string $matricula): string
    {
        return mb_strtoupper(trim($matricula));
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/CatalogoAeronavesTest.php`
Expected: PASS, 11 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 256 pruebas

- [ ] **Step 7: Commit**

```bash
git add app/Services/CatalogoAeronaves.php app/Services/DatosAeronave.php tests/Feature/Facturacion/CatalogoAeronavesTest.php
git commit -m "Servicio CatalogoAeronaves: buscar, buscarOCrear y autocompletar"
```

---

### Task 5: Reapuntar `AeronaveController`

El más usado: su autocompletado alimenta Operaciones Diarias, WalkAround, Remisiones, Préstamo de chalecos y Comisariato. Es donde un error se nota de inmediato.

**Files:**
- Modify: `app/Http/Controllers/Api/AeronaveController.php:25-33` (`buscarPorMatricula`), `:62-68` (`autocomplete`), `:124` (`tipoAeronave`)
- Test: `tests/Feature/Facturacion/AeronaveControllerLocalTest.php`

**Interfaces:**
- Consumes: `CatalogoAeronaves::buscar()`, `::autocompletar()` de la Task 4
- Produces: nada nuevo; conserva el contrato JSON actual

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/AeronaveControllerLocalTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\TipoAeronave;
use App\Models\User;

test('buscar por matricula resuelve el tipo sin la base remota', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $aeronave = Aeronave::create(['matricula' => 'XA-ABC', 'aeronave_id' => $tipo->id]);
    FactAeronave::create(['aeronave_id' => $aeronave->id]);

    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/buscar/XA-ABC')
        ->assertOk()
        ->assertJsonPath('matricula', 'XA-ABC')
        ->assertJsonPath('tipo', 'Learjet 45');
});

test('buscar una matricula inexistente responde con el tipo nulo, sin romper', function () {
    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/buscar/XA-NADA')
        ->assertOk()
        ->assertJsonPath('matricula', 'XA-NADA')
        ->assertJsonPath('tipo', null);
});

test('el autocompletado lee del catalogo local', function () {
    foreach (['XA-AAA', 'XA-AAB', 'XB-CCC'] as $matricula) {
        Aeronave::create(['matricula' => $matricula]);
    }

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/aeronaves/autocomplete?q=xa-aa')->assertOk()->json();

    expect(collect($respuesta)->pluck('matricula')->all())->toBe(['XA-AAA', 'XA-AAB']);
});

test('el autocompletado sin texto devuelve vacio', function () {
    Aeronave::create(['matricula' => 'XA-AAA']);
    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/autocomplete?q=')->assertOk()->assertJsonCount(0);
});

test('la categoria viaja en la respuesta cuando la matricula ya esta clasificada', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-DEF']);
    $categoria = FactCategoriaAeronave::create(['nombre' => 'Ejecutiva', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1]);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'categoria_aeronave_id' => $categoria->id]);

    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/buscar/XA-DEF')->assertOk()->assertJsonPath('categoria', 'Ejecutiva');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/AeronaveControllerLocalTest.php`
Expected: FAIL. Las pruebas que hoy pegan a la conexión remota fallan con un error de conexión, y `categoria` no existe en la respuesta.

- [ ] **Step 3: Rewrite `buscarPorMatricula`**

Reemplazar el bloque `DB::connection('remota')` (líneas 25-33) y el `return` que le sigue:

```php
    public function __construct(private readonly CatalogoAeronaves $catalogo) {}

    public function buscarPorMatricula(string $matricula): JsonResponse
    {
        try {
            $aeronave = Aeronave::where('matricula', $matricula)->first();

            $ultimoWalk = WalkAround::where('matricula', $matricula)
                ->orderByDesc('fecha')
                ->orderByDesc('hora')
                ->first();

            $datos = $this->catalogo->buscar($matricula);

            return response()->json([
                'matricula'      => $aeronave->matricula ?? $matricula,
                'destino'        => $ultimoWalk->destino ?? null,
                'procedensia'    => $ultimoWalk->procedensia ?? null,
                'idTipoAeronave' => $aeronave->aeronave_id ?? ($ultimoWalk->tipo_aeronave_id ?? null),
                'movimiento'     => $ultimoWalk->movimiento ?? null,
                'tipo_aeronave'  => $aeronave->tipo_aeronave ?? ($ultimoWalk->tipo ?? null),
                'tipo'           => $datos?->tipo,
                'categoria'      => $datos?->categoria,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error al buscar aeronave: ' . $e->getMessage());

            return response()->json(['error' => 'Error interno del servidor'], 500);
        }
    }
```

Agregar el import `use App\Services\CatalogoAeronaves;`.

- [ ] **Step 4: Rewrite `autocomplete`**

Sustituir el bloque de las líneas 56-68 por:

```php
            $matriculas = $this->catalogo->autocompletar($q);

            if (empty($matriculas)) {
                return response()->json([]);
            }
```

Eliminar la línea `$configRemota = config('database.connections.remota');`, que además no se usaba. El resto del método, que cruza con `walk_arounds`, no cambia.

- [ ] **Step 5: Rewrite `tipoAeronave`**

Sustituir el `DB::connection('remota')` de la línea 124 por `$this->catalogo->buscar($matricula)?->tipo`, conservando la forma de la respuesta que ya devuelve el método.

- [ ] **Step 6: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/AeronaveControllerLocalTest.php`
Expected: PASS, 5 pruebas

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: PASS, 261 pruebas

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Api/AeronaveController.php tests/Feature/Facturacion/AeronaveControllerLocalTest.php
git commit -m "AeronaveController lee el catalogo local en vez de la base remota"
```

---

### Task 6: Reapuntar los cinco controladores que dan de alta matrículas

`OperacionesDiariasController`, `WalkAroundController`, `MovimientoCSAEController`, `ServicioComisariatoController` y `PernoctaDiaController` repiten la misma secuencia: resolver el tipo en `tb_tipo`, buscar la matrícula en `tb_matricula` y, si no está, insertarla con ceros. Las cinco se colapsan en una llamada.

**Files:**
- Modify: `app/Http/Controllers/Api/OperacionesDiariasController.php:72-105`
- Modify: `app/Http/Controllers/Api/WalkAroundController.php:133-140` y `:314-340`
- Modify: `app/Http/Controllers/Api/MovimientoCSAEController.php` (los cuatro bloques `connection('remota')`)
- Modify: `app/Http/Controllers/Api/ServicioComisariatoController.php:27-55`
- Modify: `app/Http/Controllers/Api/PernoctaDiaController.php:476-530` y `:582`
- Test: `tests/Feature/Facturacion/AltaAutomaticaMatriculaTest.php`

**Interfaces:**
- Consumes: `CatalogoAeronaves::buscar()`, `::buscarOCrear()`, `::autocompletar()` de la Task 4
- Produces: nada nuevo

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/AltaAutomaticaMatriculaTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\TipoAeronave;
use App\Services\CatalogoAeronaves;

/*
 * Cinco controladores daban de alta matrículas en la base de Prefacturas
 * cuando no existían. Ahora lo hacen en el catálogo local por un solo camino.
 */

test('capturar una operacion con matricula nueva la agrega al catalogo local', function () {
    $usuario = usuarioConSubdepartamento('operacionesDiarias', 'Trafico');
    $this->actingAs($usuario);

    $this->postJson('/api/EntregarTurno/OperacionDiaria', [
        'fecha' => '2026-09-28',
        'tipo' => 'llegada',
        'matricula' => 'XA-NUEVA',
        'equipo' => 'Learjet 45',
        'hora' => '10:00',
        'lugar' => 'Toluca',
        'pax' => 3,
    ])->assertSuccessful();

    $aeronave = Aeronave::where('matricula', 'XA-NUEVA')->first();

    expect($aeronave)->not->toBeNull()
        ->and($aeronave->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and($aeronave->facturacion)->not->toBeNull();
});

test('capturar dos operaciones de la misma matricula no la duplica', function () {
    $catalogo = app(CatalogoAeronaves::class);

    $catalogo->buscarOCrear('XA-REPE', 'Cessna 208');
    $catalogo->buscarOCrear('XA-REPE', 'Cessna 208');

    expect(Aeronave::where('matricula', 'XA-REPE')->count())->toBe(1)
        ->and(TipoAeronave::where('nombre', 'Cessna 208')->count())->toBe(1)
        ->and(FactAeronave::count())->toBe(1);
});

test('una matricula que ya existia no se vuelve a crear ni cambia de tipo', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Original']);
    Aeronave::create(['matricula' => 'XA-VIEJA', 'aeronave_id' => $tipo->id]);

    app(CatalogoAeronaves::class)->buscarOCrear('XA-VIEJA', 'Otro');

    expect(Aeronave::count())->toBe(1)
        ->and(Aeronave::first()->aeronave_id)->toBe($tipo->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/AltaAutomaticaMatriculaTest.php`
Expected: FAIL en la primera prueba, con un error de conexión a la base remota al intentar leer `tb_tipo`.

- [ ] **Step 3: Rewrite the block in each controller**

En los cinco, inyectar el servicio por constructor y sustituir el bloque completo. El patrón, tomando `OperacionesDiariasController` como ejemplo:

```php
// Antes: cuatro consultas a la conexión remota (tb_tipo x2, tb_matricula x2)
// Después:
$this->catalogo->buscarOCrear($matricula, $validated['equipo'] ?? null);
```

Para los que además leían datos del join (`ServicioComisariatoController`, `PernoctaDiaController`, `WalkAroundController`), la lectura queda:

```php
$datos = $this->catalogo->buscar($matricula);
// $datos?->matricula, $datos?->tipo, $datos?->estatus, $datos?->categoria
```

En `PernoctaDiaController:582`, el listado de matrículas pasa a
`$this->catalogo->autocompletar($texto, $limite)`.

Al terminar cada archivo, quitar el `use Illuminate\Support\Facades\DB;` si ya no se usa para nada más, y agregar `use App\Services\CatalogoAeronaves;`.

- [ ] **Step 4: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/AltaAutomaticaMatriculaTest.php`
Expected: PASS, 3 pruebas

- [ ] **Step 5: Run the full suite**

Run: `php artisan test`
Expected: PASS, 264 pruebas. Las pruebas existentes de Operaciones Diarias y WalkAround deben seguir en verde sin tocarlas: si alguna falla, el contrato JSON cambió y hay que corregir el controlador, no la prueba.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/ tests/Feature/Facturacion/AltaAutomaticaMatriculaTest.php
git commit -m "Cinco controladores dan de alta matriculas en el catalogo local"
```

---

### Task 7: Reapuntar los dos controladores de combustible y cerrar la puerta

`RemisionController` cobra con el precio Eolo y `TurnoAutotanqueController` calcula con el ASA. Al final, una prueba impide que la conexión remota vuelva a colarse en un controlador.

**Files:**
- Modify: `app/Http/Controllers/Api/RemisionController.php:42-48`
- Modify: `app/Http/Controllers/Api/TurnoAutotanqueController.php:103-109`
- Test: `tests/Feature/Facturacion/SinConexionRemotaTest.php`

**Interfaces:**
- Consumes: `FactPrecioCombustible::vigente()` de la Task 3
- Produces: nada nuevo

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/SinConexionRemotaTest.php

use App\Models\FactPrecioCombustible;
use App\Models\User;

test('ningun controlador usa ya la conexion remota a Prefacturas', function () {
    $culpables = [];

    $archivos = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(app_path('Http/Controllers'))
    );

    foreach ($archivos as $archivo) {
        if ($archivo->getExtension() !== 'php') {
            continue;
        }

        if (str_contains(file_get_contents($archivo->getPathname()), "connection('remota')")) {
            $culpables[] = $archivo->getFilename();
        }
    }

    expect($culpables)->toBe([]);
});

test('el precio de combustible vigente sale del catalogo local', function () {
    $usuario = User::factory()->create();
    FactPrecioCombustible::registrar(20.00, null, $usuario->id);
    $vigente = FactPrecioCombustible::registrar(22.50, 26.45, $usuario->id);

    expect((float) FactPrecioCombustible::vigente()->precio_eolo)->toBe(26.45)
        ->and((float) FactPrecioCombustible::vigente()->precio_asa)->toBe(22.50)
        ->and(FactPrecioCombustible::vigente()->id)->toBe($vigente->id);
});

test('sin precio registrado los controladores usan cero, como hacian antes', function () {
    expect(FactPrecioCombustible::vigente()?->precio_eolo ?? 0)->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/SinConexionRemotaTest.php`
Expected: FAIL en la primera prueba, listando `RemisionController.php` y `TurnoAutotanqueController.php`

- [ ] **Step 3: Rewrite `RemisionController`**

Sustituir las líneas 42-48:

```php
                // El precio que se cobra al cliente. Sin precio capturado se usa
                // 0, igual que hacía la consulta remota.
                $precio = (float) (FactPrecioCombustible::vigente()?->precio_eolo ?? 0);
```

Agregar `use App\Models\FactPrecioCombustible;`.

- [ ] **Step 4: Rewrite `TurnoAutotanqueController`**

Sustituir las líneas 103-109:

```php
                // Precio ASA: el costo, no lo que se cobra.
                $precio = (float) (FactPrecioCombustible::vigente()?->precio_asa ?? 0);
```

Agregar `use App\Models\FactPrecioCombustible;`.

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/SinConexionRemotaTest.php`
Expected: PASS, 3 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 267 pruebas

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Api/RemisionController.php app/Http/Controllers/Api/TurnoAutotanqueController.php tests/Feature/Facturacion/SinConexionRemotaTest.php
git commit -m "Combustible desde el catalogo local; ningun controlador usa la base remota"
```

---

### Task 8: Importador desde `fact-fbo`

El entregable que decide si el modelo se sostiene. Corre en simulación por omisión.

**Files:**
- Create: `app/Console/Commands/ImportarMatriculasPrefactura.php`
- Create: `app/Services/ImportadorMatriculas.php`
- Test: `tests/Feature/Facturacion/ImportadorMatriculasTest.php`

**Interfaces:**
- Consumes: todos los modelos de las Tasks 1 a 3
- Produces: `ImportadorMatriculas::ejecutar(bool $aplicar): ResultadoImportacion`, donde `ResultadoImportacion` tiene `array $conteos` (clave → entero) y `array $hallazgos` (lista de strings)

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/ImportadorMatriculasTest.php

use App\Models\Aeronave;
use App\Models\FactCategoriaAeronave;
use App\Services\ImportadorMatriculas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Crea en sqlite las tablas de fact-fbo que lee el importador. */
function prepararBaseLegacy(): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:']]);
    $esquema = Schema::connection('remota');

    $esquema->create('tb_tipo', function ($t) {
        $t->integer('id_tipo', true);
        $t->string('tipo');
    });
    $esquema->create('tb_categoria', function ($t) {
        $t->integer('id_categoria', true);
        $t->string('categoria');
    });
    $esquema->create('tb_motor', function ($t) {
        $t->integer('id_motor', true);
        $t->string('motor');
    });
    $esquema->create('tb_pernocta', function ($t) {
        $t->integer('id_pernocta', true);
        $t->decimal('pernocta', 10, 2);
    });
    $esquema->create('tb_transito2h', function ($t) {
        $t->integer('id_transito2h', true);
        $t->decimal('transito', 10, 2);
    });
    $esquema->create('tb_transito12h', function ($t) {
        $t->integer('id_transito12h', true);
        $t->decimal('transito12', 10, 2);
    });
    $esquema->create('tb_aterrisaje', function ($t) {
        $t->integer('id_aterrizaje', true);
        $t->decimal('aterrizaje', 10, 2);
    });
    $esquema->create('tb_matricula', function ($t) {
        $t->integer('id_matricula', true);
        $t->string('matricula');
        $t->integer('id_estatus');
        $t->integer('id_tipo');
        $t->integer('id_categoria');
        $t->integer('id_motor');
        $t->integer('id_aterrizaje');
        $t->integer('id_transito2h');
        $t->integer('id_transito12h');
        $t->integer('id_pernocta');
        $t->integer('d_vuelos');
    });
    $esquema->create('tb_combustible', function ($t) {
        $t->integer('id_combustible', true);
        $t->decimal('p_combustible', 10, 4);
        $t->date('f_ini');
        $t->date('f_fin');
        $t->decimal('pasa', 10, 4);
    });
}

function sembrarLegacy(array $matriculas): void
{
    $remota = DB::connection('remota');
    $remota->table('tb_tipo')->insert(['id_tipo' => 1, 'tipo' => 'Learjet 45']);
    $remota->table('tb_categoria')->insert(['id_categoria' => 1, 'categoria' => 'Ejecutiva']);
    $remota->table('tb_motor')->insert(['id_motor' => 1, 'motor' => 'Jet']);
    $remota->table('tb_pernocta')->insert([['id_pernocta' => 1, 'pernocta' => 1200], ['id_pernocta' => 2, 'pernocta' => 9999]]);
    $remota->table('tb_transito2h')->insert(['id_transito2h' => 1, 'transito' => 300]);
    $remota->table('tb_transito12h')->insert(['id_transito12h' => 1, 'transito12' => 700]);
    $remota->table('tb_aterrisaje')->insert(['id_aterrizaje' => 1, 'aterrizaje' => 900]);
    $remota->table('tb_combustible')->insert(['id_combustible' => 1, 'p_combustible' => 26.45, 'f_ini' => '2026-09-01', 'f_fin' => '2026-09-30', 'pasa' => 22.50]);
    $remota->table('tb_matricula')->insert($matriculas);
}

function matriculaLegacy(string $matricula, int $idPernocta = 1, int $idCategoria = 1): array
{
    return [
        'matricula' => $matricula,
        'id_estatus' => 1,
        'id_tipo' => 1,
        'id_categoria' => $idCategoria,
        'id_motor' => 1,
        'id_aterrizaje' => 1,
        'id_transito2h' => 1,
        'id_transito12h' => 1,
        'id_pernocta' => $idPernocta,
        'd_vuelos' => 0,
    ];
}

beforeEach(fn () => prepararBaseLegacy());

test('la simulacion cuenta lo que traeria pero no escribe nada', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA'), matriculaLegacy('XA-BBB')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['matriculas'])->toBe(2)
        ->and(Aeronave::count())->toBe(0)
        ->and(FactCategoriaAeronave::count())->toBe(0);
});

test('aplicar trae matriculas, tipos, categorias y tarifas', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $aeronave = Aeronave::where('matricula', 'XA-AAA')->first();
    $categoria = FactCategoriaAeronave::first();

    expect($aeronave)->not->toBeNull()
        ->and($aeronave->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and($aeronave->facturacion->categoria->nombre)->toBe('Ejecutiva')
        ->and((float) $categoria->tarifa_pernocta)->toBe(1200.00)
        ->and((float) $categoria->tarifa_transito_12h)->toBe(700.00);
});

test('correrlo dos veces deja el mismo resultado', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::count())->toBe(1)
        ->and(FactCategoriaAeronave::count())->toBe(1);
});

test('reporta cuando dos matriculas de la misma categoria tienen tarifas distintas', function () {
    // El sistema viejo copia las tarifas con LIMIT 1: si divergen, el modelo
    // "tarifa por categoria" no se sostiene.
    sembrarLegacy([
        matriculaLegacy('XA-AAA', idPernocta: 1),
        matriculaLegacy('XA-BBB', idPernocta: 2),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect(implode(' ', $resultado->hallazgos))->toContain('Ejecutiva');
});

test('las matriculas sin categoria se importan sin clasificar y se cuentan', function () {
    sembrarLegacy([matriculaLegacy('XA-SIN', idCategoria: 0)]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-SIN')->first()->facturacion->categoria_aeronave_id)->toBeNull()
        ->and($resultado->conteos['matriculas_sin_categoria'])->toBe(1);
});

test('las matriculas repetidas se reportan y se importan una sola vez', function () {
    sembrarLegacy([matriculaLegacy('XA-DUP'), matriculaLegacy('XA-DUP')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-DUP')->count())->toBe(1)
        ->and(implode(' ', $resultado->hallazgos))->toContain('XA-DUP');
});

test('el precio de combustible llega con sus dos precios', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $precio = App\Models\FactPrecioCombustible::vigente();

    expect((float) $precio->precio_asa)->toBe(22.50)
        ->and((float) $precio->precio_eolo)->toBe(26.45);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/ImportadorMatriculasTest.php`
Expected: FAIL con `Target class [App\Services\ImportadorMatriculas] does not exist.`

- [ ] **Step 3: Write the importer**

```php
<?php
// app/Services/ImportadorMatriculas.php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactPrecioCombustible;
use App\Models\FactTipoMotor;
use App\Models\TipoAeronave;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class ResultadoImportacion
{
    /** @var array<string,int> */
    public array $conteos = [];

    /** @var string[] */
    public array $hallazgos = [];

    public function contar(string $clave, int $cuantos = 1): void
    {
        $this->conteos[$clave] = ($this->conteos[$clave] ?? 0) + $cuantos;
    }

    public function hallazgo(string $texto): void
    {
        $this->hallazgos[] = $texto;
    }
}

/**
 * Trae de la base de Prefacturas lo que cuelga de la matrícula.
 *
 * La simulación recorre el mismo camino que la ejecución real y revierte al
 * final: así el reporte refleja lo que de verdad pasaría, y no una estimación.
 */
class ImportadorMatriculas
{
    private ResultadoImportacion $resultado;

    public function ejecutar(bool $aplicar): ResultadoImportacion
    {
        $this->resultado = new ResultadoImportacion();

        DB::beginTransaction();

        try {
            $tipos = $this->importarTipos();
            $categorias = $this->importarCategorias();
            $motores = $this->importarMotores();
            $this->importarMatriculas($tipos, $categorias, $motores);
            $this->importarCombustible();

            $aplicar ? DB::commit() : DB::rollBack();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $this->resultado;
    }

    private function legacy(string $tabla)
    {
        return DB::connection('remota')->table($tabla);
    }

    /** @return array<int,int> id_tipo viejo => id de tipo_aeronaves */
    private function importarTipos(): array
    {
        $mapa = [];
        $vistos = [];

        foreach ($this->legacy('tb_tipo')->get() as $fila) {
            $nombre = trim((string) $fila->tipo);

            if ($nombre === '') {
                continue;
            }

            $llave = mb_strtolower($nombre);

            // Validación 5: el mismo tipo escrito de dos formas distintas.
            if (isset($vistos[$llave])) {
                $this->resultado->hallazgo("Tipo duplicado con distinta escritura: '{$vistos[$llave]}' y '{$nombre}'.");
            }

            $vistos[$llave] = $nombre;

            $tipo = TipoAeronave::query()->whereRaw('LOWER(nombre) = ?', [$llave])->first()
                ?? TipoAeronave::create(['nombre' => $nombre]);

            $mapa[$fila->id_tipo] = $tipo->id;
            $this->resultado->contar('tipos');
        }

        return $mapa;
    }

    /**
     * Las tarifas de estancia se deducen de las matrículas que usan cada
     * categoría, porque el sistema viejo las copiaba con LIMIT 1 desde una
     * matrícula vecina. Si divergen, el modelo "tarifa por categoría" no aplica.
     *
     * @return array<int,int> id_categoria viejo => id de fact_categorias_aeronave
     */
    private function importarCategorias(): array
    {
        $mapa = [];

        foreach ($this->legacy('tb_categoria')->get() as $fila) {
            $nombre = trim((string) $fila->categoria);

            if ($nombre === '' || (int) $fila->id_categoria === 0) {
                continue;
            }

            $combinaciones = $this->legacy('tb_matricula as m')
                ->leftJoin('tb_pernocta as p', 'p.id_pernocta', '=', 'm.id_pernocta')
                ->leftJoin('tb_transito2h as t2', 't2.id_transito2h', '=', 'm.id_transito2h')
                ->leftJoin('tb_transito12h as t12', 't12.id_transito12h', '=', 'm.id_transito12h')
                ->where('m.id_categoria', $fila->id_categoria)
                ->selectRaw('p.pernocta, t2.transito, t12.transito12, COUNT(*) as cuantas')
                ->groupBy('p.pernocta', 't2.transito', 't12.transito12')
                ->orderByDesc('cuantas')
                ->get();

            if ($combinaciones->isEmpty()) {
                continue;
            }

            // Validación 1: divergencia de tarifas dentro de una misma categoría.
            if ($combinaciones->count() > 1) {
                $detalle = $combinaciones
                    ->map(fn ($c) => "pernocta {$c->pernocta} / 2h {$c->transito} / 12h {$c->transito12} en {$c->cuantas} matrículas")
                    ->implode('; ');

                $this->resultado->hallazgo("La categoría '{$nombre}' tiene tarifas distintas entre sus matrículas: {$detalle}. Se toma la más frecuente.");
            }

            $tarifas = $combinaciones->first();

            $categoria = FactCategoriaAeronave::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'tarifa_pernocta' => $tarifas->pernocta ?? 0,
                    'tarifa_transito_2h' => $tarifas->transito ?? 0,
                    'tarifa_transito_12h' => $tarifas->transito12 ?? 0,
                ],
            );

            $mapa[$fila->id_categoria] = $categoria->id;
            $this->resultado->contar('categorias');
        }

        return $mapa;
    }

    /** @return array<int,int> id_motor viejo => id de fact_tipos_motor */
    private function importarMotores(): array
    {
        $mapa = [];

        foreach ($this->legacy('tb_motor')->get() as $fila) {
            $nombre = trim((string) $fila->motor);

            if ($nombre === '' || (int) $fila->id_motor === 0) {
                continue;
            }

            $tarifa = $this->legacy('tb_matricula as m')
                ->leftJoin('tb_aterrisaje as a', 'a.id_aterrizaje', '=', 'm.id_aterrizaje')
                ->where('m.id_motor', $fila->id_motor)
                ->value('a.aterrizaje');

            $motor = FactTipoMotor::updateOrCreate(
                ['nombre' => $nombre],
                ['tarifa_aterrizaje' => $tarifa ?? 0],
            );

            $mapa[$fila->id_motor] = $motor->id;
            $this->resultado->contar('motores');
        }

        return $mapa;
    }

    private function importarMatriculas(array $tipos, array $categorias, array $motores): void
    {
        $procesadas = [];

        foreach ($this->legacy('tb_matricula')->orderBy('id_matricula')->get() as $fila) {
            $matricula = mb_strtoupper(trim((string) $fila->matricula));

            if ($matricula === '') {
                continue;
            }

            // Validación 2: matrículas repetidas en el origen.
            if (isset($procesadas[$matricula])) {
                $this->resultado->hallazgo("Matrícula repetida en tb_matricula: {$matricula}. Se importa una sola vez.");
                $this->resultado->contar('matriculas_duplicadas');

                continue;
            }

            $procesadas[$matricula] = true;

            $aeronave = Aeronave::firstOrCreate(
                ['matricula' => $matricula],
                ['aeronave_id' => $tipos[$fila->id_tipo] ?? null],
            );

            $categoriaId = $categorias[$fila->id_categoria] ?? null;

            // Validación 4: el id_categoria = 0 del sistema viejo.
            if ($categoriaId === null) {
                $this->resultado->contar('matriculas_sin_categoria');
            }

            FactAeronave::updateOrCreate(
                ['aeronave_id' => $aeronave->id],
                [
                    'categoria_aeronave_id' => $categoriaId,
                    'tipo_motor_id' => $motores[$fila->id_motor] ?? null,
                    'estatus' => (int) $fila->id_estatus === 1
                        ? FactAeronave::ESTATUS_TRANSITO
                        : FactAeronave::ESTATUS_GUARDA,
                    'cobra_derecho_vuelos' => (int) $fila->d_vuelos === 0,
                ],
            );

            $this->resultado->contar('matriculas');
        }

        // Validación 3: matrículas locales que el sistema viejo no conoce.
        $huerfanas = Aeronave::query()
            ->whereNotIn('matricula', array_keys($procesadas))
            ->pluck('matricula');

        foreach ($huerfanas as $matricula) {
            $this->resultado->hallazgo("La matrícula {$matricula} existe en Eolo-plus pero no en tb_matricula.");
        }
    }

    private function importarCombustible(): void
    {
        $fila = $this->legacy('tb_combustible')->orderBy('id_combustible')->first();

        if (! $fila) {
            return;
        }

        $usuario = User::query()->orderBy('id')->value('id');

        if ($usuario === null) {
            $this->resultado->hallazgo('No hay usuarios en Eolo-plus: el precio de combustible no se pudo importar.');

            return;
        }

        FactPrecioCombustible::updateOrCreate(
            ['vigencia_inicio' => $fila->f_ini, 'vigencia_fin' => null],
            [
                'precio_asa' => $fila->pasa,
                'precio_eolo' => $fila->p_combustible,
                'user_id' => $usuario,
            ],
        );

        $this->resultado->contar('precios_combustible');
    }
}
```

Las cinco validaciones de la especificación quedan en el código: divergencia de tarifas en `importarCategorias`, repetidas y huérfanas en `importarMatriculas`, sin categoría en el conteo `matriculas_sin_categoria`, y tipos con distinta escritura en `importarTipos`.

- [ ] **Step 4: Write the Artisan command**

```php
<?php
// app/Console/Commands/ImportarMatriculasPrefactura.php

namespace App\Console\Commands;

use App\Services\ImportadorMatriculas;
use Illuminate\Console\Command;

class ImportarMatriculasPrefactura extends Command
{
    protected $signature = 'facturacion:importar-matriculas {--aplicar : Escribe los cambios; sin esta bandera solo simula}';

    protected $description = 'Importa matrículas, tipos, categorías, motores y combustible desde la base de Prefacturas';

    public function handle(ImportadorMatriculas $importador): int
    {
        $aplicar = (bool) $this->option('aplicar');

        $this->info($aplicar ? 'Importando…' : 'Simulación: no se escribirá nada.');

        $resultado = $importador->ejecutar($aplicar);

        $this->newLine();
        $this->table(
            ['Concepto', 'Cantidad'],
            collect($resultado->conteos)->map(fn ($v, $k) => [$k, $v])->values()->all(),
        );

        if ($resultado->hallazgos === []) {
            $this->info('Sin hallazgos.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->warn('Hallazgos que conviene revisar antes de aplicar:');

        foreach ($resultado->hallazgos as $hallazgo) {
            $this->line("  · {$hallazgo}");
        }

        return self::SUCCESS;
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/ImportadorMatriculasTest.php`
Expected: PASS, 7 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 274 pruebas

- [ ] **Step 7: Commit**

```bash
git add app/Console/Commands/ImportarMatriculasPrefactura.php app/Services/ImportadorMatriculas.php tests/Feature/Facturacion/ImportadorMatriculasTest.php
git commit -m "Importador de matriculas desde la base de Prefacturas, con simulacion"
```

---

### Task 9: Endpoints, permisos y bitácora

**Files:**
- Create: `app/Http/Controllers/Api/Facturacion/CategoriaAeronaveController.php`
- Create: `app/Http/Controllers/Api/Facturacion/TipoMotorController.php`
- Create: `app/Http/Controllers/Api/Facturacion/PrecioCombustibleController.php`
- Create: `app/Http/Controllers/Api/Facturacion/AeronaveFacturacionController.php`
- Create: `app/Http/Requests/Facturacion/` (un Form Request por escritura)
- Create: `database/seeders/FacturacionSubdepartamentosSeeder.php`
- Modify: `app/Models/Bitacora.php` (constante nueva)
- Modify: `routes/api.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/Facturacion/EndpointsCatalogosTest.php`

**Interfaces:**
- Consumes: los modelos de las Tasks 1 a 3
- Produces: `Bitacora::MODULO_FACTURACION_CATALOGOS = 'FACTURACION_CATALOGOS'`; rutas bajo `api/facturacion`

- [ ] **Step 1: Add the audit constant**

En `app/Models/Bitacora.php`, después de `MODULO_GESTION_USUARIOS`:

```php
    public const MODULO_FACTURACION_CATALOGOS = 'FACTURACION_CATALOGOS';
```

- [ ] **Step 2: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/EndpointsCatalogosTest.php

use App\Models\Bitacora;
use App\Models\FactCategoriaAeronave;
use App\Models\User;

function categoriaValida(array $extra = []): array
{
    return array_merge([
        'nombre' => 'Ejecutiva',
        'tarifa_pernocta' => 1200,
        'tarifa_transito_2h' => 300,
        'tarifa_transito_12h' => 700,
    ], $extra);
}

test('sin sesion no se puede consultar ni escribir', function () {
    $this->getJson('/api/facturacion/categorias-aeronave')->assertUnauthorized();
    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())->assertUnauthorized();
});

test('consultar es abierto a autenticados pero escribir exige el subdepartamento', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/facturacion/categorias-aeronave')->assertOk();
    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())->assertForbidden();
});

test('con el subdepartamento se da de alta y queda en bitacora', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())
        ->assertCreated()
        ->assertJsonPath('categoria.nombre', 'Ejecutiva');

    expect(FactCategoriaAeronave::count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_CREAR)->exists())->toBeTrue();
});

test('el nombre repetido se rechaza con 422', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    FactCategoriaAeronave::create(categoriaValida());

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nombre']);
});

test('las tarifas negativas se rechazan', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida(['tarifa_pernocta' => -1]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['tarifa_pernocta']);
});

test('desactivar es atomico: la segunda vez responde 409', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    $categoria = FactCategoriaAeronave::create(categoriaValida());

    $this->patchJson("/api/facturacion/categorias-aeronave/{$categoria->id}/desactivar")->assertOk();

    $this->patchJson("/api/facturacion/categorias-aeronave/{$categoria->id}/desactivar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_desactivada');

    expect($categoria->fresh()->status)->toBe('N');
});

test('registrar un precio de combustible cierra el anterior', function () {
    $this->actingAs(usuarioConSubdepartamento('factCombustible', 'Facturacion'));

    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.50])->assertCreated();
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 23.00])->assertCreated();

    $this->getJson('/api/facturacion/precios-combustible/vigente')
        ->assertOk()
        ->assertJsonPath('precio.precio_asa', '23.0000');
});

test('el precio Eolo se propone con la formula si no se manda', function () {
    $this->actingAs(usuarioConSubdepartamento('factCombustible', 'Facturacion'));

    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.50])
        ->assertCreated()
        ->assertJsonPath('precio.precio_eolo', '26.4500');
});

test('asignar categoria y motor a una matricula exige su propio subdepartamento', function () {
    $aeronave = App\Models\Aeronave::create(['matricula' => 'XA-ABC']);
    $satelite = App\Models\FactAeronave::create(['aeronave_id' => $aeronave->id]);
    $categoria = FactCategoriaAeronave::create(categoriaValida());

    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['categoria_aeronave_id' => $categoria->id, 'estatus' => 'guarda', 'cobra_derecho_vuelos' => true])
        ->assertForbidden();

    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));
    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['categoria_aeronave_id' => $categoria->id, 'estatus' => 'transito', 'cobra_derecho_vuelos' => false])
        ->assertOk();

    expect($satelite->fresh()->estatus)->toBe('transito')
        ->and($satelite->fresh()->cobra_derecho_vuelos)->toBeFalse();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/EndpointsCatalogosTest.php`
Expected: FAIL con 404 en todas las rutas

- [ ] **Step 4: Write the controllers and Form Requests**

Cada controlador sigue el patrón de `RelacionPlantaController`: métodos `index`, `store`, `update`, `desactivar`; Form Request por escritura con `authorize(): true` (el acceso lo resuelve el middleware) y mensajes en español; bitácora en cada escritura. `desactivar` es atómico:

```php
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactCategoriaAeronave::query()
            ->where('id', $id)
            ->where('status', FactCategoriaAeronave::STATUS_ACTIVO)
            ->update(['status' => FactCategoriaAeronave::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCategoriaAeronave::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta categoría ya estaba dada de baja.',
                'codigo' => 'ya_desactivada',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja la categoría de aeronave {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Categoría dada de baja.']);
    }
```

- [ ] **Step 5: Register the routes**

En `routes/api.php`, al final:

```php
/*
|--------------------------------------------------------------------------
| Facturación — catálogos de matrícula (bloque 1a)
|--------------------------------------------------------------------------
| Consultar es abierto a cualquier usuario autenticado. Escribir exige el
| subdepartamento de esa pantalla (admin siempre pasa).
*/
Route::middleware(['api', 'auth:sanctum'])->prefix('facturacion')->group(function () {
    Route::get('/categorias-aeronave', [CategoriaAeronaveController::class, 'index']);
    Route::get('/tipos-motor', [TipoMotorController::class, 'index']);
    Route::get('/precios-combustible', [PrecioCombustibleController::class, 'index']);
    Route::get('/precios-combustible/vigente', [PrecioCombustibleController::class, 'vigente']);
    Route::get('/aeronaves', [AeronaveFacturacionController::class, 'index']);

    Route::middleware('subdep:factCategoriasAeronave')->group(function () {
        Route::post('/categorias-aeronave', [CategoriaAeronaveController::class, 'store']);
        Route::put('/categorias-aeronave/{id}', [CategoriaAeronaveController::class, 'update'])->whereNumber('id');
        Route::patch('/categorias-aeronave/{id}/desactivar', [CategoriaAeronaveController::class, 'desactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factTiposMotor')->group(function () {
        Route::post('/tipos-motor', [TipoMotorController::class, 'store']);
        Route::put('/tipos-motor/{id}', [TipoMotorController::class, 'update'])->whereNumber('id');
        Route::patch('/tipos-motor/{id}/desactivar', [TipoMotorController::class, 'desactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factCombustible')->group(function () {
        Route::post('/precios-combustible', [PrecioCombustibleController::class, 'store']);
    });

    Route::middleware('subdep:factAeronaves')->group(function () {
        Route::put('/aeronaves/{id}', [AeronaveFacturacionController::class, 'update'])->whereNumber('id');
    });
});
```

En `routes/web.php`, dentro del grupo autenticado, las cuatro páginas:

```php
    Route::get('facturacion/aeronaves', fn () => Inertia::render('Facturacion/AeronavesFacturacion'))->name('facturacionAeronaves');
    Route::get('facturacion/categorias-aeronave', fn () => Inertia::render('Facturacion/CategoriasAeronave'))->name('facturacionCategoriasAeronave');
    Route::get('facturacion/tipos-motor', fn () => Inertia::render('Facturacion/TiposMotor'))->name('facturacionTiposMotor');
    Route::get('facturacion/combustible', fn () => Inertia::render('Facturacion/Combustible'))->name('facturacionCombustible');
```

- [ ] **Step 6: Write the seeder**

```php
<?php
// database/seeders/FacturacionSubdepartamentosSeeder.php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Departamento Facturación y los subdepartamentos del bloque 1a.
 *
 * Cada pantalla lleva el suyo porque el menú se arma a partir de los
 * subdepartamentos del usuario: `HandleInertiaRequests` publica
 * `slug(departamento).slug(subdepartamento)` y `navigation.ts` lo resuelve
 * contra ROUTE_CONFIG. Un solo subdepartamento daría una sola entrada.
 */
class FacturacionSubdepartamentosSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Facturacion']);

        foreach (['factAeronaves', 'factCategoriasAeronave', 'factTiposMotor', 'factCombustible'] as $nombre) {
            SubDepartamento::firstOrCreate(
                ['departamento_id' => $departamento->id, 'nombre' => $nombre],
                ['status' => 'A'],
            );
        }
    }
}
```

- [ ] **Step 7: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/EndpointsCatalogosTest.php`
Expected: PASS, 9 pruebas

- [ ] **Step 8: Run the full suite**

Run: `php artisan test`
Expected: PASS, 283 pruebas

- [ ] **Step 9: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion/ app/Http/Requests/Facturacion/ database/seeders/FacturacionSubdepartamentosSeeder.php app/Models/Bitacora.php routes/api.php routes/web.php tests/Feature/Facturacion/EndpointsCatalogosTest.php
git commit -m "Endpoints, permisos y bitacora de los catalogos de matricula"
```

---

### Task 10: Store de API y las cuatro pantallas

**Files:**
- Create: `resources/js/stores/apiFacturacionCatalogos.ts`
- Create: `resources/js/pages/Facturacion/CategoriasAeronave.tsx`
- Create: `resources/js/pages/Facturacion/TiposMotor.tsx`
- Create: `resources/js/pages/Facturacion/Combustible.tsx`
- Create: `resources/js/pages/Facturacion/AeronavesFacturacion.tsx`
- Create: `resources/js/pages/Facturacion/components/` (modales y tablas)

**Interfaces:**
- Consumes: los endpoints de la Task 9
- Produces: tipos `CategoriaAeronave`, `TipoMotor`, `PrecioCombustible`, `AeronaveFacturable` y sus funciones de acceso

- [ ] **Step 1: Write the API store**

Seguir el patrón de `resources/js/stores/apiPrestamoChalecos.ts`: tipos exportados, `handleResponse` que lanza con el `message` del servidor, y `getXsrfToken()` para las escrituras.

- [ ] **Step 2: Build the three catalog screens**

Las tres comparten estructura: `AppLayout` con breadcrumbs, tabla con estado de carga y vacío, botón de alta que abre un modal, acciones de editar y dar de baja con confirmación de SweetAlert2 (`confirmButtonColor: '#dc2626'`, `reverseButtons: true`). Botón primario índigo, como Préstamo de chalecos.

Combustible además muestra el precio Eolo propuesto en vivo al teclear el precio ASA, con la fórmula que devuelve el endpoint, y permite sobrescribirlo.

- [ ] **Step 3: Build the aircraft screen**

`AeronavesFacturacion.tsx`: tabla paginada con buscador de matrícula, columnas matrícula, tipo, categoría, motor, estatus y derecho de vuelos. Un filtro **Sin clasificar** que lista las que tienen `categoria_aeronave_id` nulo, que son las que no se pueden facturar. Edición en modal.

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: solo el error preexistente en `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`

Run: `npx eslint resources/js/pages/Facturacion resources/js/stores/apiFacturacionCatalogos.ts`
Expected: sin errores ni advertencias

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `built in …` sin errores

- [ ] **Step 6: Commit**

```bash
git add resources/js/stores/apiFacturacionCatalogos.ts resources/js/pages/Facturacion/
git commit -m "Pantallas de catalogos de matricula para Facturacion"
```

---

### Task 11: Menú, índice único y documentación de despliegue

Cierra el bloque. El índice único va al final, cuando ya se importó y depuró.

**Files:**
- Modify: `resources/js/components/navigation.ts` (ROUTE_CONFIG y agrupación)
- Create: `database/migrations/2026_09_28_099000_add_unique_matricula_to_aeronaves.php`
- Modify: `docs/superpowers/specs/2026-09-28-facturacion-1a-matriculas-design.md` (marcar como implementado)
- Test: `tests/Feature/Facturacion/MatriculaUnicaTest.php`

**Interfaces:**
- Consumes: todo lo anterior
- Produces: nada

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/MatriculaUnicaTest.php

use App\Models\Aeronave;

test('la matricula no se puede repetir en el catalogo', function () {
    Aeronave::create(['matricula' => 'XA-UNICA']);

    expect(fn () => Aeronave::create(['matricula' => 'XA-UNICA']))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/MatriculaUnicaTest.php`
Expected: FAIL — hoy se puede repetir, así que no se lanza la excepción

- [ ] **Step 3: Write the migration**

```php
<?php
// database/migrations/2026_09_28_099000_add_unique_matricula_to_aeronaves.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índice único en la matrícula, que cierra el bloque.
 *
 * Va al final a propósito: en un servidor con matrículas repetidas esta
 * migración falla, y depurarlas requiere antes el reporte del importador.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->unique('matricula');
        });
    }

    public function down(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->dropUnique(['matricula']);
        });
    }
};
```

- [ ] **Step 4: Register the screens in the menu**

En `resources/js/components/navigation.ts`, importar las cuatro rutas de `@/routes` y agregarlas a `ROUTE_CONFIG` con la llave en minúsculas y sin separadores, que es lo que produce `Str::slug` del nombre del subdepartamento:

```ts
    factaeronaves: {
        href: facturacionAeronaves,
        title: 'Aeronaves facturables',
    },
    factcategoriasaeronave: {
        href: facturacionCategoriasAeronave,
        title: 'Categorías de aeronave',
    },
    facttiposmotor: {
        href: facturacionTiposMotor,
        title: 'Tipos de motor',
    },
    factcombustible: {
        href: facturacionCombustible,
        title: 'Combustible',
    },
```

Y agrupar las tres de catálogo puro bajo un nodo, junto al bloque que ya hace lo mismo con Combustible de Rampa:

```ts
            const catalogosFacturacionRoutes = ['factcategoriasaeronave', 'facttiposmotor', 'factcombustible'];
```

siguiendo exactamente la forma del `combustibleChildren` que ya existe: acumular en un arreglo aparte dentro del `forEach`, y al final empujar el nodo padre con `title: 'Catálogos'` si tiene hijos.

En la rama de administrador de `getNavModules`, agregar el módulo `Facturacion` con las mismas cuatro entradas.

- [ ] **Step 5: Run the tests**

Run: `php artisan test`
Expected: PASS, 284 pruebas

- [ ] **Step 6: Verify the frontend**

Run: `npx tsc --noEmit && npx eslint resources/js/components/navigation.ts && npm run build`
Expected: sin errores nuevos

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_28_099000_add_unique_matricula_to_aeronaves.php resources/js/components/navigation.ts tests/Feature/Facturacion/MatriculaUnicaTest.php docs/superpowers/specs/2026-09-28-facturacion-1a-matriculas-design.md
git commit -m "Indice unico en matricula y entradas de menu de Facturacion"
```

---

## Orden de despliegue en el servidor

El índice único de la Task 11 **falla si hay matrículas repetidas**. Por eso el despliegue va en dos pasos de migración:

```bash
git pull
composer install --no-dev --optimize-autoloader

# 1. Todo menos el indice unico
php artisan migrate --step

# 2. Simulacion: revisar el reporte antes de aplicar
php artisan facturacion:importar-matriculas

# 3. Depurar los duplicados que reporte, si los hay

# 4. Aplicar
php artisan facturacion:importar-matriculas --aplicar

# 5. Ahora si, el indice unico
php artisan migrate

# 6. Permisos
php artisan db:seed --class=FacturacionSubdepartamentosSeeder

php artisan optimize:clear
npm ci && npm run build
```

Después, asignar los cuatro subdepartamentos de Facturación al personal desde Gestión de usuarios, con la función de agrupar por departamento.

**El sistema viejo de Prefacturas sigue encendido** durante todo este bloque: si algo sale mal, se revierte el despliegue y la operación continúa ahí.
