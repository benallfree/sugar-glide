# Baby Squirrel Precise Formation System

## Data Structures

### Parent/Player State
```typescript
interface PlayerState {
  nextPreciseId: number;  // Incrementing counter for unique formation IDs
  preciseGroups: {
    [id: number]: PreciseGroup;
  };
  position: THREE.Vector3;
  rotation: number;
}

interface PreciseGroup {
  lastBabyMoveTime: number;  // For spacing control
  activeBabies: number;      // For cleanup
  isTree: boolean;          // Visual state only
}
```

### Baby State
```typescript
interface BabySquirrel {
  mesh: THREE.Group;         // The 3D model
  positionQueue: QueueItem[];
  lastMoveTime: number;
}

interface QueueItem {
  position: THREE.Vector3;
  preciseId: number | null;  // null = flock mode
  speed: number;            // Parent's speed when recorded
  timestamp: number;       // When position was recorded
}
```

## Core Behaviors

### Movement Modes
1. **Ground (Flocking)**
   - `preciseId: null`
   - Natural flocking behavior
   - Separation from siblings
   - Frame-rate independent movement

2. **Precise Formation (Tree/Flying)**
   - `preciseId: number`
   - Exact position following
   - Timed spacing between babies
   - Match parent's exact speed
   - Maintain formation when parent stops

### State Transitions
- Ground -> Precise: Parent enters tree or takes flight
- Precise continues: Through tree climbing and flight
- Precise -> Ground: When reaching ground position
- Formation cleanup: When all babies complete movement

## Implementation Functions

### Parent Position Updates
```typescript
function updateParentPosition(position: THREE.Vector3, nearTree: boolean, delta: number) {
    const now = performance.now();
    const distance = position.distanceTo(lastPosition);
    
    if (distance > MIN_DISTANCE) {
        const speed = distance / delta;
        
        // Start new precise group when entering tree/flight
        if ((nearTree || position.y > groundHeight) && !currentPreciseId) {
            currentPreciseId = nextPreciseId++;
            preciseGroups[currentPreciseId] = {
                lastBabyMoveTime: now,
                activeBabies: totalBabies,
                isTree: nearTree
            };
        }

        // Queue position update for all babies
        const update: QueueItem = {
            position: position.clone(),
            preciseId: currentPreciseId,  // null if on ground
            speed: speed,
            timestamp: now
        };
        queuePositionForBabies(update);
        
        lastPosition.copy(position);
    }
}
```

### Baby Movement Updates
```typescript
function updateBaby(baby: BabySquirrel, delta: number) {
    const currentTarget = baby.positionQueue[0];
    if (!currentTarget) return;

    if (currentTarget.preciseId !== null) {
        const group = preciseGroups[currentTarget.preciseId];
        
        // Check formation timing
        if (now - group.lastBabyMoveTime >= BABY_SPACING_DELAY) {
            // Move at parent's recorded speed
            const reachedTarget = updateBabyPrecise(baby, currentTarget, delta);
            
            if (reachedTarget) {
                const nextTarget = baby.positionQueue[1];
                
                // Check if leaving this precise group
                if (!nextTarget?.preciseId || 
                    nextTarget.preciseId !== currentTarget.preciseId) {
                    group.activeBabies--;
                    if (group.activeBabies === 0) {
                        delete preciseGroups[currentTarget.preciseId];
                    }
                }
                
                baby.positionQueue.shift();
                group.lastBabyMoveTime = now;
            }
        }
    } else {
        // Normal flocking behavior
        updateBabyFlocking(baby, currentTarget, delta);
        baby.positionQueue.shift();
    }
}
```

### Precise Movement
```typescript
function updateBabyPrecise(baby: BabySquirrel, target: QueueItem, delta: number): boolean {
    const direction = new THREE.Vector3()
        .subVectors(target.position, baby.mesh.position);
    
    // Move at exactly parent's recorded speed
    const distance = target.speed * delta;
    
    if (direction.length() > distance) {
        // Move toward target at parent's speed
        direction.normalize().multiplyScalar(distance);
        baby.mesh.position.add(direction);
        
        // Update rotation
        if (direction.length() > 0.001) {
            const targetAngle = Math.atan2(direction.x, direction.z);
            baby.mesh.rotation.y = targetAngle;
        }
        return false;
    } else {
        // Snap to position if we'd overshoot
        baby.mesh.position.copy(target.position);
        return true;
    }
}
```

### Flocking Movement
```typescript
function updateBabyFlocking(baby: BabySquirrel, target: QueueItem, delta: number) {
    // Standard flocking behavior with separation from siblings
    const direction = new THREE.Vector3()
        .subVectors(target.position, baby.mesh.position)
        .normalize()
        .multiplyScalar(FLOCK_SPEED * delta);
    
    // Add separation from other babies
    const separation = calculateSeparation(baby);
    direction.add(separation);
    
    baby.mesh.position.add(direction);
    
    // Update rotation to face movement direction
    if (direction.length() > 0.001) {
        baby.mesh.rotation.y = Math.atan2(direction.x, direction.z);
    }
}
```

## Key Features

1. **Position Queue**
   - Each position update includes movement mode
   - Records parent's speed for exact matching
   - Natural cleanup through queue processing

2. **Formation Control**
   - Time-based spacing between babies
   - Maintain formation when parent stops
   - Automatic cleanup when formation ends

3. **Movement Characteristics**
   - Frame-rate independent using delta time
   - Exact speed matching in precise mode
   - Natural flocking behavior on ground
   - Smooth transitions between modes

4. **State Management**
   - Simple incrementing IDs for formations
   - Automatic group cleanup
   - Clear mode transitions
   - Position-driven behavior
