<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sumas_autotanque', function (Blueprint $table) {
            $table->decimal('toma_fisica_cm', 6, 2)
                ->nullable()
                ->after('folio');

            $table->decimal('toma_fisica_litros', 10, 2)
                ->nullable()
                ->after('toma_fisica_cm');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sumas_autotanque', function (Blueprint $table) {
            $table->dropColumn([
                'toma_fisica_cm',
                'toma_fisica_litros',
            ]);
        });
    }
};
