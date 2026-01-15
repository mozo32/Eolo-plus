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
        Schema::create('firmas', function (Blueprint $table) {
            $table->id();

            $table->string('disk')->default('public');
            $table->string('path');                 // ej: firmas/walkaround/abc123.png
            $table->string('original_name')->nullable();
            $table->string('mime')->nullable();     // image/png
            $table->unsignedInteger('size')->nullable();

            // opcional: hash para evitar duplicados
            $table->string('sha1', 40)->nullable()->index();
            $table->char('status', 1)->default('A');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('firmas');
    }
};
