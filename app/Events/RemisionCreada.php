<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RemisionCreada implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public int $id)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('remisiones');
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->id,
        ];
    }
}
