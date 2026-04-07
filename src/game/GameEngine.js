import { InputManager } from './InputManager.js';
import { EntityManager } from './EntityManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { Renderer } from './Renderer.js';
import { ClusterSpawner } from './systems/ClusterSpawner.js';
import { ExperienceSystem } from './systems/ExperienceSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { AudioManager } from './AudioManager.js';
import { ActiveSkillSystem } from './ActiveSkillSystem.js';
import { Player } from './entities/Player.js';
import { BossEnemy } from './entities/BossEnemy.js';
import { PortalEntity } from './entities/PortalEntity.js';
import { ChaosShardGem } from './entities/ChaosShardGem.js';
import { GoldGem } from './entities/GoldGem.js';
import { ItemDrop } from './entities/ItemDrop.js';
import { PassiveItem } from './PassiveItem.js';
import { UNIQUE_ITEM_DEFS, GENERIC_ITEM_DEFS } from './data/items.js';
import { rollRarity, generateItem } from './data/itemGenerator.js';
import { applyStats, TREE_NODE_MAP } from './data/passiveTree.js';
import { CHARACTER_MAP } from './data/characters.js';
import { AchievementSystem } from './systems/AchievementSystem.js';
import { MetaProgression } from './MetaProgression.js';
import { MAP_THEMES, BOSS_DEFS, BOSS_SCHEDULE, SPAWN_RADIUS, LEVEL_XP_TABLE, ENEMY_AI } from './config.js';
import { makeSupportInstance } from './data/supports.js';
import { SUPPORT_POOL, createSupportGemItem } from './data/supports.js';
import { createSkillGemItem, getAvailableSkillOffers, getSkillOfferById } from './data/skills.js';
import { SKILL_OFFER_POOL } from './data/skills.js';
import { createMapItemDrop, isMapItem, mapItemToMapDef } from './data/mapItems.js';
import { CharacterSave } from './CharacterSave.js';
import { MapInstance } from './MapInstance.js';
import { HubWorld } from './HubWorld.js';
import { MapGenerator } from './MapGenerator.js';
import { Navigation } from './Navigation.js';

/** World-space radius within which hovering the mouse highlights an ItemDrop. */
const HOVER_RADIUS = 70;

/**
 * GameEngine
 * Owns the requestAnimationFrame loop and orchestrates all game systems.
 *
 * React communicates with the engine via:
 *   - Callback props passed to the constructor (onHudUpdate, onLevelUp, onGameOver)
 *   - Direct method calls via engineRef (applyUpgrade, pause, resume, destroy)
 */
export class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(data: object) => void} onHudUpdate  - called ~20fps with HUD stats
   * @param {(choices: object[]) => void} onLevelUp - called when player levels up
   * @param {(stats: object) => void} onGameOver  - called when all portals are spent
   * @param {(itemData: object|null) => void} [onHoveredItemChange] - called when hovered world item changes
   * @param {(characterId: string) => void} [onAchievementUnlock] - called when a character is unlocked
   * @param {(bossName: string) => void} [onBossAnnounce] - called when a boss spawns
   * @param {() => void} [onEnterHub] - called when the engine transitions to HUB state
  * @param {(portalsLeft: number, stats: object) => void} [onPlayerDied] - called on death while portals remain
  * @param {(interactable: object|null) => void} [onHubInteractableChange] - called when nearest hub interactable changes
  * @param {(stats: object) => void} [onMapComplete] - called when map boss is killed
   */
  constructor(canvas, onHudUpdate, onLevelUp, onGameOver, onHoveredItemChange, onAchievementUnlock, onBossAnnounce, onEnterHub, onPlayerDied, onHubInteractableChange, onMapComplete) {
    this.canvas = canvas;
    this.onHudUpdate = onHudUpdate;
    this.onLevelUp = onLevelUp;
    this.onGameOver = onGameOver;
    this.onHoveredItemChange = onHoveredItemChange ?? null;
    this.onBossAnnounce = onBossAnnounce ?? null;
    this.onEnterHub = onEnterHub ?? null;
    this.onPlayerDied = onPlayerDied ?? null;
    this.onHubInteractableChange = onHubInteractableChange ?? null;
    this.onMapComplete = onMapComplete ?? null;

    // --- Phase 8 state (reset in start()) ---
    this.mapTheme        = MAP_THEMES[0];
    this._mapThemeIdx    = 0;
    this._themeChanged   = false;
    this._bossIndex      = 0;
    this.bossesDefeated  = [];
    this.runEventLog     = [];
    // --- Phase 9 state (reset in start()) ---
    this.shardsThisRun   = 0;
    this._shardGainMult  = 1;

    // Mouse tracking (screen coords updated by React; world coords derived each frame)
    this._mouseScreenX = 0;
    this._mouseScreenY = 0;
    this._hoveredDrop   = null; // nearest ItemDrop within HOVER_RADIUS
    this._lockedTarget  = null;

    // ── C2 state fields ──────────────────────────────────────────────────────
    /** The characterId (CharacterSave key) of the currently active character. */
    this.currentCharId = null;
    /** Active map instance — null when in hub or between maps. */
    this.mapInstance   = null;
    /** Hub-only world simulation container (null when inside a map). */
    this.hubWorld      = null;
    /** Generated map layout data for C4 wall rendering and collision. */
    this.mapLayout     = null;
    /** Cached walkability data used by enemy A* navigation. */
    this._navCache     = null;
    /** Portals remaining in the current map run. Reset to 3 on enterHub. */
    this.portalsRemaining = 3;
    /** Last interactable reported to React while in HUB. */
    this._nearbyHubInteractable = null;
    /** Primed device portal map definition created from a consumed map item. */
    this.pendingMapPortalDef = null;
    this._mapModSnapshot = null;
    /** Cached rolled equipment/map vendor stock — null forces regen on next getVendorStock(). */
    this._vendorEquipStock = null;
    /** Optional mobile-only quality-of-life assists. */
    this.mobileAssist = { autoPickup: false };
    /** Runtime performance profile, tuned from the mobile options panel. */
    this.performanceProfile = {
      preset: 'quality',
      targetFps: 60,
      particleMultiplier: 1,
      maxParticles: 220,
      maxFloatTexts: 24,
      drawBackgroundGrid: true,
      backgroundGridStep: 1,
      drawWallDetails: true,
      hudInterval: 0.05,
      reduceUiEffects: false,
    };

    this.state = 'MENU';
    this.elapsed = 0;
    this.kills = 0;
    this.debugMode = false;

    // --- Delta-time smoothing (rolling average of last 5 raw frame times) ---
    // Pre-fill with 60fps so the first frames don't average against zeros.
    this._dtBuffer = [1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60];
    this._dtIndex = 0;
    this._smoothDt = 1 / 60;
    this._fps = 60;
    this._lastFrameAt = 0;

    this.input = new InputManager();
    this.entities = new EntityManager();
    this.collision = new CollisionSystem();
    this.renderer = new Renderer(canvas.getContext('2d'));
    this.spawner = new ClusterSpawner(this.entities);
    this.xpSystem = new ExperienceSystem(this, onLevelUp);
    this.particles = new ParticleSystem();
    this.renderer.setPerformanceOptions?.(this.performanceProfile);
    this.particles.setQuality?.(this.performanceProfile);
    this.audio = new AudioManager();
    this.achievements = new AchievementSystem(this, onAchievementUnlock ?? (() => {}));
    this.activeSkillSystem = new ActiveSkillSystem();

    this.player = null;
    this._raf = null;
    this._lastTime = 0;
    this._hudThrottle = 0;
    this._pausedFrom = null;

    // --- Screen shake state ---
    this._shakeTimer = 0;
    this._shakeIntensity = 0;

    // F3 toggles the debug overlay — suppress default browser find-bar shortcut
    // Z (when debug is open) triggers an instant level-up for testing
    this._onDebugKey = (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugMode = !this.debugMode;
      }
      if (e.code === 'KeyZ' && this.debugMode && (this.state === 'RUNNING' || this.state === 'HUB') && this.player) {
        // Grant enough XP to trigger the next level-up immediately
        const needed = this.player.xpToNext - this.player.xp;
        this.xpSystem.collect(needed > 0 ? needed : 1);
      }
    };
    window.addEventListener('keydown', this._onDebugKey);
  }

  /** Start (or restart) a new game run.
   * @param {string} [characterId] — id from characters.js; defaults to 'sage'
   */
  start(characterId = 'sage') {
    this.state = 'RUNNING';
    this.hubWorld = null;
    this.mapLayout = null;
    this._navCache = null;
    this._nearbyHubInteractable = null;
    if (this.onHubInteractableChange) this.onHubInteractableChange(null);
    this.elapsed = 0;
    this.kills = 0;

    // Phase 8 state reset
    this._mapThemeIdx  = Math.floor(Math.random() * MAP_THEMES.length);
    this.mapTheme      = MAP_THEMES[this._mapThemeIdx];
    this._themeChanged = false;
    this._bossIndex    = 0;
    this.bossesDefeated = [];
    this.runEventLog   = [];
    // Phase 9 state reset
    this.shardsThisRun  = 0;
    this._lockedTarget  = null;

    this.entities.clear();
    this.spawner.reset();

    const charDef = CHARACTER_MAP[characterId] ?? CHARACTER_MAP['sage'];
    this.player = new Player(0, 0, charDef);

    // Apply permanent meta-tree bonuses to the player.
    const metaNodes  = MetaProgression.loadMetaNodes();
    const metaBonus  = MetaProgression.getRunBonuses(metaNodes);
    this._shardGainMult = metaBonus.shardGainMult ?? 1;
    if (metaBonus.maxHealthFlat > 0) {
      this.player.maxHealth += metaBonus.maxHealthFlat;
      this.player.health    += metaBonus.maxHealthFlat;
    }
    if (metaBonus.healthRegenPerS > 0)  this.player.healthRegenPerS  += metaBonus.healthRegenPerS;
    if (metaBonus.xpMultiplier > 1)     this.player.xpMultiplier     *= metaBonus.xpMultiplier;
    if (metaBonus.speedFlat > 0)        this.player.speed            += metaBonus.speedFlat;
    if (metaBonus.pickupRadiusFlat > 0) this.player.pickupRadiusBonus += metaBonus.pickupRadiusFlat;
    if (metaBonus.damageMult > 1) {
      for (const w of this.player.autoSkills) w.damage = Math.round(w.damage * metaBonus.damageMult);
    }
    if (metaBonus.extraSkillPoints > 0) this.player.skillPoints += metaBonus.extraSkillPoints;
    if (metaBonus.startingRelic) this._grantStartingRelic();

    this.entities.add(this.player);
    this._hoveredDrop = null;

    // Reset active skill system for the new run.
    this.activeSkillSystem = new ActiveSkillSystem();

    this._lastTime = performance.now();
    this._lastFrameAt = this._lastTime;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame((t) => this._loop(t));
    // Flush so React receives the correct allocatedNodes/skillPoints immediately.
    this._flushHudUpdate();
  }

  // ── C2: Hub state ─────────────────────────────────────────────────────────

  /**
   * Load a saved character and enter the Hub world.
   * This is the primary entry point for all character-based play.
   * In C3, this will initialise HubWorld; in C4+, HubWorld has a map device.
   * @param {string} characterId — id from CharacterSave
   */
  enterHub(characterId, opts = {}) {
    const preserveMapState = !!opts.preserveMapState;
    // Stop any running RAF loop.
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    this.currentCharId = characterId;
    if (!preserveMapState) {
      this.portalsRemaining = 3;
      this.mapInstance = null;
      this.mapLayout = null;
    } else if (this.mapInstance) {
      this.portalsRemaining = this.mapInstance.portalsRemaining;
    }
    this.hubWorld = null;
    this.elapsed          = 0;
    this.kills            = 0;
    this._bossIndex       = 0;
    this.bossesDefeated   = [];
    this.runEventLog      = [];
    this.shardsThisRun    = 0;
    this._mapThemeIdx     = 0;
    this.mapTheme         = MAP_THEMES[0];
    this._themeChanged    = false;
    this._hoveredDrop     = null;

    this.entities.clear();
    this.spawner.reset();
    this.particles = new ParticleSystem();

    // Load character save.
    const saveData = CharacterSave.load(characterId);
    const classId  = saveData?.class ?? 'sage';
    const charDef  = CHARACTER_MAP[classId] ?? CHARACTER_MAP['sage'];

    this.player = new Player(0, 0, charDef);

    if (saveData) {
      // ── Restore base combat stats ───────────────────────────────────────
      this.player.level        = saveData.level    ?? 1;
      this.player.xp           = saveData.xp       ?? 0;
      this.player.xpToNext     = LEVEL_XP_TABLE[this.player.level] ?? this.player.xpToNext;
      this.player.maxHealth    = saveData.maxHealth ?? this.player.maxHealth;
      this.player.health       = Math.min(saveData.health ?? this.player.maxHealth, this.player.maxHealth);
      this.player.maxEnergyShield = saveData.maxEnergyShield ?? 0;
      this.player.energyShield    = saveData.energyShield    ?? 0;
      this.player.skillPoints  = saveData.skillPoints ?? Math.max(0, this.player.level - 1);
      this.player.gold         = saveData.gold ?? 0;

      // ── Restore passive tree (nodes beyond the constructor-applied start set) ──
      const savedNodes = new Set(saveData.passiveTree?.allocated ?? ['start']);
      for (const nodeId of savedNodes) {
        if (!this.player.allocatedNodes.has(nodeId)) {
          const node = TREE_NODE_MAP[nodeId];
          if (node) {
            this.player.allocatedNodes.add(nodeId);
            const snapshot = applyStats(this.player, node.stats);
            this.player.nodeSnapshots.set(nodeId, snapshot);
          }
        }
      }

      // ── Restore equipment ─────────────────────────────────────────────────
      const eq = saveData.equipment ?? {};
      for (const [slot, itemDef] of Object.entries(eq)) {
        if (itemDef) {
          // Ensure `stats` field is present (saved as full itemDef by checkpoint()).
          // Pre-C2 saves may only have `baseStats`; fall back gracefully.
          if (!itemDef.stats && itemDef.baseStats) {
            itemDef.stats = itemDef.baseStats;
          }
          this.player.equip(itemDef, slot);
        }
      }

      // ── Restore inventory ─────────────────────────────────────────────────
      const invItems = saveData.inventory?.items ?? [];
      for (const item of invItems) {
        this.player.inventory.place(item, item.gridX, item.gridY);
      }

      // Restore primary skill support sockets (default attack links).
      const savedPrimary = saveData.primarySkill;
      if (savedPrimary?.id === this.player.primarySkill?.id && Array.isArray(savedPrimary.supportSlots)) {
        const slots = this.player.primarySkill.supportSlots ?? [];
        for (let i = 0; i < slots.length; i++) {
          const supDef = savedPrimary.supportSlots[i];
          slots[i] = supDef ? makeSupportInstance(supDef) : null;
        }
      }
    }

    // Apply permanent meta-tree bonuses (shard gain mult, etc.).
    const metaNodes = MetaProgression.loadMetaNodes();
    const metaBonus = MetaProgression.getRunBonuses(metaNodes);
    this._shardGainMult = metaBonus.shardGainMult ?? 1;

    // Reset active skill system.
    this.activeSkillSystem = new ActiveSkillSystem();

    this.entities.add(this.player);
    this._clearMapPlayerModEffects();
    this.hubWorld = new HubWorld();
    if (this.pendingMapPortalDef) {
      this.hubWorld.setMapPortal(this.pendingMapPortalDef);
    }
    this._nearbyHubInteractable = this.hubWorld.getNearbyInteractable(this.player);
    if (this.onHubInteractableChange) this.onHubInteractableChange(this._nearbyHubInteractable);
    this.state = 'HUB';

    this._lastTime = performance.now();
    this._lastFrameAt = this._lastTime;
    this._raf = requestAnimationFrame((t) => this._loop(t));
    this._flushHudUpdate();

    // Tell React to show the hub screen.
    if (this.onEnterHub) this.onEnterHub();
  }

  /**
   * Enter a map instance from hub.
   * C2 uses the existing RUNNING simulation as the map gameplay state.
   * C4 will replace theme-only map setup with generated layouts and walls.
   * @param {object} mapDef
   * @param {number} [seed]
   */
  enterMap(mapDef = { id: 'act1', name: 'Unknown Map', tier: 1 }, seed, existingInstance = null) {
    if (!this.player) return;

    this.state = 'MAP_LOADING';
    this.pendingMapPortalDef = null;
    this.hubWorld?.clearMapPortal();
    this.mapInstance = existingInstance ?? new MapInstance(mapDef, seed);
    this.mapInstance.applyMods(this.mapInstance.mapDef?.mods ?? []);
    this.hubWorld = null;
    this.mapLayout = MapGenerator.generate(this.mapInstance.mapDef ?? mapDef, this.mapInstance.seed);
    this._navCache = Navigation.buildCache(this.mapLayout);
    this._nearbyHubInteractable = null;
    if (this.onHubInteractableChange) this.onHubInteractableChange(null);
    this.portalsRemaining = this.mapInstance.portalsRemaining;

    // Fresh per-map combat counters.
    this.elapsed = 0;
    this.kills = 0;
    this._bossIndex = 0;
    this.bossesDefeated = [];
    this.runEventLog = [];
    this.shardsThisRun = 0;

    this._mapThemeIdx = Math.floor(Math.random() * MAP_THEMES.length);
    this.mapTheme = MAP_THEMES[this._mapThemeIdx];
    this._themeChanged = false;

    // Reset world entities but keep the same persistent player object.
    this.entities.clear();
    this.spawner.reset();
    this._hoveredDrop = null;

    this.player.x = this.mapLayout?.startWorld?.x ?? 0;
    this.player.y = this.mapLayout?.startWorld?.y ?? 0;
    this.player.health = Math.max(this.player.health, 1);
    this._applyMapPlayerModEffects();
    this.entities.add(this.player);

    // C5: all non-scripted enemies are placed on map load.
    const liveMapDef = this.mapInstance.mapDef ?? mapDef;
    const difficulty = Math.max(1, liveMapDef?.tier ?? 1);
    const seeded = this.spawner.populateMap(this.mapLayout, liveMapDef, this.entities, difficulty, this.mapInstance);
    if (seeded?.bossName && this.onBossAnnounce) this.onBossAnnounce(seeded.bossName);
    if (this.mapInstance) {
      this.mapInstance.enemiesTotal = seeded?.enemiesTotal ?? 0;
      this.mapInstance.enemiesKilled = 0;
    }

    this._initMapPortals();

    this.state = 'RUNNING';
    this._lastTime = performance.now();
    this._flushHudUpdate();
  }

  /** @private Spawn three portal entities around the map start room and sync active/used state. */
  _initMapPortals() {
    if (!this.mapInstance) return;
    const center = this.mapLayout?.startWorld ?? { x: this.player?.x ?? 0, y: this.player?.y ?? 0 };
    const dist = 72;
    this.mapInstance.portalsInWorld = Array.from({ length: 3 }, (_, i) => {
      const angle = -Math.PI / 2 + (i - 1) * 0.65;
      return new PortalEntity(
        center.x + Math.cos(angle) * dist,
        center.y + Math.sin(angle) * dist,
        i < this.mapInstance.portalsRemaining ? 'entry' : 'used',
      );
    });
  }

  /** @private Refresh active/used portal visuals after portal consumption. */
  _syncMapPortals() {
    if (!this.mapInstance?.portalsInWorld?.length) return;
    this.mapInstance.portalsInWorld.forEach((p, i) => {
      p.setType(i < this.mapInstance.portalsRemaining ? 'entry' : 'used');
    });
  }

  /** Re-enter the currently active map instance from hub (if valid). */
  reenterMapInstance() {
    if (!this.hasReenterableMap()) return;
    this.enterMap(this.mapInstance.mapDef, this.mapInstance.seed, this.mapInstance);
  }

  /** True when there is an uncleared map instance with portals remaining. */
  hasReenterableMap() {
    return !!(this.mapInstance && !this.mapInstance.isCleared && this.mapInstance.portalsRemaining > 0);
  }

  /** Returns lightweight map info for hub/map-device UI. */
  getReenterableMapInfo() {
    if (!this.hasReenterableMap()) return null;
    return {
      id: this.mapInstance.mapDef?.id ?? 'unknown',
      name: this.mapInstance.mapDef?.name ?? 'Unknown Map',
      tier: this.mapInstance.mapDef?.tier ?? 1,
      portalsRemaining: this.mapInstance.portalsRemaining,
    };
  }

  /** Return all map items currently in the player's inventory. */
  getInventoryMapItems() {
    if (!this.player?.inventory?._items) return [];
    return Array.from(this.player.inventory._items.values())
      .map((entry) => entry.itemDef)
      .filter((itemDef) => isMapItem(itemDef));
  }

  /** Returns lightweight info for the currently primed map-device portal. */
  getPrimedMapPortalInfo() {
    if (!this.pendingMapPortalDef) return null;
    return {
      id: this.pendingMapPortalDef.id,
      name: this.pendingMapPortalDef.name,
      tier: this.pendingMapPortalDef.tier,
      mods: this.pendingMapPortalDef.mods ?? [],
    };
  }

  /** Consume a map item from inventory and arm the hub map portal. */
  openMapDevicePortal(itemUid) {
    if (!this.player?.inventory || this.state !== 'PAUSED') return false;

    const itemDef = this.player.inventory.remove(itemUid);
    if (!itemDef) return false;
    if (!isMapItem(itemDef)) {
      this.player.inventory.autoPlace(itemDef);
      return false;
    }

    const mapDef = mapItemToMapDef(itemDef);
    if (!mapDef) {
      this.player.inventory.autoPlace(itemDef);
      return false;
    }

    this.pendingMapPortalDef = mapDef;
    this.hubWorld?.setMapPortal(mapDef);
    this.checkpoint();
    this._flushHudUpdate();
    return true;
  }

  /** Enter the currently primed map-device portal from the hub. */
  enterPrimedMapPortal() {
    if (!this.pendingMapPortalDef) return false;
    const def = this.pendingMapPortalDef;
    this.pendingMapPortalDef = null;
    this.hubWorld?.clearMapPortal();
    this.enterMap(def);
    return true;
  }

  /**
   * Hub-state update tick.
   * Player can move freely; no enemies, no spawner, no wave logic.
   * C3 will call hubWorld.update() here once HubWorld exists.
   */
  updateHub(dt) {
    if (!this.player) return;
    this._validateLockedTarget();

    // Player movement.
    this.player.update(dt, this.input);
    const nearby = this.hubWorld?.update(dt, this.player) ?? null;

    // Health regen in hub (always full regen rate).
    if (this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(
        this.player.health + Math.max(this.player.healthRegenPerS, 2) * dt,
        this.player.maxHealth,
      );
    }
    // Energy shield recharge.
    if (this.player.energyShield < this.player.maxEnergyShield) {
      this.player.energyShield = Math.min(
        this.player.energyShield + this.player.maxEnergyShield * 0.1 * dt,
        this.player.maxEnergyShield,
      );
    }

    this.particles.update(dt);

    if (this.mapInstance?.portalsInWorld?.length) {
      for (const portal of this.mapInstance.portalsInWorld) {
        portal.update(dt);
      }
    }

    if (nearby !== this._nearbyHubInteractable) {
      this._nearbyHubInteractable = nearby;
      if (this.onHubInteractableChange) this.onHubInteractableChange(nearby);
    }

    this.input.clearJustPressed();

    // Throttle HUD updates.
    this._hudThrottle += dt;
    if (this._hudThrottle >= 0.05) {
      this._hudThrottle = 0;
      this._flushHudUpdate();
    }
  }

  /** @private Apply map-instance player penalties (regen/damage taken) for C9 modifiers. */
  _applyMapPlayerModEffects() {
    if (!this.player || !this.mapInstance) return;
    this._clearMapPlayerModEffects();

    const effects = this.mapInstance.modEffects ?? null;
    if (!effects) return;

    this._mapModSnapshot = {
      healthRegenPerS: this.player.healthRegenPerS,
      incomingDamageMult: this.player.incomingDamageMult,
    };

    if (effects.playerNoRegen) {
      this.player.healthRegenPerS = 0;
    }
    if ((effects.playerDamageTakenMult ?? 1) !== 1) {
      this.player.incomingDamageMult *= effects.playerDamageTakenMult;
    }
  }

  /** @private Restore player stats overridden by map modifiers. */
  _clearMapPlayerModEffects() {
    if (!this.player || !this._mapModSnapshot) return;
    this.player.healthRegenPerS = this._mapModSnapshot.healthRegenPerS;
    this.player.incomingDamageMult = this._mapModSnapshot.incomingDamageMult;
    this._mapModSnapshot = null;
  }

  /**
   * Save the player's current state back to their CharacterSave.
   * Called after a map clear and when returning to hub after death.
   */
  checkpoint() {
    if (!this.currentCharId) return;
    const data = this._buildSaveData();
    if (data) CharacterSave.save(this.currentCharId, data);
  }

  /**
   * Exit the current map run.
   * Saves progress and returns the player to the hub.
   * @param {boolean} [cleared=false] — true = boss was killed
   */
  exitMap(cleared = false) {
    if (cleared && this.mapInstance) {
      this.mapInstance.isCleared = true;
      this._recordMapClearProgress();
    }
    this.checkpoint();

    const preserve = !!(
      this.mapInstance &&
      !this.mapInstance.isCleared &&
      this.mapInstance.portalsRemaining > 0
    );
    this.enterHub(this.currentCharId, { preserveMapState: preserve });
  }

  /** True if the player can consume a portal to return to hub from an active map. */
  canSpendPortalToHub() {
    return !!(
      this.currentCharId &&
      this.mapInstance &&
      !this.mapInstance.isCleared &&
      this.mapInstance.portalsRemaining > 0
    );
  }

  /** Consume one portal and return to hub while preserving the map instance if possible. */
  spendPortalToHub() {
    if (!this.canSpendPortalToHub()) return false;

    this.mapInstance.portalsRemaining = Math.max(0, this.mapInstance.portalsRemaining - 1);
    this.portalsRemaining = this.mapInstance.portalsRemaining;
    this._syncMapPortals();
    this.checkpoint();

    const preserve = !!(
      this.mapInstance &&
      !this.mapInstance.isCleared &&
      this.mapInstance.portalsRemaining > 0
    );
    this.enterHub(this.currentCharId, { preserveMapState: preserve });
    return true;
  }

  /** @private Persist C7 act/map clear progress on the active character save. */
  _recordMapClearProgress() {
    if (!this.currentCharId || !this.mapInstance?.mapDef?.id) return;

    const existing = CharacterSave.load(this.currentCharId) ?? {};
    const now = new Date().toISOString();
    const mapId = this.mapInstance.mapDef.id;
    const acts = new Set(existing.actsCleared ?? []);
    acts.add(mapId);
    const actsClearedAt = { ...(existing.actsClearedAt ?? {}) };
    if (!actsClearedAt[mapId]) actsClearedAt[mapId] = now;

    const bosses = new Set(existing.bossesKilled ?? []);
    for (const name of this.bossesDefeated ?? []) bosses.add(name);

    CharacterSave.save(this.currentCharId, {
      ...existing,
      actsCleared: [...acts],
      actsClearedAt,
      mapsCleared: (existing.mapsCleared ?? 0) + 1,
      bossesKilled: [...bosses],
    });
  }

  /**
   * Build a full character save data blob from the current player state.
   * Preserves the `stats` field on items so equipment effects survive reload.
   * @private
   * @returns {object|null}
   */
  _buildSaveData() {
    const { player } = this;
    if (!player) return null;

    // Serialize equipment — use raw itemDef (includes `stats`) not HUD-safe form.
    const equipment = {};
    for (const [slot, entry] of Object.entries(player.equipment)) {
      equipment[slot] = entry?.def ?? null;
    }

    // Serialize inventory — walk internal _items map to preserve `stats`.
    const invItems = [];
    for (const [, { itemDef, gridX, gridY }] of player.inventory._items) {
      invItems.push({ ...itemDef, gridX, gridY });
    }

    // Merge over the existing save so we don't lose fields added in later phases.
    const existing = CharacterSave.load(this.currentCharId) ?? {};

    return {
      ...existing,
      level:           player.level,
      xp:              player.xp,
      health:          player.health,
      maxHealth:       player.maxHealth,
      energyShield:    player.energyShield,
      maxEnergyShield: player.maxEnergyShield,
      skillPoints:     player.skillPoints,
      passiveTree:     { allocated: [...player.allocatedNodes] },
      equipment,
      inventory: {
        cols:  player.inventory.cols,
        rows:  player.inventory.rows,
        items: invItems,
      },
      primarySkill: {
        id: player.primarySkill?.id ?? null,
        supportSlots: (player.primarySkill?.supportSlots ?? []).map((sup) => {
          if (!sup) return null;
          return {
            id: sup.id,
            name: sup.name,
            icon: sup.icon ?? '◆',
          };
        }),
      },
      activeSkills: this.activeSkillSystem.serializeFull(),
      autoSkills:   player.autoSkills.map((w) => w.id),
      gold:         player.gold ?? 0,
    };
  }

  _loop(now) {
    const targetFps = Math.max(15, this.performanceProfile?.targetFps ?? 60);
    const minFrameMs = 1000 / targetFps;
    if (this._lastFrameAt && now - this._lastFrameAt < minFrameMs - 0.5) {
      this._raf = requestAnimationFrame((t) => this._loop(t));
      return;
    }
    this._lastFrameAt = now;

    // Raw dt capped at 50ms to prevent physics tunneling after tab blur.
    const rawDt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;

    // Rolling 5-frame average smooths out occasional spikes.
    this._dtBuffer[this._dtIndex % 5] = rawDt;
    this._dtIndex++;
    const count = Math.min(this._dtIndex, 5);
    let sum = 0;
    for (let i = 0; i < count; i++) sum += this._dtBuffer[i];
    this._smoothDt = sum / count;
    this._fps = Math.round(1 / Math.max(this._smoothDt, 0.0001));

    if (this.state === 'RUNNING') {
      this.update(this._smoothDt);
    } else if (this.state === 'HUB') {
      this.updateHub(this._smoothDt);
    }
    this.render();

    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  update(dt) {
    this.elapsed += dt;
    this._validateLockedTarget();

    // Player
    this.player.update(dt, this.input);
    this._updateCursorAim();
    this.collision.resolveEntityVsWalls(this.player, this.mapLayout);

    // Void Pact / negative-regen game-over check (health hits 0 outside combat)
    if (this.player.health <= 0) {
      this.gameOver();
      return;
    }

    // Auto-fire skills (each skill has its own cooldown timer)
    for (const weapon of this.player.autoSkills) {
      weapon.update(dt, this.player, this.entities, this);
    }

    // Active skill system: tick pure-skill timers and handle hotbar key presses.
    this.activeSkillSystem.update(dt, this.player, this.entities, this);
    const skillKeys = this.input.getSkillActivations();
    if (skillKeys.space) this._activatePrimarySkill();
    if (skillKeys.q) this.activeSkillSystem.activate(0, this.player, this.entities, this);
    if (skillKeys.e) this.activeSkillSystem.activate(1, this.player, this.entities, this);
    if (skillKeys.r) this.activeSkillSystem.activate(2, this.player, this.entities, this);
    this.input.clearJustPressed();

    // Enemies
    for (const enemy of this.entities.enemies) {
      enemy.update(dt, this.player, this);
      this.collision.resolveEntityVsWalls(enemy, this.mapLayout);
    }
    this._propagateEnemyAggro();

    // Bosses (separate loop; engine reference required for attack spawning)
    for (const boss of this.entities.bosses) {
      if (boss.active) {
        boss.update(dt, this.player, this);
        this.collision.resolveEntityVsWalls(boss, this.mapLayout);
      }
    }

    // AoE zones
    for (const zone of this.entities.aoeZones) {
      zone.update(dt);
    }

    // Projectiles
    for (const proj of this.entities.projectiles) {
      proj.update(dt);
    }

    // XP gems
    for (const gem of this.entities.gems) {
      gem.update(dt, this.player);
    }

    // Chaos Shard gems
    for (const shard of this.entities.shardGems) {
      shard.update(dt, this.player);
    }

    // Gold gems
    for (const gold of this.entities.goldGems) {
      gold.update(dt, this.player);
    }

    // Item drops (just animation + hover detection)
    for (const drop of this.entities.itemDrops) {
      drop.update(dt);
    }
    this._updateHoveredDrop();
    this._autoPickupNearbyDrops();

    // Collision
    this.collision.buildGrids(this.entities);
    this.collision.checkProjectilesVsEnemies(this.entities, this);
    this.collision.checkPlayerVsEnemies(this.player, this.entities, this);
    this.collision.checkPlayerVsGems(this.player, this.entities, this.xpSystem);
    this.collision.checkPlayerVsShardGems(this.player, this.entities, this);
    this.collision.checkPlayerVsGoldGems(this.player, this.entities, this);
    this.collision.checkPlayerVsAoeZones(this.player, this.entities, this);
    // Large gear remains click-based; optional mobile assist can auto-loot nearby small drops.

    // Boss spawning
    if (!this.mapLayout) {
      while (
        this._bossIndex < BOSS_SCHEDULE.length &&
        this.elapsed >= BOSS_SCHEDULE[this._bossIndex].time
      ) {
        this._spawnBoss(BOSS_SCHEDULE[this._bossIndex].id);
        this._bossIndex++;
      }
    }

    // Map theme switch at 5 minutes
    if (!this._themeChanged && this.elapsed >= 300) {
      this._themeChanged = true;
      this._mapThemeIdx  = (this._mapThemeIdx + 1) % MAP_THEMES.length;
      this.mapTheme      = MAP_THEMES[this._mapThemeIdx];
    }

    // Spawning
    this.spawner.update(dt, this.elapsed, this.player, this.mapLayout);

    // Achievement unlocks
    this.achievements.update();

    // Remove dead/expired entities
    this.entities.cleanup();

    // Particles
    this.particles.update(dt);

    // Screen shake decay
    if (this._shakeTimer > 0) this._shakeTimer -= dt;
    if (this._shakeTimer < 0) this._shakeTimer = 0;

    // Throttle HUD updates to ~20 fps to avoid excessive React renders
    this._hudThrottle += dt;
    if (this._hudThrottle >= 0.05) {
      this._hudThrottle = 0;
      this.onHudUpdate({
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        xp: this.player.xp,
        xpToNext: this.player.xpToNext,
        level: this.player.level,
        elapsed: this.elapsed,
        kills: this.kills,
        skillPoints:    this.player.skillPoints,
        allocatedNodes: [...this.player.allocatedNodes],
        shardsThisRun:  this.shardsThisRun,
        gold: this.player.gold ?? 0,
        energyShield:    this.player.energyShield,
        maxEnergyShield: this.player.maxEnergyShield,
        portalsRemaining: this.mapInstance?.portalsRemaining ?? 0,
        mapEnemiesKilled: this.mapInstance?.enemiesKilled ?? 0,
        mapEnemiesTotal:  this.mapInstance?.enemiesTotal ?? 0,
        hasActiveMap: this.hasReenterableMap(),
        mapContext: this.state === 'RUNNING' || this.state === 'DIED' || this.state === 'MAP_COMPLETE' || (this.state === 'PAUSED' && this._pausedFrom === 'RUNNING'),
        mapName: this.mapInstance?.mapDef?.name ?? '',
        mapTier: this.mapInstance?.mapDef?.tier ?? 0,
        mapMods: this.mapInstance?.mods ?? [],
        primarySkill:    this._serializePrimarySkill(),
        activeSkills:    this.activeSkillSystem.serialize(),
        equipment: this._serializeEquipment(),
        inventory: this.player.inventory.serialize(),
      });
    }
  }

  /** Update player facing to point from player toward the cursor world position. */
  _updateCursorAim() {
    if (!this.player || !this.renderer) return;
    if (this._isLockTargetValid(this._lockedTarget)) {
      const dx = this._lockedTarget.x - this.player.x;
      const dy = this._lockedTarget.y - this.player.y;
      const len = Math.hypot(dx, dy);
      if (len >= 0.0001) {
        this.player.facingX = dx / len;
        this.player.facingY = dy / len;
        return;
      }
    }
    const virtualAim = this.input?.getAimOverride?.();
    if (virtualAim) {
      this.player.facingX = virtualAim.dx;
      this.player.facingY = virtualAim.dy;
      return;
    }
    const mouseWorldX = this._mouseScreenX + this.renderer.camX;
    const mouseWorldY = this._mouseScreenY + this.renderer.camY;
    const dx = mouseWorldX - this.player.x;
    const dy = mouseWorldY - this.player.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return;
    this.player.facingX = dx / len;
    this.player.facingY = dy / len;
  }

  /** Attempt to cast the player's default Space-bound primary skill. */
  _activatePrimarySkill() {
    const skill = this.player?.primarySkill;
    if (!skill?.isActive) return false;
    if (skill._timer < skill.cooldown) return false;
    skill.fire(this.player, this.entities, this);
    skill._timer = 0;
    return true;
  }

  /** @private Serialize the Space-bound primary skill for HUD rendering. */
  _serializePrimarySkill() {
    const s = this.player?.primarySkill;
    if (!s) return null;
    const remaining = Math.max(0, s.cooldown - s._timer);
    return {
      id: s.id,
      name: s.name,
      icon: s.icon ?? '␣',
      cooldown: s.cooldown,
      remaining: parseFloat(remaining.toFixed(1)),
      ready: remaining <= 0,
      casting: 0,
      isPrimary: true,
    };
  }

  /**
   * C11.2 local aggro propagation.
   * Enemies that newly aggro this frame can alert nearby idle enemies.
   */
  _propagateEnemyAggro() {
    const enemies = this.entities.enemies;
    if (!enemies.length) return;

    const sources = [];
    for (const enemy of enemies) {
      if (!enemy.active || enemy.isBoss) continue;
      if (!enemy.consumeAggroEvent?.()) continue;
      // Prevent infinite chain-aggro in one frame; ally alerts only do one hop.
      if (enemy.aggroSource === 'ally_alert') continue;
      sources.push(enemy);
    }
    if (!sources.length) return;

    for (const source of sources) {
      const radius = source.propagationRadius ?? ENEMY_AI.propagationRadius;
      const radiusSq = radius * radius;

      for (const candidate of enemies) {
        if (!candidate.active || candidate.isBoss) continue;
        if (candidate.aiState === 'aggro') continue;
        if (candidate === source) continue;

        const dx = candidate.x - source.x;
        const dy = candidate.y - source.y;
        if (dx * dx + dy * dy > radiusSq) continue;

        // Prefer alerting same-pack enemies; fall back to nearby local packs.
        if (source.packId && candidate.packId && source.packId !== candidate.packId) {
          const tightRadiusSq = (radius * 0.65) * (radius * 0.65);
          if (dx * dx + dy * dy > tightRadiusSq) continue;
        }

        candidate.setAggro('ally_alert');
      }
    }
  }

  /**
   * C11.3 path query helper used by Enemy AI.
   * Returns world-space waypoints or null when no valid route is found.
   */
  getPathForEnemy(enemy, targetX, targetY) {
    if (!enemy || !this.mapLayout) return null;
    return Navigation.findPath(
      enemy.x,
      enemy.y,
      targetX,
      targetY,
      this.mapLayout,
      this._navCache,
    );
  }

  /**
   * Returns true when a direct segment between two world points does not cross wall tiles.
   */
  hasLineOfSight(fromX, fromY, toX, toY) {
    if (!this.mapLayout) return true;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;

    const step = Math.max(12, this.mapLayout.tileSize * 0.35);
    const steps = Math.max(1, Math.ceil(dist / step));

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = fromX + dx * t;
      const sy = fromY + dy * t;
      const { tx, ty } = this.mapLayout.worldToTile(sx, sy);
      if (this.mapLayout.isWall(tx, ty)) return false;
    }

    return true;
  }

  render() {
    const { width, height } = this.canvas;

    // Apply screen shake by nudging the camera target while shake is active.
    let camX = this.player?.x ?? 0;
    let camY = this.player?.y ?? 0;
    if (this._shakeTimer > 0) {
      const mag = this._shakeIntensity * (this._shakeTimer / 0.25);
      camX += (Math.random() - 0.5) * 2 * mag;
      camY += (Math.random() - 0.5) * 2 * mag;
    }

    this.renderer.setCamera(camX, camY, width, height);
    this.renderer.clear(width, height);
    const shouldDrawHub = this.hubWorld && (this.state === 'HUB' || (this.state === 'PAUSED' && !this.mapInstance));
    if (shouldDrawHub) {
      this.hubWorld.draw(this.renderer);
    } else if (this.mapLayout) {
      this.renderer.drawGeneratedMap(this.mapLayout, this.mapTheme);
    } else {
      this.renderer.drawBackground(this.mapTheme);
    }

    // Draw order: gems → item drops → AoE zones → projectiles → enemies → bosses → player
    for (const gem    of this.entities.gems)        gem.draw(this.renderer);
    for (const shard  of this.entities.shardGems)   shard.draw(this.renderer);
    for (const gold   of this.entities.goldGems)    gold.draw(this.renderer);
    for (const drop   of this.entities.itemDrops)   drop.draw(this.renderer);
    for (const zone   of this.entities.aoeZones)    zone.draw(this.renderer);
    for (const proj   of this.entities.projectiles) proj.draw(this.renderer);
    for (const enemy  of this.entities.enemies)     enemy.draw(this.renderer);
    for (const boss   of this.entities.bosses)      boss.draw(this.renderer);
    if (this._isLockTargetValid(this._lockedTarget)) {
      this.renderer.drawTargetLock(
        this._lockedTarget.x,
        this._lockedTarget.y,
        (this._lockedTarget.radius ?? 14) + 10,
        !!this._lockedTarget.isBoss,
      );
    }
    if (this.player) this.player.draw(this.renderer);

    if (this.mapInstance?.portalsInWorld?.length) {
      for (const portal of this.mapInstance.portalsInWorld) {
        portal.draw(this.renderer);
      }
    }

    // Draw auto-fire skill visual FX on top of everything (auras, rings, zones).
    if (this.player) {
      for (const weapon of this.player.autoSkills) {
        weapon.draw(this.renderer, this.player);
      }
    }

    // Particles draw above all game entities.
    this.particles.draw(this.renderer);

    // Boss health bar — screen-space overlay drawn after all world entities.
    const activeBoss = this.entities.bosses.find((b) => b.active && !b.isWarning);
    if (activeBoss) this.renderer.drawBossHealthBar(activeBoss);

    if (this.debugMode) {
      const counts = this.entities.counts;
      this.renderer.drawDebugOverlay({
        fps: this._fps,
        enemies: counts.enemies,
        projectiles: counts.projectiles,
        gems: counts.gems,
        itemDrops: counts.itemDrops,
        particles: this.particles.count,
        gridCellCount: this.collision.enemyGridCellCount,
        cellSize: 128,
      });
    }
  }

  /** Called by CollisionSystem when a Chaos Shard gem is collected. */
  onShardCollected(value) {
    this.shardsThisRun += value;
    this.particles.emit('xp', this.player.x, this.player.y);
  }

  /** Called by CollisionSystem when a Gold gem is collected. */
  onGoldCollected(value) {
    this.player.gold = (this.player.gold ?? 0) + value;
    this.particles.emit('xp', this.player.x, this.player.y, { color: '#ffd166' });
    this.audio.play('xp_collect');
  }

  /** Called by CollisionSystem when an enemy is killed. Drops XP gem + effects. */
  onEnemyKilled(enemy) {
    this.kills++;
    if (this.mapInstance) {
      this.mapInstance.enemiesKilled = (this.mapInstance.enemiesKilled ?? 0) + 1;
    }

    if (enemy.isBoss) {
      this.bossesDefeated.push(enemy.bossName);
      this.runEventLog.push({ type: 'boss', time: this.elapsed, name: enemy.bossName });
      if (this.mapInstance) this.mapInstance.isCleared = true;
      this._shakeTimer     = 0.8;
      this._shakeIntensity = 20;
      this.particles.emit('death', enemy.x, enemy.y, { color: enemy.color });
      this.entities.acquireGem(enemy.x, enemy.y, enemy.xpValue);
      // Bosses always drop a Unique item.
      const bossPool = UNIQUE_ITEM_DEFS.length ? UNIQUE_ITEM_DEFS : GENERIC_ITEM_DEFS;
      const baseDef = bossPool[Math.floor(Math.random() * bossPool.length)];
      const itemDef = generateItem(baseDef, 'unique');
      this.entities.itemDrops.push(new ItemDrop(enemy.x, enemy.y, itemDef));
      const bossShards = Math.round(5 * this._shardGainMult);
      for (let i = 0; i < bossShards; i++) {
        const angle = (i / bossShards) * Math.PI * 2;
        this.entities.addShardGem(new ChaosShardGem(
          enemy.x + Math.cos(angle) * 30,
          enemy.y + Math.sin(angle) * 30,
          1,
        ));
      }
      const mapTier = Math.max(1, this.mapInstance?.mapDef?.tier ?? 1);
      const mapId = this.mapInstance?.mapDef?.id ?? '';
      const isActOneMap = mapTier === 1 || mapId.startsWith('act1_');
      const bossGoldPiles = 10 + Math.floor(mapTier * 1.5) + (isActOneMap ? 3 : 0);
      const baseBossGold = 4 + Math.floor(mapTier * 0.6) + (isActOneMap ? 1 : 0);
      for (let i = 0; i < bossGoldPiles; i++) {
        const angle = (i / bossGoldPiles) * Math.PI * 2;
        const radius = 34 + (i % 3) * 10;
        this.entities.addGoldGem(new GoldGem(
          enemy.x + Math.cos(angle) * radius,
          enemy.y + Math.sin(angle) * radius,
          baseBossGold + Math.floor(Math.random() * 3),
        ));
      }
      this.state = 'MAP_COMPLETE';
      if (this.onMapComplete) {
        this.onMapComplete({
          mapId: this.mapInstance?.mapDef?.id ?? 'unknown',
          mapName: this.mapInstance?.mapDef?.name ?? 'Unknown Map',
          tier: this.mapInstance?.mapDef?.tier ?? 1,
          bossName: enemy.bossName ?? 'Unknown',
          elapsed: this.elapsed,
          kills: this.kills,
          level: this.player?.level ?? 1,
          portalsLeft: this.mapInstance?.portalsRemaining ?? this.portalsRemaining,
          enemiesKilled: this.mapInstance?.enemiesKilled ?? 0,
          enemiesTotal: this.mapInstance?.enemiesTotal ?? 0,
        });
      }
      return;
    }

    this.entities.acquireGem(enemy.x, enemy.y, enemy.xpValue);
    this.particles.emit('death', enemy.x, enemy.y, { color: enemy.color });
    this.audio.play('enemy_death');

    // Chaos Shard drops — 12% for champions, 4% for normal enemies
    const shardChance = enemy.isChampion ? 0.12 : 0.04;
    if (Math.random() < shardChance) {
      this.entities.addShardGem(new ChaosShardGem(enemy.x, enemy.y, 1));
    }

    // Gold drops are intentionally common and scale by map tier.
    const mapTier = Math.max(1, this.mapInstance?.mapDef?.tier ?? 1);
    const mapId = this.mapInstance?.mapDef?.id ?? '';
    const isActOneMap = mapTier === 1 || mapId.startsWith('act1_');
    const goldChance = enemy.isChampion
      ? 1.0
      : Math.min(0.96, 0.72 + (mapTier - 1) * 0.02 + (isActOneMap ? 0.14 : 0));
    if (Math.random() < goldChance) {
      const tierBonus = Math.floor((mapTier - 1) / 2);
      const baseValue = enemy.isChampion
        ? (3 + tierBonus * 2) + Math.floor(Math.random() * (4 + Math.floor(mapTier / 3)))
        : (1 + tierBonus) + (Math.random() < (0.25 + Math.min(0.25, mapTier * 0.03)) ? 1 : 0);
      const value = baseValue + (isActOneMap ? (enemy.isChampion ? 2 : 1) : 0);
      this.entities.addGoldGem(new GoldGem(enemy.x, enemy.y, value));
    }

    // Item drop chance: 20% for champions, 6% for normal enemies
    const dropChance = enemy.isChampion ? 0.20 : 0.06;
    if (Math.random() < dropChance) {
      // Champions: 30% chance for a Unique; otherwise generic procedural base
      const useUnique = enemy.isChampion && Math.random() < 0.30 && UNIQUE_ITEM_DEFS.length;
      const pool      = useUnique ? UNIQUE_ITEM_DEFS : GENERIC_ITEM_DEFS;
      const baseDef   = pool[Math.floor(Math.random() * pool.length)];
      const difficulty = Math.min(1 + this.elapsed / 120, 5);
      const rarity    = rollRarity(difficulty, enemy.isChampion);
      const itemDef   = generateItem(baseDef, rarity);
      const drop = new ItemDrop(enemy.x, enemy.y, itemDef);
      this.entities.itemDrops.push(drop);
    }

    // C8 map-item drops in act maps only.
    const inActMap = !!(this.mapInstance?.mapDef?.id && String(this.mapInstance.mapDef.id).startsWith('act'));
    if (inActMap) {
      const mapDropChance = enemy.isChampion ? 0.07 : 0.025;
      if (Math.random() < mapDropChance) {
        const sourceTier = this.mapInstance?.mapDef?.tier ?? 1;
        const mapItem = createMapItemDrop(sourceTier, this.player?.level ?? 1, !!enemy.isChampion);
        this.entities.itemDrops.push(new ItemDrop(enemy.x, enemy.y, mapItem));
      }
    }

    // Skill gem drops replace level milestone skill assignment.
    const skillGemChance = enemy.isChampion ? 0.15 : 0.05;
    if (Math.random() < skillGemChance) {
      const offers = getAvailableSkillOffers(this.player, this);
      if (offers.length > 0) {
        const offer = offers[Math.floor(Math.random() * offers.length)];
        this.entities.itemDrops.push(new ItemDrop(enemy.x, enemy.y, createSkillGemItem(offer)));
      }
    }

    // Grant skill XP: champions worth 5, normals worth 1
    const xpValue = enemy.isChampion ? 5 : (enemy.xpValue ?? 1);
    this.activeSkillSystem?.grantSkillXP(xpValue);
  }

  /** Grant a starting Chaos Relic item to the player's inventory (League Stash node). */
  _grantStartingRelic() {
    const pool = GENERIC_ITEM_DEFS.length ? GENERIC_ITEM_DEFS : UNIQUE_ITEM_DEFS;
    const baseDef = pool[Math.floor(Math.random() * pool.length)];
    const itemDef = generateItem(baseDef, 'magic');
    itemDef.name  = `Chaos Relic: ${itemDef.name}`;
    this.player.inventory.add(itemDef);
  }

  /** Spawn a boss at a random edge position around the player. */
  _spawnBoss(defId) {
    const def   = BOSS_DEFS[defId];
    if (!def) return;
    const angle = Math.random() * Math.PI * 2;
    const boss  = new BossEnemy(
      this.player.x + Math.cos(angle) * SPAWN_RADIUS * 0.7,
      this.player.y + Math.sin(angle) * SPAWN_RADIUS * 0.7,
      def,
    );
    this.entities.add(boss);
    if (this.onBossAnnounce) this.onBossAnnounce(def.name);
  }

  /** Called by CollisionSystem when a projectile hits an enemy (before kill check). */
  onEnemyHit(enemy, damage = 0) {
    this.particles.emit('hit', enemy.x, enemy.y);
    this.particles.emit('tuning_pop', enemy.x, enemy.y, {
      color: enemy.isBoss ? '#ffe39a' : (enemy.isChampion ? '#ffd166' : '#fff2bf'),
      count: enemy.isBoss ? 16 : (enemy.isChampion ? 13 : 10),
    });
    if (damage > 0) {
      this.particles.emit('damage_number', enemy.x, enemy.y - enemy.radius - 4, {
        value: damage,
        color: enemy.isBoss ? '#ffd166' : '#f5f0d6',
        size: enemy.isBoss ? 19 : (enemy.isChampion ? 17 : 14),
        lifetime: enemy.isBoss ? 0.82 : 0.64,
      });
    }
    this.audio.play('hit');
  }

  /** Called by a skill when it fires (triggers audio). */
  onSkillFire() {
    this.audio.play('fire');
  }

  /** Called by CollisionSystem when the player is hit by an enemy. */
  onPlayerHit(damage = 0) {
    this._shakeTimer = 0.25;
    this._shakeIntensity = 8;
    this.particles.emit('hit', this.player.x, this.player.y, { color: '#ff6b6b' });
    this.particles.emit('tuning_pop', this.player.x, this.player.y, {
      color: '#ff7f7f',
      count: 12,
    });
    if (damage > 0) {
      this.particles.emit('damage_number', this.player.x, this.player.y - this.player.radius - 10, {
        value: `-${Math.round(damage)}`,
        color: '#ff9b9b',
        size: 16,
        lifetime: 0.72,
      });
    }
    this.audio.play('player_hurt');
  }

  /** Called by ExperienceSystem when an XP gem is collected. */
  onGemCollected(gem) {
    this.particles.emit('xp', gem.x, gem.y);
    this.audio.play('xp_collect');
  }

  /** Update optional engine performance profile from React. */
  setPerformanceProfile(profile = {}) {
    this.performanceProfile = { ...this.performanceProfile, ...profile };
    this.renderer.setPerformanceOptions?.(this.performanceProfile);
    this.particles.setQuality?.(this.performanceProfile);
  }

  /** Update optional mobile assist settings from React. */
  setMobileAssistOptions(options = {}) {
    this.mobileAssist = { ...this.mobileAssist, ...options };
  }

  /**
   * Called by React on every canvas mousemove.
   * Converts screen coords to world coords and updates the hovered item drop.
   * @param {number} screenX
   * @param {number} screenY
   */
  updateMousePosition(screenX, screenY) {
    this._mouseScreenX = screenX;
    this._mouseScreenY = screenY;
    // Only update world-space hover when renderer camera is established
    this._updateHoveredDrop();
  }

  /** @private Recompute which ItemDrop the mouse is closest to within HOVER_RADIUS. */
  _updateHoveredDrop() {
    const mouseWorldX = this._mouseScreenX + this.renderer.camX;
    const mouseWorldY = this._mouseScreenY + this.renderer.camY;
    const hoverSq = HOVER_RADIUS * HOVER_RADIUS;
    let nearest = null;
    let nearestSq = hoverSq;
    for (const drop of this.entities.itemDrops) {
      if (!drop.active) continue;
      const dx = drop.x - mouseWorldX;
      const dy = drop.y - mouseWorldY;
      const dSq = dx * dx + dy * dy;
      if (dSq <= nearestSq) { nearestSq = dSq; nearest = drop; }
    }
    if (nearest !== this._hoveredDrop) {
      this._hoveredDrop = nearest;
      if (this.onHoveredItemChange) {
        this.onHoveredItemChange(nearest ? this._serializeHoveredDrop(nearest) : null);
      }
    }
  }

  /** @private */
  _serializeHoveredDrop(drop) {
    const d = drop.itemDef;
    return {
      uid:         d.uid,
      name:        d.name,
      rarity:      d.rarity  ?? 'normal',
      color:       d.color,
      slot:        d.slot,
      description: d.description,
      affixes:     d.affixes ?? [],
      gridW:       d.gridW,
      gridH:       d.gridH,
      isUnique:    d.isUnique ?? false,
      flavorText:  d.flavorText ?? null,
      baseStats:   d.baseStats ?? d.stats ?? {},
      defenseType: d.defenseType ?? null,
      type: d.type,
      mapTier: d.mapTier,
      mapTheme: d.mapTheme,
      mapMods: d.mapMods ?? [],
      mapItemLevel: d.mapItemLevel,
    };
  }

  /** @private Only small items are eligible for mobile auto-loot assist. */
  _shouldAutoPickupDrop(drop) {
    const item = drop?.itemDef;
    if (!item) return false;
    if (item.type === 'skill_gem' || item.type === 'support_gem' || item.type === 'map_item') return true;
    const area = Math.max(1, (item.gridW ?? 99) * (item.gridH ?? 99));
    return area <= 1;
  }

  /** @private Auto-collect nearby small items when the mobile loot assist is enabled. */
  _autoPickupNearbyDrops() {
    if (!this.mobileAssist?.autoPickup || !this.player) return;
    const pickupRadius = Math.max(72, 48 + (this.player.pickupRadiusBonus ?? 0));
    const pickupSq = pickupRadius * pickupRadius;
    let changed = false;

    for (const drop of this.entities.itemDrops) {
      if (!drop.active || !this._shouldAutoPickupDrop(drop)) continue;
      const dx = drop.x - this.player.x;
      const dy = drop.y - this.player.y;
      if (dx * dx + dy * dy > pickupSq) continue;
      const placed = this.player.inventory.autoPlace(drop.itemDef);
      if (!placed) continue;
      drop.active = false;
      changed = true;
      if (drop === this._hoveredDrop) this._hoveredDrop = null;
    }

    if (changed) {
      if (this.onHoveredItemChange) {
        this.onHoveredItemChange(this._hoveredDrop ? this._serializeHoveredDrop(this._hoveredDrop) : null);
      }
      this._flushHudUpdate();
    }
  }

  /**
   * Called by React when the player clicks the canvas and a drop is hovered.
   * Marks the drop inactive and returns its itemDef.
   * React decides whether to auto-place or set as cursor item.
   * @returns {object|null} itemDef or null if nothing hovered
   */
  pickupHoveredItem() {
    if (!this._hoveredDrop) return null;
    const drop = this._hoveredDrop;
    drop.active = false;
    this._hoveredDrop = null;
    if (this.onHoveredItemChange) this.onHoveredItemChange(null);
    return drop.itemDef;
  }

  /**
   * Auto-place an itemDef into the first available inventory slot.
   * @returns {boolean} false = inventory full, item not placed
   */
  addToInventory(itemDef) {
    const placed = this.player.inventory.autoPlace(itemDef);
    if (placed) this._flushHudUpdate();
    return placed;
  }

  /**
   * Place an itemDef at a specific grid cell (used by cursor item placement).
   * @returns {boolean}
   */
  placeInInventory(itemDef, col, row) {
    const placed = this.player.inventory.place(itemDef, col, row);
    if (placed) this._flushHudUpdate();
    return placed;
  }

  /**
   * Remove an inventory item (by uid) and equip it to the player.
   * @param {string} uid
   * @param {string} [preferredSlot] — e.g. 'ring1' or 'ring2' for ring items
   * @returns {object|null} the displaced (previously equipped) itemDef, or null if slot was empty
   */
  equipFromInventory(uid, preferredSlot) {
    const itemDef = this.player.inventory.remove(uid);
    if (!itemDef) return null;
    const displaced = this.player.equip(itemDef, preferredSlot);
    this._flushHudUpdate();
    return displaced; // null = slot was empty; def = slot was occupied, goes to cursor
  }

  /**
   * Unequip the item in `slot`.
   * Tries to auto-place in inventory; returns the itemDef if inventory is full.
   * @param {string} slot
   * @returns {object|null} itemDef if couldn't auto-place (caller puts on cursor), else null
   */
  unequipToInventory(slot) {
    const itemDef = this.player.unequip(slot);
    if (!itemDef) return null;
    const placed = this.player.inventory.autoPlace(itemDef);
    this._flushHudUpdate();
    return placed ? null : itemDef;
  }

  /**
   * Drop an itemDef to the world at a random offset from the player.
   * Used when the inventory is closed with a cursor item, or inventory is full.
   * @param {object} itemDef
   */
  dropItemToWorld(itemDef) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 40;
    const drop = new ItemDrop(
      this.player.x + Math.cos(angle) * dist,
      this.player.y + Math.sin(angle) * dist,
      itemDef,
    );
    this.entities.itemDrops.push(drop);
  }

  /** @private Immediately push a full HUD update to React (used after inventory mutations). */
  _flushHudUpdate() {
    if (!this.player) return;
    this.onHudUpdate({
      health:    this.player.health,
      maxHealth: this.player.maxHealth,
      xp:        this.player.xp,
      xpToNext:  this.player.xpToNext,
      level:     this.player.level,
      elapsed:   this.elapsed,
      kills:     this.kills,
      gold: this.player.gold ?? 0,
      skillPoints:     this.player.skillPoints,
      allocatedNodes:  [...this.player.allocatedNodes],
      energyShield:    this.player.energyShield,
      maxEnergyShield: this.player.maxEnergyShield,
      portalsRemaining: this.mapInstance?.portalsRemaining ?? 0,
      mapEnemiesKilled: this.mapInstance?.enemiesKilled ?? 0,
      mapEnemiesTotal:  this.mapInstance?.enemiesTotal ?? 0,
      hasActiveMap: this.hasReenterableMap(),
      mapContext: this.state === 'RUNNING' || this.state === 'DIED' || this.state === 'MAP_COMPLETE' || (this.state === 'PAUSED' && this._pausedFrom === 'RUNNING'),
      mapName: this.mapInstance?.mapDef?.name ?? '',
      mapTier: this.mapInstance?.mapDef?.tier ?? 0,
      mapMods: this.mapInstance?.mods ?? [],
      equipment: this._serializeEquipment(),
      inventory: this.player.inventory.serialize(),
      primarySkill:    this._serializePrimarySkill(),
      activeSkills:    this.activeSkillSystem.serialize(),
      lockedTarget: this._isLockTargetValid(this._lockedTarget)
        ? {
            name: this._lockedTarget.bossName ?? this._lockedTarget.name ?? 'Target',
            isBoss: !!this._lockedTarget.isBoss,
            healthPct: this._lockedTarget.maxHealth > 0
              ? Math.max(0, this._lockedTarget.health / this._lockedTarget.maxHealth)
              : 0,
          }
        : null,
    });
  }

  _isLockTargetValid(target) {
    return !!(target && target.active && !target.isWarning);
  }

  _validateLockedTarget() {
    if (this._isLockTargetValid(this._lockedTarget)) return;
    this._lockedTarget = null;
  }

  _findBestLockTarget() {
    if (!this.player) return null;
    let best = null;
    let bestScore = Infinity;
    for (const hostile of this.entities.getHostiles()) {
      if (!this._isLockTargetValid(hostile)) continue;
      const dx = hostile.x - this.player.x;
      const dy = hostile.y - this.player.y;
      const distSq = dx * dx + dy * dy;
      const facingDot = (this.player.facingX * dx + this.player.facingY * dy) / (Math.sqrt(distSq) || 1);
      const score = distSq - facingDot * 18000;
      if (score < bestScore) {
        bestScore = score;
        best = hostile;
      }
    }
    return best;
  }

  toggleTargetLock() {
    this._validateLockedTarget();
    if (this._lockedTarget) {
      this._lockedTarget = null;
      this._flushHudUpdate();
      return { ok: true, locked: false };
    }
    this._lockedTarget = this._findBestLockTarget();
    this._flushHudUpdate();
    return { ok: !!this._lockedTarget, locked: !!this._lockedTarget };
  }

  /**
   * Allocate a passive tree node for the player.
   * Deducts one skill point, applies the node's stat effects, and flushes the HUD.
   * @param {string} nodeId
   * @returns {boolean} true if allocation succeeded
   */
  allocateNode(nodeId) {
    const { player } = this;
    if (!player) return false;
    if (player.skillPoints <= 0) return false;
    if (player.allocatedNodes.has(nodeId)) return false;

    const node = TREE_NODE_MAP[nodeId];
    if (!node) return false;

    // Must be adjacent to at least one already-allocated node.
    const adjacent = node.connections.some((id) => player.allocatedNodes.has(id));
    if (!adjacent) return false;

    player.skillPoints--;
    player.allocatedNodes.add(nodeId);
    const snapshot = applyStats(player, node.stats);
    player.nodeSnapshots.set(nodeId, snapshot);

    this.audio.play('level_up');
    this.particles.emit('level_up', player.x, player.y);
    this._flushHudUpdate();
    return true;
  }

  /**
   * Socket a support gem (by inventory uid) into a skill's support slot.
   * The gem item is removed from inventory and a live support instance is placed.
   */
  socketGem(skillId, slotIndex, gemUid) {
    const skill = this.activeSkillSystem.findSkillById(skillId)
      ?? (this.player?.primarySkill?.id === skillId ? this.player.primarySkill : null);
    if (!skill) return;
    const gemItemDef = this.player.inventory.remove(gemUid);
    if (!gemItemDef) return;
    const support = makeSupportInstance(gemItemDef);
    if (!support) { this.player.inventory.autoPlace(gemItemDef); return; }
    // Unsocket existing gem back to inventory first
    const existing = skill.supportSlots[slotIndex];
    if (existing?._itemDef) this.player.inventory.autoPlace(existing._itemDef);
    skill.supportSlots[slotIndex] = support;
    this._flushHudUpdate();
  }

  /**
   * Remove a support gem from a skill socket, returning the gem to inventory.
   */
  unsocketGem(skillId, slotIndex) {
    const skill = this.activeSkillSystem.findSkillById(skillId)
      ?? (this.player?.primarySkill?.id === skillId ? this.player.primarySkill : null);
    if (!skill) return;
    const support = skill.supportSlots[slotIndex];
    if (!support) return;
    if (support._itemDef) {
      const placed = this.player.inventory.autoPlace(support._itemDef);
      if (!placed) this.dropItemToWorld(support._itemDef);
    }
    skill.supportSlots[slotIndex] = null;
    this._flushHudUpdate();
  }

  /** Consume an inventory skill gem and learn/equip its associated skill. */
  consumeSkillGem(gemUid) {
    if (!this.player?.inventory) return false;
    const gemItem = this.player.inventory.remove(gemUid);
    if (!gemItem) return false;

    if (gemItem.type !== 'skill_gem' || !gemItem.skillOfferId) {
      this.player.inventory.autoPlace(gemItem);
      return false;
    }

    const offer = getSkillOfferById(gemItem.skillOfferId);
    if (!offer || !offer.available(this.player, this)) {
      this.player.inventory.autoPlace(gemItem);
      return false;
    }

    this.applySkillOffer(offer, { suppressFlow: true });
    this.checkpoint();
    this._flushHudUpdate();
    return true;
  }

  /** @private Serialise all 10 equipment slots for the HUD payload. */
  _serializeEquipment() {
    const eq = this.player.equipment;
    return {
      mainhand:  this._serializeEquipSlot(eq.mainhand),
      offhand:   this._serializeEquipSlot(eq.offhand),
      bodyarmor: this._serializeEquipSlot(eq.bodyarmor),
      helmet:    this._serializeEquipSlot(eq.helmet),
      boots:     this._serializeEquipSlot(eq.boots),
      belt:      this._serializeEquipSlot(eq.belt),
      ring1:     this._serializeEquipSlot(eq.ring1),
      ring2:     this._serializeEquipSlot(eq.ring2),
      amulet:    this._serializeEquipSlot(eq.amulet),
      gloves:    this._serializeEquipSlot(eq.gloves),
    };
  }

  /** @private Serialise one equipment slot for the HUD payload. */
  _serializeEquipSlot(entry) {
    if (!entry) return null;
    const d = entry.def;
    return {
      name:        d.name,
      color:       d.color,
      description: d.description,
      rarity:      d.rarity ?? 'normal',
      uid:         d.uid,
      slot:        d.slot,
      affixes:     d.affixes ?? [],
      isUnique:    d.isUnique ?? false,
      flavorText:  d.flavorText ?? null,
      baseStats:   d.baseStats ?? d.stats ?? {},
      defenseType: d.defenseType ?? null,
    };
  }

  /**
   * Generate a fresh set of rolled equipment + map listings for vendor stock.
   * Grouped into: weapons, armour, jewelry, maps.
   * @private
   */
  _generateVendorEquipStock() {
    const playerLevel = this.player?.level ?? 1;
    const difficulty  = Math.min(5, Math.max(1, Math.round(playerLevel / 6)));

    // Temporary testing economy so early shopping is easy during balance passes.
    const RARITY_PRICE = { normal: 2, magic: 4, rare: 7, unique: 10 };
    const SLOT_ICON = {
      weapon: '⚔', mainhand: '⚔', offhand: '🗡',
      armor: '🛡', bodyarmor: '🛡', helmet: '⛑',
      boots: '👢', gloves: '🧤', belt: '🎗',
      ring: '💍', ring1: '💍', ring2: '💍', amulet: '📿', jewelry: '💎',
    };

    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

    const rollSlots = (slots, count, tabId) => {
      const pool = GENERIC_ITEM_DEFS.filter((d) => slots.includes(d.slot));
      return shuffle(pool).slice(0, count).map((base) => {
        const rarity = rollRarity(difficulty);
        const def    = generateItem(base, rarity);
        return {
          id:    `equip:${def.uid}`,
          tab:   tabId,
          kind:  'equipment',
          name:  def.name,
          icon:  SLOT_ICON[base.slot] ?? '⚙',
          description: def.description ?? base.description ?? '',
          price: RARITY_PRICE[rarity] ?? 80,
          rarity,
          itemDef: def,
        };
      });
    };

    const weapons = [
      ...rollSlots(['weapon', 'mainhand'], 4, 'weapons'),
      ...rollSlots(['offhand'],            3, 'weapons'),
    ];
    const armour = [
      ...rollSlots(['armor', 'bodyarmor'], 3, 'armour'),
      ...rollSlots(['helmet'],             2, 'armour'),
      ...rollSlots(['boots'],              2, 'armour'),
      ...rollSlots(['gloves'],             2, 'armour'),
      ...rollSlots(['belt'],               1, 'armour'),
    ];
    const jewelry = rollSlots(['jewelry', 'ring', 'amulet'], 5, 'jewelry');

    const mapTier = Math.max(1, Math.round(playerLevel / 8));
    const maps = Array.from({ length: 5 }, () => {
      const mapItem = createMapItemDrop(mapTier, playerLevel);
      return {
        id:    `map:${mapItem.uid}`,
        tab:   'maps',
        kind:  'map_item',
        name:  mapItem.name,
        icon:  '🗺',
        description: `Tier ${mapItem.mapTier} — ${mapItem.description}`,
        price: Math.min(10, Math.max(3, 2 + (mapItem.mapTier ?? 1))),
        rarity: mapItem.rarity,
        itemDef: mapItem,
      };
    });

    return { weapons, armour, jewelry, maps };
  }

  /**
   * Build vendor stock for the current hub session.
   * Gems are infinite-stock; equipment/maps are cached rolls (reset on reroll).
   */
  getVendorStock() {
    const skillRows = SKILL_OFFER_POOL.map((offer) => ({
      id:    `skill:${offer.id}`,
      tab:   'skill',
      kind:  'skill_gem',
      name:  `${offer.name} Gem`,
      icon:  offer.isWeaponSkill ? '✦' : '◇',
      description: offer.description,
      price: offer.isWeaponSkill ? 8 : 6,
      offerId: offer.id,
    }));

    const supportRows = SUPPORT_POOL.map((support) => ({
      id:    `support:${support.id}`,
      tab:   'support',
      kind:  'support_gem',
      name:  `${support.name} Support`,
      icon:  support.icon ?? '◆',
      description: support.description,
      price: 5,
      supportId: support.id,
    }));

    if (!this._vendorEquipStock) {
      this._vendorEquipStock = this._generateVendorEquipStock();
    }
    const { weapons = [], armour = [], jewelry = [], maps = [] } = this._vendorEquipStock;

    return [...skillRows, ...supportRows, ...weapons, ...armour, ...jewelry, ...maps];
  }

  /**
   * Reroll the equipment/map vendor stock, charging the given gold cost.
   * @param {number} [rerollCost=5]
   * @returns {{ ok: boolean, reason?: string, price?: number }}
   */
  rerollVendorEquipment(rerollCost = 5) {
    if (!this.player) return { ok: false, reason: 'no_player' };
    if ((this.player.gold ?? 0) < rerollCost) {
      return { ok: false, reason: 'not_enough_gold', price: rerollCost };
    }
    this.player.gold       = Math.max(0, (this.player.gold ?? 0) - rerollCost);
    this._vendorEquipStock = null; // force regen on next getVendorStock()
    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, price: rerollCost };
  }

  /**
   * Attempt to buy one vendor item listing by listing id.
   * @param {string} listingId
   * @returns {{ ok: boolean, reason?: string, price?: number, itemName?: string }}
   */
  purchaseVendorItem(listingId) {
    if (!this.player?.inventory) return { ok: false, reason: 'no_player' };

    const allStock = this.getVendorStock();
    const listing  = allStock.find((row) => row.id === listingId);
    if (!listing) return { ok: false, reason: 'not_found' };

    const price = listing.price ?? 0;
    if ((this.player.gold ?? 0) < price) {
      return { ok: false, reason: 'not_enough_gold', price, itemName: listing.name };
    }

    let itemDef = null;
    if (listing.kind === 'skill_gem') {
      const offer = getSkillOfferById(listing.offerId);
      if (!offer) return { ok: false, reason: 'not_found' };
      itemDef = createSkillGemItem(offer);
    } else if (listing.kind === 'support_gem') {
      const support = SUPPORT_POOL.find((s) => s.id === listing.supportId);
      if (!support) return { ok: false, reason: 'not_found' };
      itemDef = createSupportGemItem(support);
    } else if (listing.kind === 'equipment' || listing.kind === 'map_item') {
      itemDef = listing.itemDef ?? null;
    }

    if (!itemDef) return { ok: false, reason: 'invalid_item' };

    const placed = this.player.inventory.autoPlace(itemDef);
    if (!placed) {
      return { ok: false, reason: 'inventory_full', price, itemName: listing.name };
    }

    this.player.gold = Math.max(0, (this.player.gold ?? 0) - price);

    // Remove one-of-a-kind items from the cached equip stock so they can't be bought twice
    if (this._vendorEquipStock && (listing.kind === 'equipment' || listing.kind === 'map_item')) {
      for (const section of Object.values(this._vendorEquipStock)) {
        const idx = section.findIndex((r) => r.id === listingId);
        if (idx !== -1) { section.splice(idx, 1); break; }
      }
    }

    this.audio.play('xp_collect');
    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, price, itemName: listing.name };
  }

  pause() {
    if (this.state === 'RUNNING' || this.state === 'HUB') {
      this._pausedFrom = this.state;
      this.input?.setVirtualMovement?.(0, 0);
      this.input?.setVirtualAim?.(0, 0);
      this.input?.setVirtualPrimaryHeld?.(false);
      this.state = 'PAUSED';
    }
  }

  resume() {
    if (this.state === 'PAUSED') {
      // Return to whichever state was active before the pause.
      this.state = this._pausedFrom ?? (this.currentCharId ? (this.mapInstance ? 'RUNNING' : 'HUB') : 'RUNNING');
      this._pausedFrom = null;
      this.input?.setVirtualMovement?.(0, 0);
      this.input?.setVirtualAim?.(0, 0);
      this.input?.setVirtualPrimaryHeld?.(false);
      this._lastTime = performance.now(); // reset to avoid large dt spike
      this._lastFrameAt = this._lastTime;
    }
  }

  /** Returns the nearest hub interactable currently in range, if any. */
  getNearbyHubInteractable() {
    return this._nearbyHubInteractable;
  }

  /** Apply a chosen upgrade from the LevelUpScreen. Resumes the game. */
  applyUpgrade(upgrade) {
    upgrade.apply(this.player);
    this.audio.play('level_up');
    if (this.player) this.particles.emit('level_up', this.player.x, this.player.y);
    this.resume();
  }

  /**
   * Learn and equip a skill offer entry (from consumed skill gems).
   * Handles both weapon-backed skills and pure SkillDef instances.
   * @param {object} choice
   */
  applySkillOffer(choice, opts = {}) {
    const { player } = this;
    const suppressFlow = !!opts.suppressFlow;

    // Find the first empty slot; fall back to overwriting slot 0.
    let targetSlot = this.activeSkillSystem.firstEmptySlot();
    if (targetSlot === -1) targetSlot = 0;

    if (choice.isWeaponSkill) {
      // Weapon-backed active skill: add to autoSkills[] if not already there.
      if (!player.autoSkills.some((w) => w.id === choice.id)) {
        player.autoSkills.push(choice.create());
      }
      const weapon = player.autoSkills.find((w) => w.id === choice.id);
      if (weapon) this.activeSkillSystem.equip(weapon, targetSlot);
    } else {
      // Pure SkillDef: lives in pureSkills[] and a hotbar slot.
      const skill = choice.createSkill();
      player.pureSkills.push(skill);
      this.activeSkillSystem.equip(skill, targetSlot);
    }

    this.audio.play('level_up');
    if (player) this.particles.emit('level_up', player.x, player.y);
    if (suppressFlow) {
      this._flushHudUpdate();
      return;
    }
    // Open the passive tree if there are skill points to spend.
    if (player.skillPoints > 0) {
      this.onLevelUp();
    } else {
      this.resume();
    }
  }

  /** Triggered by CollisionSystem when player HP hits 0. */
  gameOver() {
    if (this.state === 'GAME_OVER' || this.state === 'DIED') return; // guard double-trigger
    this.audio.play('player_hurt');

    // Consume a portal if we have a tracked character and portals remaining.
    if (this.currentCharId && this.portalsRemaining > 0) {
      this.portalsRemaining--;
      if (this.mapInstance) {
        this.mapInstance.portalsRemaining = this.portalsRemaining;
        this._syncMapPortals();
      }
      this.state = 'DIED';
      if (this.onPlayerDied) {
        const charDef = CHARACTER_MAP[this.player?.characterId ?? 'sage'];
        this.onPlayerDied(this.portalsRemaining, {
          elapsed: this.elapsed,
          kills:   this.kills,
          level:   this.player?.level ?? 1,
          characterName: charDef?.name ?? this.player?.characterId ?? 'Unknown',
          characterClass: charDef?.tagline ?? '',
          mapName: this.mapInstance?.mapDef?.name ?? 'Unknown Map',
        });
      }
      return;
    }

    // No portals (or legacy flow without a character save) → traditional game over.
    this.state = 'GAME_OVER';
    this.onGameOver({
      elapsed:           this.elapsed,
      kills:             this.kills,
      level:             this.player.level,
      bossesDefeated:    this.bossesDefeated,
      runEventLog:       this.runEventLog,
      shardsThisRun:     this.shardsThisRun,
      characterId:       this.player?.characterId ?? 'sage',
    });
  }

  /**
   * Continue the current map after a portal death.
   * Called by App when the player clicks "Return to Hub" on the death overlay.
   * For C2 we teleport to origin and resume; C3 will route to true hub transition.
   */
  continueAfterDeath() {
    if (this.state !== 'DIED') return;
    if (!this.player) return;

    this.player.x = 0;
    this.player.y = 0;
    this.player.health = this.player.maxHealth;
    this.player.energyShield = this.player.maxEnergyShield;

    this.resume();
  }

  /** Return from MAP_COMPLETE overlay and continue looting in the cleared map. */
  stayInClearedMap() {
    if (this.state !== 'MAP_COMPLETE') return;
    this.state = 'RUNNING';
    this._lastTime = performance.now();
    this._flushHudUpdate();
  }

  /** Clean up RAF and input listeners. Call from React useEffect cleanup. */
  destroy() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this.input.destroy();
    window.removeEventListener('keydown', this._onDebugKey);
  }
}
