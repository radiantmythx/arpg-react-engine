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
import { TrainingDummy } from './entities/TrainingDummy.js';
import { BossEnemy } from './entities/BossEnemy.js';
import { PortalEntity } from './entities/PortalEntity.js';
import { ChaosShardGem } from './entities/ChaosShardGem.js';
import { GoldGem } from './entities/GoldGem.js';
import { ItemDrop } from './entities/ItemDrop.js';
import { PassiveItem } from './PassiveItem.js';
import { rollRarity, generateItem, hydrateItemAffixState } from './data/itemGenerator.js';
import { applyStats, removeStats, TREE_NODE_MAP } from './data/passiveTree.js';
import { CHARACTER_MAP } from './data/characters.js';
import { AchievementSystem } from './systems/AchievementSystem.js';
import { MetaProgression } from './MetaProgression.js';
import { MAP_THEMES, BOSS_DEFS, BOSS_SCHEDULE, SPAWN_RADIUS, LEVEL_XP_TABLE, ENEMY_AI } from './config.js';
import { makeSupportInstance, isSupportCompatible } from './data/supports.js';
import { SUPPORT_POOL, createSupportGemItem } from './data/supports.js';
import {
  createSkillGemItem,
  getAvailableSkillOffers,
  getSkillOfferById,
  getPureSkillCtorById,
  listSkillOffers,
} from './content/registries/skillRegistry.js';
import { listUniqueItemDefs, listGenericItemDefs } from './content/registries/itemRegistry.js';
import { createMapItemDrop, isMapItem, mapItemToMapDef } from './data/mapItems.js';
import { CharacterSave } from './CharacterSave.js';
import { MapInstance } from './MapInstance.js';
import { HubWorld } from './HubWorld.js';
import { MapGenerator } from './MapGenerator.js';
import { Navigation } from './Navigation.js';
import { calcSellPrice } from './ItemPricing.js';
import { MAX_SUPPORT_SOCKETS, openSupportSlotsForSkill } from './supportSockets.js';
import { AILMENT_DEFS, resolvePenetrationMap } from './data/skillTags.js';
import { SCALING_CONFIG, areaLevelBucketLabel, clampAreaLevel } from './config/scalingConfig.js';
import { POTION_TUNING } from './content/tuning/index.js';
import { createDefaultPotionBelt, normalizePotionBelt, POTION_MAP, rollPotionDrop, formatPotionEffectLine } from './data/potions.js';
import { canEquipItemInSlot, normalizeWeaponItem } from './data/weaponTypes.js';
import { evaluateSkillRequirements } from './data/skillRequirements.js';
import { summarizeActiveModifiers, summarizeCharacterBonuses } from './data/modifierEngine.js';
import { applyCraftingAction, CRAFTING_ACTIONS } from './data/itemCrafting.js';

/** World-space radius within which hovering the mouse highlights an ItemDrop. */
const HOVER_RADIUS = 70;
const HOVER_HOSTILE_EXTRA_RADIUS = 14;
const HOVER_INTERACTABLE_EXTRA_RADIUS = 30;
const UNIQUE_ITEM_DEFS = listUniqueItemDefs();
const GENERIC_ITEM_DEFS = listGenericItemDefs();

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
    * @param {(payload: object|null) => void} [onHoverInspectChange] - called when hovered world target changes
   */
    constructor(canvas, onHudUpdate, onLevelUp, onGameOver, onHoveredItemChange, onAchievementUnlock, onBossAnnounce, onEnterHub, onPlayerDied, onHubInteractableChange, onMapComplete, onHoverInspectChange) {
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
    this.onHoverInspectChange = onHoverInspectChange ?? null;

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
    this._hoverInspectTarget = null;
    this._hoverInspectHash = '';
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
    this._hubTrainingDummy = null;
    this._trainingWindowSeconds = 8;
    this._trainingDamageEvents = [];
    this._trainingManaSpentEvents = [];
    this._trainingManaRegenEvents = [];
    /** Phase 1 telemetry grouped by AreaLevel bucket (e.g. "1-5", "6-10"). */
    this._areaLevelTelemetry = {};
    this._mapKillTelemetry = null;
    this._mapDropBadLuckState = { negativeStreak: 0, protectionTriggers: 0, totalDrops: 0 };
    this._potionBelt = [];
    this._potionSpeedBonusPct = 0;
    /** Cached rolled equipment/map vendor stock — null forces regen on next getVendorStock(). */
    this._vendorEquipStock = null;
    /** Optional mobile-only quality-of-life assists. */
    this.mobileAssist = { autoPickup: false, enabled: false };
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
    this.minimapMode = 0;
    this._mapExplorationMask = null;
    this._hubExplorationMask = null;
    this._hubExplorationCols = 0;
    this._hubExplorationRows = 0;
    this._hubExplorationCellSize = 48;

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
        if (this.player) this._flushHudUpdate();
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
    this._clearHoveredInspectTarget();
    this._resetAreaLevelTelemetry();
    this._mapDropBadLuckState = { negativeStreak: 0, protectionTriggers: 0, totalDrops: 0 };
    this._mapExplorationMask = null;
    this._hubExplorationMask = null;

    this.entities.clear();
    this.spawner.reset();

    const charDef = CHARACTER_MAP[characterId] ?? CHARACTER_MAP['sage'];
    this.player = new Player(0, 0, charDef);
    this._potionBelt = this._buildDefaultPotionBeltState();
    this._potionSpeedBonusPct = 0;

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
    this._clearHoveredInspectTarget();
    this._mapExplorationMask = null;

    this.entities.clear();
    this.spawner.reset();
    this.particles = new ParticleSystem();

    // Load character save.
    const saveData = CharacterSave.load(characterId);
    const classId  = saveData?.class ?? 'sage';
    const charDef  = CHARACTER_MAP[classId] ?? CHARACTER_MAP['sage'];

    this.player = new Player(0, 0, charDef);
    const savedHealth = saveData?.health;
    const savedMana = saveData?.mana;
    this._potionBelt = saveData?.potionBelt
      ? this._restorePotionBeltState(saveData.potionBelt)
      : this._buildDefaultPotionBeltState();
    this._potionSpeedBonusPct = 0;

    if (saveData) {
      // ── Restore base combat stats ───────────────────────────────────────
      this.player.level        = saveData.level    ?? 1;
      this.player.xp           = saveData.xp       ?? 0;
      this.player.xpToNext     = LEVEL_XP_TABLE[this.player.level] ?? this.player.xpToNext;
      this.player.maxEnergyShield = saveData.maxEnergyShield ?? 0;
      this.player.energyShield    = saveData.energyShield    ?? 0;
      this.player.skillPoints  = saveData.skillPoints ?? Math.max(0, (this.player.level - 1) * 2);
      this.player.gold         = saveData.gold ?? 0;

      // ── Restore passive tree (nodes beyond the constructor-applied start set) ──
      const savedNodes = new Set(saveData.passiveTree?.allocated ?? charDef.treeStartNodes ?? []);
      for (const nodeId of savedNodes) {
        if (!this.player.allocatedNodes.has(nodeId)) {
          const node = TREE_NODE_MAP[nodeId];
          if (node) {
            this.player.allocatedNodes.add(nodeId);
            const snapshot = applyStats(this.player, node.stats, {
              id: `passive:${nodeId}`,
              kind: node.type === 'keystone' ? 'keystone' : 'passiveTree',
              label: node.label ?? node.name ?? nodeId,
            });
            this.player.nodeSnapshots.set(nodeId, snapshot);
          }
        }
      }

      // ── Restore equipment ─────────────────────────────────────────────────
      const eq = saveData.equipment ?? {};
      for (const [slot, itemDef] of Object.entries(eq)) {
        if (itemDef) {
          const hydrated = hydrateItemAffixState(itemDef);
          this.player.equip(normalizeWeaponItem(hydrated, { enforceWeaponDimensions: false }), slot);
        }
      }

      // ── Restore inventory ─────────────────────────────────────────────────
      const invItems = saveData.inventory?.items ?? [];
      for (const item of invItems) {
        const hydrated = hydrateItemAffixState(item);
        this.player.inventory.place(
          normalizeWeaponItem(hydrated, { enforceWeaponDimensions: false }),
          item.gridX,
          item.gridY,
        );
      }

      this._restorePrimarySkillFromSave(saveData);
    }

    // Apply permanent meta-tree bonuses (shard gain mult, etc.).
    const metaNodes = MetaProgression.loadMetaNodes();
    const metaBonus = MetaProgression.getRunBonuses(metaNodes);
    this._shardGainMult = metaBonus.shardGainMult ?? 1;

    this._normalizePlayerVitals(savedHealth, { revive: true });
    this._normalizePlayerMana(savedMana);
    this._refillPlayerResourcesOnTransition();
    this.player.resetManaFlowCounters?.();
    this._resetTrainingTelemetry();
    this._resetAreaLevelTelemetry();
    this._mapDropBadLuckState = { negativeStreak: 0, protectionTriggers: 0, totalDrops: 0 };

    this.activeSkillSystem = new ActiveSkillSystem();
    if (saveData) this._restoreActiveSkillsFromSave(saveData);

    this.entities.add(this.player);
    this._spawnHubTrainingDummy();
    this._clearMapPlayerModEffects();
    this.hubWorld = new HubWorld();
    if (this.pendingMapPortalDef) {
      this.hubWorld.setMapPortal(this.pendingMapPortalDef);
    }
    this._initHubMinimapExploration();
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

  _restorePrimarySkillFromSave(saveData) {
    const savedPrimary = saveData?.primarySkill;
    if (!savedPrimary) return;

    if (!savedPrimary.id) {
      this.player.primarySkill = null;
      return;
    }

    let primary = this.player?.primarySkill ?? null;
    if (!primary || primary.id !== savedPrimary.id) {
      const offer = getSkillOfferById(savedPrimary.id);
      if (!offer?.isActiveSkill || typeof offer.create !== 'function') return;
      primary = offer.create();
      primary._skillGemOfferId = offer.id;
      this.player.primarySkill = primary;
      this.player.autoSkills = (this.player.autoSkills ?? []).filter((w) => w.id !== primary.id);
      this.player.autoSkills.push(primary);
    }

    this._setSkillProgress(primary, savedPrimary.level ?? 1, savedPrimary.xp ?? 0);

    if (!Array.isArray(savedPrimary?.supportSlots)) return;
    const slots = this.player.primarySkill.supportSlots ?? [];
    while (slots.length < MAX_SUPPORT_SOCKETS) slots.push(null);
    for (let i = 0; i < slots.length; i++) {
      const supDef = savedPrimary.supportSlots[i];
      slots[i] = supDef ? makeSupportInstance(supDef) : null;
    }
  }

  _restoreActiveSkillsFromSave(saveData) {
    const savedSkills = saveData?.activeSkills;
    if (!Array.isArray(savedSkills)) return;

    for (let i = 0; i < 3; i++) {
      const saved = savedSkills[i];
      if (!saved?.id) continue;

      if (saved.type === 'weapon') {
        const offer = getSkillOfferById(saved.id);
        if (!offer?.isActiveSkill || typeof offer.create !== 'function') continue;

        let weapon = this.player.autoSkills.find((w) => w.id === saved.id);
        if (!weapon) {
          weapon = offer.create();
          this.player.autoSkills.push(weapon);
        }
        weapon.level = Math.max(1, saved.level ?? weapon.level ?? 1);
        weapon._xp = saved.xp ?? 0;
        if (Array.isArray(saved.supportSlots) && Array.isArray(weapon.supportSlots)) {
          for (let slotIdx = 0; slotIdx < weapon.supportSlots.length; slotIdx++) {
            const supDef = saved.supportSlots[slotIdx];
            weapon.supportSlots[slotIdx] = supDef ? makeSupportInstance(supDef) : null;
          }
        }
        this.activeSkillSystem.equip(weapon, i);
        continue;
      }

      if (saved.type === 'pure_skill') {
        const Ctor = getPureSkillCtorById(saved.id);
        if (!Ctor) continue;
        const skill = new Ctor();
        skill.level = Math.max(1, saved.level ?? 1);
        skill._xp = saved.xp ?? 0;
        while ((skill.supportSlots?.length ?? 0) < MAX_SUPPORT_SOCKETS) {
          skill.supportSlots.push(null);
        }
        if (typeof skill._applyLevelStats === 'function') {
          for (let level = 2; level <= skill.level; level++) {
            skill.level = level;
            skill._applyLevelStats();
          }
        }
        if (Array.isArray(saved.supportSlots)) {
          for (let slotIdx = 0; slotIdx < skill.supportSlots.length; slotIdx++) {
            const supDef = saved.supportSlots[slotIdx];
            skill.supportSlots[slotIdx] = supDef ? makeSupportInstance(supDef) : null;
          }
        }
        this.player.pureSkills.push(skill);
        this.activeSkillSystem.equip(skill, i);
      }
    }
  }

  /**
   * Enter a map instance from hub.
   * C2 uses the existing RUNNING simulation as the map gameplay state.
   * C4 will replace theme-only map setup with generated layouts and walls.
   * @param {object} mapDef
   * @param {number} [seed]
   */
  enterMap(mapDef = { id: 'act1', name: 'Unknown Map' }, seed, existingInstance = null) {
    if (!this.player) return;

    this.state = 'MAP_LOADING';
    this.pendingMapPortalDef = null;
    this.hubWorld?.clearMapPortal();
    this.mapInstance = existingInstance ?? new MapInstance(mapDef, seed);
    this.mapInstance.applyMods(this.mapInstance.mapDef?.mods ?? []);
    this.hubWorld = null;
    this.mapLayout = MapGenerator.generate(this.mapInstance.mapDef ?? mapDef, this.mapInstance.seed);
    this._initMapMinimapExploration();
    this.mapInstance.layoutModMetadata = this.mapLayout?.mapModMetadata ?? null;
    this._navCache = Navigation.buildCache(this.mapLayout);
    this._nearbyHubInteractable = null;
    if (this.onHubInteractableChange) this.onHubInteractableChange(null);
    this.portalsRemaining = this.mapInstance.portalsRemaining;
    this._initMapEncounterDebugMetadata();
    this._beginMapTelemetry();

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
    this._refillPlayerResourcesOnTransition();
    this.entities.add(this.player);

    // C5: all non-scripted enemies are placed on map load.
    const liveMapDef = this.mapInstance.mapDef ?? mapDef;
    const areaLevel = Math.max(1, this.mapInstance?.areaLevel ?? liveMapDef?.areaLevel ?? 1);
    const seeded = this.spawner.populateMap(this.mapLayout, liveMapDef, this.entities, areaLevel, this.mapInstance);
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

  _resetAreaLevelTelemetry() {
    this._areaLevelTelemetry = {};
    this._mapKillTelemetry = null;
  }

  _initMapEncounterDebugMetadata() {
    if (!this.mapInstance) return;

    const debug = {
      sourceMapItemLevel: this.mapInstance.sourceMapItemLevel,
      computedAreaLevel: this.mapInstance.areaLevel,
      enemyScalarProfileVersion: SCALING_CONFIG.version,
    };

    this.mapInstance.enemyScalarProfileVersion = SCALING_CONFIG.version;
    this.mapInstance.encounterDebug = debug;

    if (this.mapLayout?.encounterMetadata) {
      this.mapLayout.encounterMetadata.sourceMapItemLevel = debug.sourceMapItemLevel;
      this.mapLayout.encounterMetadata.computedAreaLevel = debug.computedAreaLevel;
      this.mapLayout.encounterMetadata.enemyScalarProfileVersion = debug.enemyScalarProfileVersion;
    }

    console.info(
      `[Phase1] Map area level=${debug.computedAreaLevel} sourceMapItemLevel=${debug.sourceMapItemLevel} scalarProfile=${debug.enemyScalarProfileVersion}`,
    );
  }

  _beginMapTelemetry() {
    if (!this.mapInstance) {
      this._mapKillTelemetry = null;
      return;
    }
    this._mapKillTelemetry = {
      areaLevelBucket: areaLevelBucketLabel(this.mapInstance.areaLevel),
      lastKillAtSeconds: 0,
    };
    const bucket = this._ensureAreaLevelBucket(this.mapInstance.areaLevel);
    bucket.mapRuns += 1;
  }

  _ensureAreaLevelBucket(areaLevel) {
    const key = areaLevelBucketLabel(areaLevel);
    if (!this._areaLevelTelemetry[key]) {
      this._areaLevelTelemetry[key] = {
        mapRuns: 0,
        kills: 0,
        totalKillIntervalSeconds: 0,
        damageTaken: 0,
      };
    }
    return this._areaLevelTelemetry[key];
  }

  _recordAreaLevelKillTelemetry() {
    if (!this.mapInstance || !this._mapKillTelemetry) return;
    const bucket = this._ensureAreaLevelBucket(this.mapInstance.areaLevel);
    const delta = Math.max(0, this.elapsed - (this._mapKillTelemetry.lastKillAtSeconds ?? 0));
    bucket.kills += 1;
    bucket.totalKillIntervalSeconds += delta;
    this._mapKillTelemetry.lastKillAtSeconds = this.elapsed;
  }

  _recordAreaLevelDamageTakenTelemetry(damage = 0) {
    if (!this.mapInstance) return;
    const bucket = this._ensureAreaLevelBucket(this.mapInstance.areaLevel);
    bucket.damageTaken += Math.max(0, Number(damage) || 0);
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
      areaLevel: this.mapInstance?.areaLevel ?? 1,
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
      areaLevel: this.pendingMapPortalDef.areaLevel ?? this.pendingMapPortalDef.sourceMapItemLevel ?? 1,
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
    this.player.terrainSpeedMult = 1;
    if (this.input.wasPressed('KeyH')) this.cycleMinimapMode();
    this._handlePotionInput();

    // Player movement.
    this.player.update(dt, this.input);
    this._applyPassiveTreeRuntimeEffects(dt);
    this._updatePotionState(dt);
    this._updateCursorAim();
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

    // Hub training mode: allow firing skills against the dummy target.
    for (const weapon of this.player.autoSkills) {
      weapon.update(dt, this.player, this.entities, this);
    }
    this.activeSkillSystem.update(dt, this.player, this.entities, this);
    const skillKeys = this.input.getSkillActivations();
    if (skillKeys.space) this._activatePrimarySkill();
    if (skillKeys.q) this.activeSkillSystem.activate(0, this.player, this.entities, this);
    if (skillKeys.e) this.activeSkillSystem.activate(1, this.player, this.entities, this);
    if (skillKeys.r) this.activeSkillSystem.activate(2, this.player, this.entities, this);

    for (const enemy of this.entities.enemies) {
      enemy.update(dt, this.player, this);
    }
    for (const proj of this.entities.projectiles) {
      if (!proj.active) continue;
      proj.update(dt);
    }

    this.collision.buildGrids(this.entities);
    this.collision.checkProjectilesVsEnemies(this.entities, this);
    this.entities.cleanup();

    const manaFlow = this.player.consumeManaFlowCounters?.() ?? { spent: 0, regenerated: 0 };
    if ((manaFlow.spent ?? 0) > 0 || (manaFlow.regenerated ?? 0) > 0) {
      this._recordTrainingManaFlow(manaFlow.spent ?? 0, manaFlow.regenerated ?? 0);
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

    this._updateHoveredWorldTarget();
    this._revealHubExploration();

    this.input.clearJustPressed();

    // Throttle HUD updates.
    this._hudThrottle += dt;
    if (this._hudThrottle >= 0.05) {
      this._hudThrottle = 0;
      this._flushHudUpdate();
      this._emitHoveredInspect();
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

  /** True if the player can return to hub for free because the map boss has been defeated. */
  canReturnToHubFree() {
    return !!(this.currentCharId && this.mapInstance && this.mapInstance.isCleared);
  }

  /** Return to hub at no portal cost after the map boss has been defeated. */
  returnToHubFree() {
    if (!this.canReturnToHubFree()) return false;
    this._recordMapClearProgress();
    this.checkpoint();
    this.enterHub(this.currentCharId, { preserveMapState: false });
    return true;
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

    const safeMaxHealth = Math.max(1, player.maxHealth ?? 1);
    const safeHealth = Math.max(0, Math.min(player.health ?? safeMaxHealth, safeMaxHealth));
    const safeMaxMana = Math.max(0, player.maxMana ?? 0);
    const safeMana = Math.max(0, Math.min(player.mana ?? safeMaxMana, safeMaxMana));

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
      health:          safeHealth,
      maxHealth:       safeMaxHealth,
      mana:            safeMana,
      maxMana:         safeMaxMana,
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
        level: player.primarySkill?.level ?? 1,
        xp: player.primarySkill?._xp ?? 0,
        supportSlots: (player.primarySkill?.supportSlots ?? []).map((sup) => {
          if (!sup) return null;
          if (sup._itemDef) {
            return { ...sup._itemDef, gemId: sup._itemDef.gemId ?? sup.id };
          }
          return {
            type: 'support_gem',
            slot: 'support_gem',
            rarity: 'magic',
            gridW: 1,
            gridH: 1,
            gemId: sup.id,
            id: sup.id,
            name: `${sup.name ?? 'Support'} Support`,
            icon: sup.icon ?? '◆',
            level: 1,
            maxLevel: 20,
            stackable: false,
          };
        }),
      },
      activeSkills: this.activeSkillSystem.serializeFull(),
      autoSkills:   player.autoSkills.map((w) => w.id),
      gold:         player.gold ?? 0,
      potionBelt: this._serializePotionBeltForSave(),
    };
  }

  /**
   * Clamp potentially invalid life values from older saves or repeated stat application.
   * @param {number|undefined|null} preferredHealth
   * @param {{revive?: boolean}} [opts]
   */
  _normalizePlayerVitals(preferredHealth, opts = {}) {
    if (!this.player) return;
    this.player.maxHealth = Math.max(1, this.player.maxHealth ?? 1);
    const targetHealth = Number.isFinite(preferredHealth) ? preferredHealth : this.player.health;
    const clamped = Math.max(0, Math.min(targetHealth ?? this.player.maxHealth, this.player.maxHealth));
    this.player.health = opts.revive ? Math.max(1, clamped) : clamped;
  }

  _normalizePlayerMana(preferredMana) {
    if (!this.player) return;
    this.player.maxMana = Math.max(0, this.player.maxMana ?? 0);
    const targetMana = Number.isFinite(preferredMana) ? preferredMana : this.player.mana;
    this.player.mana = Math.max(0, Math.min(targetMana ?? this.player.maxMana, this.player.maxMana));
  }

  _refillPlayerResourcesOnTransition() {
    if (!this.player) return;
    this.player.health = this.player.maxHealth;
    this.player.mana = this.player.maxMana;
    this.player.energyShield = this.player.maxEnergyShield;
    for (const slot of this._potionBelt ?? []) {
      if (!slot?.item) continue;
      const runtime = this._resolvePotionRuntime(slot);
      if (!runtime) continue;
      slot.charges = runtime.maxCharges;
      slot.activeRemaining = 0;
      slot.activeDuration = runtime.duration;
    }
  }

  _spawnHubTrainingDummy() {
    this._hubTrainingDummy = new TrainingDummy(0, 240);
    this.entities.add(this._hubTrainingDummy);
  }

  _resetTrainingTelemetry() {
    this._trainingDamageEvents = [];
    this._trainingManaSpentEvents = [];
    this._trainingManaRegenEvents = [];
  }

  _recordTrainingDamage(damage) {
    if (this.state !== 'HUB' || !Number.isFinite(damage) || damage <= 0) return;
    const now = performance.now() / 1000;
    this._trainingDamageEvents.push({ t: now, v: damage });
    this._pruneTrainingEvents(now);
  }

  _recordTrainingManaFlow(spent, regenerated) {
    if (this.state !== 'HUB') return;
    const now = performance.now() / 1000;
    if (Number.isFinite(spent) && spent > 0) this._trainingManaSpentEvents.push({ t: now, v: spent });
    if (Number.isFinite(regenerated) && regenerated > 0) this._trainingManaRegenEvents.push({ t: now, v: regenerated });
    this._pruneTrainingEvents(now);
  }

  _pruneTrainingEvents(now) {
    const cutoff = now - this._trainingWindowSeconds;
    this._trainingDamageEvents = this._trainingDamageEvents.filter((e) => e.t >= cutoff);
    this._trainingManaSpentEvents = this._trainingManaSpentEvents.filter((e) => e.t >= cutoff);
    this._trainingManaRegenEvents = this._trainingManaRegenEvents.filter((e) => e.t >= cutoff);
  }

  _serializeTrainingHud() {
    const now = performance.now() / 1000;
    this._pruneTrainingEvents(now);
    const span = this._trainingWindowSeconds;
    const sum = (arr) => arr.reduce((acc, e) => acc + e.v, 0);
    return {
      enabled: this.state === 'HUB',
      windowSeconds: span,
      dps: sum(this._trainingDamageEvents) / span,
      manaSpendPerS: sum(this._trainingManaSpentEvents) / span,
      manaRegenPerS: sum(this._trainingManaRegenEvents) / span,
    };
  }

  _buildDefaultPotionBeltState() {
    return createDefaultPotionBelt().map((item, slotIndex) => {
      const baseMax = Math.max(1, Number(item?.potion?.maxCharges) || 1);
      return {
        slotIndex,
        item,
        charges: item ? baseMax : 0,
        activeRemaining: 0,
        activeDuration: 0,
      };
    });
  }

  _restorePotionBeltState(savedBelt) {
    const savedSlots = Array.isArray(savedBelt) ? savedBelt : [];
    const normalizedItems = normalizePotionBelt(savedSlots.map((slot) => slot?.item ?? null));
    const state = [];
    for (let index = 0; index < POTION_TUNING.slotCount; index++) {
      const item = normalizedItems[index] ?? null;
      const savedSlot = savedSlots[index] ?? {};
      const baseMax = Math.max(1, Number(item?.potion?.maxCharges) || 1);
      state.push({
        slotIndex: index,
        item,
        charges: item ? Math.max(0, Number(savedSlot.charges) || 0) : 0,
        activeRemaining: item ? Math.max(0, Number(savedSlot.activeRemaining) || 0) : 0,
        activeDuration: item ? Math.max(0, Number(savedSlot.activeDuration) || Number(item?.potion?.duration) || 0) : 0,
      });
      if (state[index].charges > baseMax) state[index].charges = baseMax;
    }
    return state;
  }

  _serializePotionBeltForSave() {
    return (this._potionBelt ?? []).map((slot) => ({
      item: slot.item
        ? {
            potionId: slot.item.potionId ?? slot.item.id,
            gridW: slot.item.gridW ?? 1,
            gridH: slot.item.gridH ?? 2,
          }
        : null,
      charges: slot.charges ?? 0,
      activeRemaining: slot.activeRemaining ?? 0,
      activeDuration: slot.activeDuration ?? 0,
    }));
  }

  _resolvePotionRuntime(slot) {
    const item = slot?.item;
    if (!item) return null;
    const player = this.player;
    const potion = item.potion ?? POTION_MAP[item.potionId] ?? POTION_MAP[item.id] ?? null;
    if (!potion) return null;

    const durationMult = Math.max(POTION_TUNING.minDurationMult, player?.potionDurationMult ?? 1);
    const effectMult = Math.max(POTION_TUNING.minEffectMult, player?.potionEffectMult ?? 1);
    const maxChargesMult = Math.max(POTION_TUNING.minMaxChargesMult, player?.potionMaxChargesMult ?? 1);
    const chargesPerUseMult = Math.max(POTION_TUNING.minChargesPerUseMult, player?.potionChargesPerUseMult ?? 1);
    const currentAreaLevel = Math.max(1, this.mapInstance?.areaLevel ?? player?.level ?? 1);
    const areaSteps = Math.max(0, currentAreaLevel - (POTION_TUNING.areaLevelPivot ?? 1));
    const areaEffectMult = Math.min(
      POTION_TUNING.effectAreaCap ?? Number.POSITIVE_INFINITY,
      1 + areaSteps * (POTION_TUNING.effectPerAreaLevel ?? 0),
    );
    const areaMaxChargesMult = Math.min(
      POTION_TUNING.maxChargesAreaCap ?? Number.POSITIVE_INFINITY,
      1 + areaSteps * (POTION_TUNING.maxChargesPerAreaLevel ?? 0),
    );

    const maxCharges = Math.max(1, Math.round((potion.maxCharges ?? 1) * maxChargesMult * areaMaxChargesMult));
    const chargesPerUse = Math.max(1, Math.min(maxCharges, Math.round((potion.chargesPerUse ?? 1) * chargesPerUseMult)));
    const duration = Math.max(0.1, (potion.duration ?? 0) * durationMult);
    const chargeRegenPerS = Math.max(0, (POTION_TUNING.baseChargeRegenPerS ?? 0) + (player?.potionChargeRegenPerS ?? 0));

    return {
      maxCharges,
      chargesPerUse,
      duration,
      effectMult: effectMult * areaEffectMult,
      chargeRegenPerS,
      effects: potion.effects ?? [],
    };
  }

  _serializePotionHud() {
    return (this._potionBelt ?? []).map((slot, index) => {
      const runtime = this._resolvePotionRuntime(slot);
      const maxCharges = runtime?.maxCharges ?? 0;
      const activeDuration = Math.max(0.001, slot.activeDuration ?? runtime?.duration ?? 0.001);
      const activePct = slot.activeRemaining > 0
        ? Math.max(0, Math.min(1, slot.activeRemaining / activeDuration))
        : 0;
      return {
        slot: index + 1,
        hotkey: String(index + 1),
        empty: !slot.item,
        id: slot.item?.id ?? null,
        name: slot.item?.name ?? 'Empty',
        icon: slot.item?.icon ?? '·',
        color: slot.item?.color ?? '#5a6070',
        charges: Math.max(0, slot.charges ?? 0),
        maxCharges,
        chargesPerUse: runtime?.chargesPerUse ?? 0,
        duration: runtime?.duration ?? 0,
        effectLines: (runtime?.effects ?? []).map((effect) => {
          const scaled = (effect.value ?? 0) * (runtime?.effectMult ?? 1);
          return formatPotionEffectLine(effect.type, scaled);
        }),
        active: slot.activeRemaining > 0,
        activePct,
      };
    });
  }

  _tryAutoSlotPotion(itemDef) {
    if (!itemDef || itemDef.type !== 'potion') return false;
    const potionId = itemDef.potionId ?? itemDef.id;

    for (const slot of this._potionBelt ?? []) {
      if (!slot?.item) continue;
      const slotPotionId = slot.item.potionId ?? slot.item.id;
      if (slotPotionId !== potionId) continue;
      const runtime = this._resolvePotionRuntime(slot);
      if (!runtime) continue;
      slot.charges = Math.min(runtime.maxCharges, (slot.charges ?? 0) + runtime.chargesPerUse);
      this._flushHudUpdate();
      return true;
    }

    for (const slot of this._potionBelt ?? []) {
      if (slot?.item) continue;
      slot.item = itemDef;
      const runtime = this._resolvePotionRuntime(slot);
      slot.charges = runtime?.maxCharges ?? Math.max(1, Number(itemDef?.potion?.maxCharges) || 1);
      slot.activeRemaining = 0;
      slot.activeDuration = runtime?.duration ?? Math.max(0.1, Number(itemDef?.potion?.duration) || 0.1);
      this._flushHudUpdate();
      return true;
    }

    return false;
  }

  _rollPotionDropOnKill(enemy) {
    const chance = enemy?.isBoss
      ? POTION_TUNING.dropChanceBoss
      : enemy?.isChampion
        ? POTION_TUNING.dropChanceChampion
        : POTION_TUNING.dropChanceNormal;
    if (Math.random() >= Math.max(0, chance ?? 0)) return null;
    const areaLevel = Math.max(1, this.mapInstance?.areaLevel ?? this.player?.level ?? 1);
    return rollPotionDrop({ areaLevel, isChampion: !!enemy?.isChampion, isBoss: !!enemy?.isBoss });
  }

  _usePotion(slotIndex) {
    const slot = this._potionBelt?.[slotIndex];
    if (!slot?.item) return false;
    const runtime = this._resolvePotionRuntime(slot);
    if (!runtime) return false;
    if ((slot.charges ?? 0) + 1e-6 < runtime.chargesPerUse) return false;

    slot.charges = Math.max(0, slot.charges - runtime.chargesPerUse);
    slot.activeDuration = runtime.duration;
    slot.activeRemaining = runtime.duration;
    this._flushHudUpdate();
    return true;
  }

  _handlePotionInput() {
    if (this.input.wasPressed('Digit1')) this._usePotion(0);
    if (this.input.wasPressed('Digit2')) this._usePotion(1);
    if (this.input.wasPressed('Digit3')) this._usePotion(2);
    if (this.input.wasPressed('Digit4')) this._usePotion(3);
  }

  _grantPotionCharges(baseAmount) {
    if (!this.player || !Array.isArray(this._potionBelt)) return;
    const gainMult = Math.max(0, this.player.potionChargeGainMult ?? 1);
    const gainFlat = this.player.potionChargeGainFlat ?? 0;
    const gain = Math.max(0, baseAmount * gainMult + gainFlat);
    if (gain <= 0) return;

    for (const slot of this._potionBelt) {
      if (!slot?.item) continue;
      const runtime = this._resolvePotionRuntime(slot);
      if (!runtime) continue;
      slot.charges = Math.min(runtime.maxCharges, (slot.charges ?? 0) + gain);
    }
  }

  _updatePotionState(dt) {
    if (!this.player || !Array.isArray(this._potionBelt)) return;
    let moveSpeedBonusPct = 0;

    for (const slot of this._potionBelt) {
      if (!slot?.item) continue;
      const runtime = this._resolvePotionRuntime(slot);
      if (!runtime) continue;

      slot.charges = Math.min(runtime.maxCharges, (slot.charges ?? 0) + runtime.chargeRegenPerS * dt);

      if ((slot.activeRemaining ?? 0) <= 0) continue;
      slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);

      for (const effect of runtime.effects) {
        const scaled = (effect.value ?? 0) * runtime.effectMult;
        if (effect.type === 'life_regen_per_s') {
          this.player.heal(scaled * dt);
        } else if (effect.type === 'mana_regen_per_s') {
          const before = this.player.mana;
          this.player.mana = Math.max(0, Math.min(this.player.maxMana, this.player.mana + scaled * dt));
          const gained = this.player.mana - before;
          if (gained > 0) this.player._manaRegenCounter += gained;
        } else if (effect.type === 'move_speed_pct') {
          moveSpeedBonusPct += scaled;
        }
      }
    }

    this._potionSpeedBonusPct = Math.max(0, moveSpeedBonusPct);
    this.player.moveSpeedMult = 1 + this._potionSpeedBonusPct;
  }

  cycleMinimapMode() {
    this.minimapMode = (this.minimapMode + 1) % 3;
    this._flushHudUpdate();
    return this.minimapMode;
  }

  cycleMobileMinimapMode() {
    // Mobile cycle mirrors desktop's 3-step feel while keeping the joystick-friendly mini panel.
    // 0 = hidden, 3 = mini panel above joystick, 2 = full overlay.
    if (this.minimapMode === 0) this.minimapMode = 3;
    else if (this.minimapMode === 3) this.minimapMode = 2;
    else this.minimapMode = 0;
    this._flushHudUpdate();
    return this.minimapMode;
  }

  _initMapMinimapExploration() {
    if (!this.mapLayout) {
      this._mapExplorationMask = null;
      return;
    }
    const size = (this.mapLayout.cols ?? 0) * (this.mapLayout.rows ?? 0);
    if (this.mapInstance?.minimapExplorationMask instanceof Uint8Array && this.mapInstance.minimapExplorationMask.length === size) {
      this._mapExplorationMask = this.mapInstance.minimapExplorationMask;
      return;
    }
    this._mapExplorationMask = new Uint8Array(size);
    if (this.mapInstance) this.mapInstance.minimapExplorationMask = this._mapExplorationMask;
  }

  _initHubMinimapExploration() {
    if (!this.hubWorld) {
      this._hubExplorationMask = null;
      this._hubExplorationCols = 0;
      this._hubExplorationRows = 0;
      return;
    }
    this._hubExplorationCols = Math.max(1, Math.ceil(this.hubWorld.width / this._hubExplorationCellSize));
    this._hubExplorationRows = Math.max(1, Math.ceil(this.hubWorld.height / this._hubExplorationCellSize));
    this._hubExplorationMask = new Uint8Array(this._hubExplorationCols * this._hubExplorationRows);
  }

  _revealMapExploration() {
    if (!this.player || !this.mapLayout || !this._mapExplorationMask) return;
    const tile = this.mapLayout.worldToTile(this.player.x, this.player.y);
    const radius = 7;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = tile.tx + dx;
        const ty = tile.ty + dy;
        if (tx < 0 || ty < 0 || tx >= this.mapLayout.cols || ty >= this.mapLayout.rows) continue;
        this._mapExplorationMask[ty * this.mapLayout.cols + tx] = 1;
      }
    }
    if (this.mapInstance) this.mapInstance.minimapExplorationMask = this._mapExplorationMask;
  }

  _revealHubExploration() {
    if (!this.player || !this.hubWorld || !this._hubExplorationMask) return;
    const halfW = this.hubWorld.width / 2;
    const halfH = this.hubWorld.height / 2;
    const cellX = Math.floor((this.player.x + halfW) / this._hubExplorationCellSize);
    const cellY = Math.floor((this.player.y + halfH) / this._hubExplorationCellSize);
    const radius = 3;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const cx = cellX + dx;
        const cy = cellY + dy;
        if (cx < 0 || cy < 0 || cx >= this._hubExplorationCols || cy >= this._hubExplorationRows) continue;
        this._hubExplorationMask[cy * this._hubExplorationCols + cx] = 1;
      }
    }
  }

  _collectMinimapMarkers() {
    const markers = [];
    if (this.player) {
      markers.push({ type: 'player', x: this.player.x, y: this.player.y, color: '#f7f7ff', size: 4.5, priority: 10 });
    }
    if (this.mapLayout?.bossRoom) {
      const bossRoomWorld = this.mapLayout.tileToWorld(this.mapLayout.bossRoom.centerX, this.mapLayout.bossRoom.centerY);
      markers.push({ type: 'boss-room', x: bossRoomWorld.x, y: bossRoomWorld.y, color: '#ff9a6c', size: 4, priority: 4 });
    }
    for (const boss of this.entities.bosses ?? []) {
      if (!boss.active) continue;
      markers.push({ type: 'boss', x: boss.x, y: boss.y, color: '#ff5252', size: 4.5, priority: 9 });
    }
    for (const portal of this.mapInstance?.portalsInWorld ?? []) {
      markers.push({ type: 'portal', x: portal.x, y: portal.y, color: '#2ad4ff', size: 3.5, priority: 8 });
    }
    for (const drop of this.entities.itemDrops ?? []) {
      if (!drop.active) continue;
      const def = drop.itemDef ?? {};
      const isImportant = def.type === 'map_item' || def.type === 'skill_gem' || def.rarity === 'unique';
      if (!isImportant) continue;
      markers.push({ type: 'important-drop', x: drop.x, y: drop.y, color: def.color ?? '#ffd166', size: 2.5, priority: 5 });
    }
    for (const spot of this.hubWorld?._allInteractables?.() ?? []) {
      markers.push({ type: 'interactable', x: spot.x, y: spot.y, color: spot.color ?? '#9ec7ff', size: 3.5, priority: 6 });
    }
    return markers;
  }

  _buildMinimapRenderData() {
    if (this.minimapMode === 0 || !this.player) return null;
    const mode = this.minimapMode === 1 ? 'corner' : this.minimapMode === 3 ? 'mobile-joystick' : 'overlay';
    if (this.mapLayout && this._mapExplorationMask) {
      return {
        mode,
        source: 'map',
        playerX: this.player.x,
        playerY: this.player.y,
        worldLeft: this.mapLayout.worldLeft,
        worldTop: this.mapLayout.worldTop,
        cols: this.mapLayout.cols,
        rows: this.mapLayout.rows,
        tileSize: this.mapLayout.tileSize,
        tiles: this.mapLayout.tiles,
        exploredMask: this._mapExplorationMask,
        markers: this._collectMinimapMarkers(),
        mobileUi: !!this.mobileAssist?.enabled,
      };
    }
    if (this.hubWorld && this._hubExplorationMask) {
      return {
        mode,
        source: 'hub',
        playerX: this.player.x,
        playerY: this.player.y,
        worldLeft: -this.hubWorld.width / 2,
        worldTop: -this.hubWorld.height / 2,
        cols: this._hubExplorationCols,
        rows: this._hubExplorationRows,
        tileSize: this._hubExplorationCellSize,
        exploredMask: this._hubExplorationMask,
        markers: this._collectMinimapMarkers(),
        mobileUi: !!this.mobileAssist?.enabled,
      };
    }
    return null;
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
    this._applyPlayerTerrainEffects();
    if (this.input.wasPressed('KeyH')) this.cycleMinimapMode();
    this._handlePotionInput();

    // Player
    this.player.update(dt, this.input);
    this._applyPassiveTreeRuntimeEffects(dt);
    this._updatePotionState(dt);
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
      if (!proj.active) continue;
      proj.update(dt);
    }

    // XP gems
    for (const gem of this.entities.gems) {
      if (!gem.active) continue;
      gem.update(dt, this.player);
    }

    // Chaos Shard gems
    for (const shard of this.entities.shardGems) {
      if (!shard.active) continue;
      shard.update(dt, this.player);
    }

    // Gold gems
    for (const gold of this.entities.goldGems) {
      if (!gold.active) continue;
      gold.update(dt, this.player);
    }

    // Item drops (just animation + hover detection)
    for (const drop of this.entities.itemDrops) {
      if (!drop.active) continue;
      drop.update(dt);
    }
    this._updateHoveredDrop();
    this._updateHoveredWorldTarget();
    this._autoPickupNearbyDrops();
    this._revealMapExploration();

    // Collision
    this.collision.buildGrids(this.entities);
    this.collision.checkProjectilesVsWalls(this.entities, this.mapLayout);
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
        mana: this.player.mana,
        maxMana: this.player.maxMana,
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
        debugMode: this.debugMode,
        mapName: this.mapInstance?.mapDef?.name ?? '',
        mapAreaLevel: this.mapInstance?.areaLevel ?? 0,
        mapEncounterDebug: this.mapInstance?.encounterDebug ?? null,
        areaLevelTelemetry: this._areaLevelTelemetry,
        mapMods: this.mapInstance?.mods ?? [],
        potions: this._serializePotionHud(),
        minimapMode: this.minimapMode,
        training: this._serializeTrainingHud(),
        primarySkill:    this._serializePrimarySkill(),
        activeSkills:    this.activeSkillSystem.serialize(this.player),
        equipment: this._serializeEquipment(),
        inventory: this.player.inventory.serialize(),
        modifierDebug: summarizeActiveModifiers(this.player),
        bonusDebug: summarizeCharacterBonuses(this.player),
        lockedTarget: this._serializeLockedTargetHud(),
      });
      this._emitHoveredInspect();
    }
  }

  _serializeLockedTargetHud() {
    if (!this._isLockTargetValid(this._lockedTarget)) return null;
    return {
      name: this._lockedTarget.bossName ?? this._lockedTarget.name ?? 'Target',
      isBoss: !!this._lockedTarget.isBoss,
      health: Math.max(0, this._lockedTarget.health ?? 0),
      maxHealth: Math.max(1, this._lockedTarget.maxHealth ?? 1),
      healthPct: this._lockedTarget.maxHealth > 0
        ? Math.max(0, this._lockedTarget.health / this._lockedTarget.maxHealth)
        : 0,
    };
  }

  _applyPlayerTerrainEffects() {
    if (!this.player) return;
    if (!this.mapLayout?.terrainSpeedMultiplierAtTile || !this.mapLayout?.worldToTile) {
      this.player.terrainSpeedMult = 1;
      return;
    }
    const tile = this.mapLayout.worldToTile(this.player.x, this.player.y);
    const target = Math.max(0.88, Math.min(1.0, this.mapLayout.terrainSpeedMultiplierAtTile(tile.tx, tile.ty) ?? 1));
    // Smooth small terrain transitions so movement feel remains stable.
    this.player.terrainSpeedMult = (this.player.terrainSpeedMult ?? 1) * 0.65 + target * 0.35;
  }

  /**
   * Runtime passive effects that require per-tick simulation (auras / conditional keystones).
   */
  _applyPassiveTreeRuntimeEffects(dt) {
    if (!this.player || !this.entities) return;
    const allocated = this.player.allocatedNodes;
    if (!allocated || allocated.size === 0) return;

    // Permafrost keystone: nearby enemies are continuously chilled.
    if (allocated.has('fr_ks')) {
      const chillDef = {
        ...AILMENT_DEFS.Chill,
        duration: 0.4 * Math.max(0.1, this.player.skillDurationMult ?? 1),
      };
      for (const enemy of this.entities.getHostiles?.() ?? []) {
        if (!enemy?.active) continue;
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        if (dx * dx + dy * dy <= 300 * 300) {
          enemy.applyAilment('Chill', 1, chillDef);
        }
      }
    }

    // Consecration notable: radiant ground around player deals Holy DPS.
    if (allocated.has('hl_n1')) {
      const auraDps = 8 * Math.max(0.01, this.player.holyDamageMult ?? 1);
      const tickDamage = auraDps * dt;
      const pen = resolvePenetrationMap(['Holy'], this.player);
      for (const enemy of this.entities.getHostiles?.() ?? []) {
        if (!enemy?.active) continue;
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        if (dx * dx + dy * dy > 170 * 170) continue;
        enemy.takeDamage({ Holy: tickDamage }, ['Holy'], pen);
        if (!enemy.active) this.onEnemyKilled(enemy);
      }
    }

    // ── Warrior keystone: Pyre's Dominion ────────────────────────────────────
    // Every 2 seconds, explode in fire, damaging all enemies within 280 px.
    if (allocated.has('r5s00')) {
      this._keystoneTimers ??= {};
      this._keystoneTimers.pyreNova = (this._keystoneTimers.pyreNova ?? 2.0) - dt;
      if (this._keystoneTimers.pyreNova <= 0) {
        this._keystoneTimers.pyreNova += 2.0;
        const pen        = resolvePenetrationMap(['Blaze'], this.player);
        const novaDamage = 40 + (this.player.flatBlazeDamage ?? 0) * 0.5;
        for (const enemy of this.entities.getHostiles?.() ?? []) {
          if (!enemy?.active) continue;
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          if (dx * dx + dy * dy <= 280 * 280) {
            enemy.takeDamage({ Blaze: novaDamage }, ['Blaze'], pen);
            if (!enemy.active) this.onEnemyKilled(enemy);
          }
        }
        this.particles.emit?.('death', this.player.x, this.player.y, { color: '#e8722a' });
        // Keystone drawback: self-ignite — burns caster for 2% of max HP per nova.
        this.player.health = Math.max(1, this.player.health - this.player.maxHealth * 0.02);
      }
    }

    // ── Rogue keystone: Ghost Step ─────────────────────────────────────────
    // NOTE (E2P3): node IDs r5s00, r5s11, r5s21 were on the 32-slot grid.
    // They are intentionally absent from passiveTree.js until E2P8 rewires
    // keystone effects to new 36-slot IDs. has() returns false; no effect.
    // Move speed scales 0 → +40% as HP falls from 100% → 10%.
    if (allocated.has('r5s11')) {
      const hpRatio = Math.min(1, this.player.health / Math.max(1, this.player.maxHealth));
      const bonus   = 0.40 * Math.max(0, 1 - Math.max(0, hpRatio - 0.10) / 0.90);
      const prev    = this.player._ghostStepBonus ?? 0;
      this.player.moveSpeedMult = (this.player.moveSpeedMult ?? 0) + bonus - prev;
      this.player._ghostStepBonus = bonus;
    } else if ((this.player._ghostStepBonus ?? 0) !== 0) {
      // Ghost Step de-allocated — clean up dynamic bonus.
      this.player.moveSpeedMult = (this.player.moveSpeedMult ?? 0) - this.player._ghostStepBonus;
      this.player._ghostStepBonus = 0;
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
    const requirementState = evaluateSkillRequirements(skill, this.player);
    if (!requirementState.ok) return false;
    if (skill._timer < skill.cooldown) return false;
    const manaCost = this._resolveSkillManaCost(skill);
    if (!this.player.spendMana(manaCost)) return false;
    skill.fire(this.player, this.entities, this);
    skill._timer = 0;

    // ── Sage keystone: Overload ───────────────────────────────────────────
    // Every 5th primary skill cast triggers a free lightning nova.
    if (this.player.allocatedNodes?.has('r5s21')) {
      this._overloadCastCount = (this._overloadCastCount ?? 0) + 1;
      if (this._overloadCastCount >= 5) {
        this._overloadCastCount = 0;
        this._fireOverloadNova();
      }
    }

    return true;
  }

  /** @private Overload keystone: free lightning nova on every 5th primary cast. */
  _fireOverloadNova() {
    const player = this.player;
    if (!player || !this.entities) return;
    const pen        = resolvePenetrationMap(['Thunder'], player);
    const novaDamage = 55 + (player.flatThunderDamage ?? 0) * 0.5;
    for (const enemy of this.entities.getHostiles?.() ?? []) {
      if (!enemy?.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy <= 300 * 300) {
        enemy.takeDamage({ Thunder: novaDamage }, ['Thunder'], pen);
        if (!enemy.active) this.onEnemyKilled(enemy);
      }
    }
    this.particles.emit?.('death', player.x, player.y, { color: '#f0d050' });
  }

  /** @private Serialize the Space-bound primary skill for HUD rendering. */
  _serializePrimarySkill() {
    const s = this.player?.primarySkill;
    if (!s) return null;
    const remaining = Math.max(0, s.cooldown - s._timer);
    const computed = typeof s.computedStats === 'function' ? (s.computedStats(this.player) ?? {}) : {};
    const manaCost = this._resolveSkillManaCost(s, computed);
    const canAfford = this.player?.canSpendMana(manaCost) ?? true;
    const requirementState = evaluateSkillRequirements(s, this.player);
    const supportSlots = (s.supportSlots ?? []).map((sup) =>
      sup ? { id: sup.id, name: sup.name, icon: sup.icon ?? '◆' } : null
    );
    return {
      id: s.id,
      name: s.name,
      icon: s.icon ?? '␣',
      description: s.description ?? '',
      tags: s.tags ?? [],
      castTime: s.castTime ?? 0,
      cooldown: s.cooldown,
      remaining: parseFloat(remaining.toFixed(1)),
      ready: remaining <= 0 && canAfford && requirementState.ok,
      casting: 0,
      isPrimary: true,
      manaCost,
      canAfford,
      blocked: !requirementState.ok,
      blockedReason: requirementState.blockedReason,
      requirementHint: requirementState.requirementHint,
      requiresWeaponType: requirementState.requiresWeaponType,
      openSlots: this._openSupportSlots(s),
      supportSlots,
      level: s.level ?? 1,
      maxLevel: s.maxLevel ?? 20,
      computedDamage: Number.isFinite(computed.damage) ? computed.damage : null,
      damageBreakdown: computed.damageBreakdown ?? null,
      damageRange: computed.damageRange ?? null,
    };
  }

  _resolveSkillManaCost(skill, precomputed = null) {
    if (!skill) return 0;
    const computed = precomputed ?? (typeof skill.computedStats === 'function' ? (skill.computedStats(this.player) ?? {}) : {});
    const supportMult = Math.max(0.1, computed.manaCostMult ?? 1);
    const baseCost = Math.max(
      0,
      Math.round(
        computed.manaCost
        ?? skill.manaCost
        ?? (skill.castTime || skill.cooldown ? (3 + (skill.cooldown ?? 0) * 1.2 + (skill.castTime ?? 0) * 6) : 0),
      ),
    );
    const mult = Math.max(0.1, this.player?.manaCostMult ?? 1) * supportMult;
    return Math.max(0, Math.round(baseCost * mult));
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
    for (const gem of this.entities.gems) {
      if (!gem.active) continue;
      gem.draw(this.renderer);
    }
    for (const shard of this.entities.shardGems) {
      if (!shard.active) continue;
      shard.draw(this.renderer);
    }
    for (const gold of this.entities.goldGems) {
      if (!gold.active) continue;
      gold.draw(this.renderer);
    }
    for (const drop of this.entities.itemDrops) {
      if (!drop.active) continue;
      drop.draw(this.renderer);
    }
    for (const zone   of this.entities.aoeZones)    zone.draw(this.renderer);
    for (const proj   of this.entities.projectiles) if (proj.active) proj.draw(this.renderer);
    for (const enemy  of this.entities.enemies)     enemy.draw(this.renderer);
    for (const boss   of this.entities.bosses)      boss.draw(this.renderer);
    this._drawHoveredWorldHighlight();
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
      this.activeSkillSystem?.draw?.(this.renderer, this.player);
    }

    // Particles draw above all game entities.
    this.particles.draw(this.renderer);

    const minimapData = this._buildMinimapRenderData();
    if (minimapData) {
      this.renderer.drawMinimap(minimapData);
    }

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
    if (enemy?.isTrainingDummy) {
      enemy.active = true;
      enemy.health = enemy.maxHealth;
      return;
    }
    this.kills++;
    const lifeOnKill = Math.max(0, this.player?.lifeOnKillFlat ?? 0);
    const manaOnKill = Math.max(0, this.player?.manaOnKillFlat ?? 0);
    const goldDropMult = Math.max(0.01, this.player?.goldDropMult ?? 1);
    if (lifeOnKill > 0) this.player.heal(lifeOnKill);
    if (manaOnKill > 0) this.player.mana = Math.min(this.player.maxMana, (this.player.mana ?? 0) + manaOnKill);
    this._recordAreaLevelKillTelemetry();
    if (this.mapInstance) {
      this.mapInstance.enemiesKilled = (this.mapInstance.enemiesKilled ?? 0) + 1;
    }

    const mapSource = this.mapInstance?.mapDef?.source ?? null;
    const inCampaignMap = !!this.mapInstance && mapSource !== 'map_item';
    const inInstanceMap = !!this.mapInstance && mapSource === 'map_item';

    if (enemy.isBoss) {
      this._grantPotionCharges(POTION_TUNING.killGainBoss);
    } else if (enemy.isChampion) {
      this._grantPotionCharges(POTION_TUNING.killGainChampion);
    } else {
      this._grantPotionCharges(POTION_TUNING.killGainNormal);
    }

    const potionDrop = this._rollPotionDropOnKill(enemy);
    if (potionDrop) {
      this.entities.itemDrops.push(new ItemDrop(enemy.x, enemy.y, potionDrop));
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
      const itemDef = generateItem(baseDef, 'unique', {
        itemLevel: this.mapInstance?.areaLevel ?? this.player?.level ?? 1,
      });
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
      const areaLevel = Math.max(1, this.mapInstance?.areaLevel ?? 1);
      const mapId = this.mapInstance?.mapDef?.id ?? '';
      const isActOneMap = areaLevel <= 12 || mapId.startsWith('act1_');
      const areaBonus = Math.floor(areaLevel / 12);
      const bossGoldPiles = 8 + areaBonus + (isActOneMap ? 2 : 0);
      const baseBossGold = 3 + Math.floor(areaLevel / 18) + (isActOneMap ? 1 : 0);
      for (let i = 0; i < bossGoldPiles; i++) {
        const angle = (i / bossGoldPiles) * Math.PI * 2;
        const radius = 34 + (i % 3) * 10;
        const rawValue = baseBossGold + Math.floor(Math.random() * 3);
        const value = Math.max(1, Math.round(rawValue * goldDropMult));
        this.entities.addGoldGem(new GoldGem(
          enemy.x + Math.cos(angle) * radius,
          enemy.y + Math.sin(angle) * radius,
          value,
        ));
      }

      if ((inCampaignMap || inInstanceMap) && Math.random() < SCALING_CONFIG.mapDrop.bossDropFloor) {
        const mapItem = createMapItemDrop({
          playerLevel: this.player?.level ?? 1,
          isChampion: true,
          dropContext: inCampaignMap ? 'campaign' : 'instance',
          areaLevel: this.mapInstance?.areaLevel ?? this.player?.level ?? 1,
          sourceMapItemLevel: this.mapInstance?.sourceMapItemLevel ?? this.mapInstance?.areaLevel ?? 1,
          badLuckState: inInstanceMap ? this._mapDropBadLuckState : null,
        });
        this.entities.itemDrops.push(new ItemDrop(enemy.x, enemy.y, mapItem));
      }

      this.state = 'MAP_COMPLETE';
      if (this.onMapComplete) {
        this.onMapComplete({
          mapId: this.mapInstance?.mapDef?.id ?? 'unknown',
          mapName: this.mapInstance?.mapDef?.name ?? 'Unknown Map',
          areaLevel: this.mapInstance?.areaLevel ?? 1,
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

    // Gold drops are intentionally common and scale by area level.
    const areaLevel = Math.max(1, this.mapInstance?.areaLevel ?? 1);
    const mapId = this.mapInstance?.mapDef?.id ?? '';
    const isActOneMap = areaLevel <= 12 || mapId.startsWith('act1_');
    const goldChance = enemy.isChampion
      ? 1.0
      : Math.min(0.96, 0.70 + Math.max(0, areaLevel - 11) * 0.003 + (isActOneMap ? 0.14 : 0));
    if (Math.random() < goldChance) {
      const areaBonus = Math.floor((areaLevel - 1) / 12);
      const baseValue = enemy.isChampion
        ? (3 + areaBonus * 2) + Math.floor(Math.random() * (4 + Math.floor(areaLevel / 20)))
        : (1 + areaBonus) + (Math.random() < (0.25 + Math.min(0.25, areaLevel * 0.003)) ? 1 : 0);
      const value = Math.max(1, Math.round((baseValue + (isActOneMap ? (enemy.isChampion ? 2 : 1) : 0)) * goldDropMult));
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
      const itemDef   = generateItem(baseDef, rarity, {
        itemLevel: this.mapInstance?.areaLevel ?? this.player?.level ?? 1,
      });
      const drop = new ItemDrop(enemy.x, enemy.y, itemDef);
      this.entities.itemDrops.push(drop);
    }

    // Phase 4 map-item drops in both campaign and endgame instances.
    if (inCampaignMap || inInstanceMap) {
      const mapDropChance = enemy.isChampion
        ? SCALING_CONFIG.mapDrop.championKillDropChance
        : SCALING_CONFIG.mapDrop.normalKillDropChance;
      if (Math.random() < mapDropChance) {
        const mapItem = createMapItemDrop({
          playerLevel: this.player?.level ?? 1,
          isChampion: !!enemy.isChampion,
          dropContext: inCampaignMap ? 'campaign' : 'instance',
          areaLevel: this.mapInstance?.areaLevel ?? this.player?.level ?? 1,
          sourceMapItemLevel: this.mapInstance?.sourceMapItemLevel ?? this.mapInstance?.areaLevel ?? 1,
          badLuckState: inInstanceMap ? this._mapDropBadLuckState : null,
        });
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
    const itemDef = generateItem(baseDef, 'magic', {
      itemLevel: this.player?.level ?? 1,
    });
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
    if (enemy?.isTrainingDummy) {
      this._recordTrainingDamage(damage);
    }
    this.audio.play('hit');
  }

  /** Called by a skill when it fires (triggers audio). */
  onSkillFire() {
    this.audio.play('fire');
  }

  /** Called by CollisionSystem when the player is hit by an enemy. */
  onPlayerHit(damage = 0) {
    this._recordAreaLevelDamageTakenTelemetry(damage);
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
    this._updateHoveredWorldTarget();
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

  _clearHoveredInspectTarget() {
    this._hoverInspectTarget = null;
    this._emitHoveredInspect(null, true);
  }

  _getMouseWorldPosition() {
    return {
      x: this._mouseScreenX + this.renderer.camX,
      y: this._mouseScreenY + this.renderer.camY,
    };
  }

  _updateHoveredWorldTarget() {
    const next = this._pickHoveredWorldTarget();
    const prev = this._hoverInspectTarget;
    const changed = !prev
      || !next
      || prev.kind !== next.kind
      || prev.ref !== next.ref
      || prev.id !== next.id;
    this._hoverInspectTarget = next;
    if (changed) this._emitHoveredInspect();
  }

  _pickHoveredWorldTarget() {
    const mouse = this._getMouseWorldPosition();
    const hostile = this._findHoveredHostile(mouse.x, mouse.y);
    if (hostile) return hostile;

    if (this._hoveredDrop?.active) {
      return { kind: 'drop', id: this._hoveredDrop.itemDef?.uid ?? 'drop', ref: this._hoveredDrop };
    }

    if (this.hubWorld) {
      const hub = this._findHoveredHubInteractable(mouse.x, mouse.y);
      if (hub) return hub;
    }

    const portal = this._findHoveredPortal(mouse.x, mouse.y);
    if (portal) return portal;

    const setpiece = this._findHoveredSetpieceNode(mouse.x, mouse.y);
    if (setpiece) return setpiece;

    const obstacle = this._findHoveredMapObstacle(mouse.x, mouse.y);
    if (obstacle) return obstacle;

    if (this.debugMode) {
      const terrain = this._findHoveredTerrainTile(mouse.x, mouse.y);
      if (terrain) return terrain;
    }

    return null;
  }

  _findHoveredHostile(mouseWorldX, mouseWorldY) {
    let nearest = null;
    let nearestScore = Infinity;
    for (const hostile of this.entities.getHostiles()) {
      const r = (hostile.radius ?? 14) + HOVER_HOSTILE_EXTRA_RADIUS;
      const dx = hostile.x - mouseWorldX;
      const dy = hostile.y - mouseWorldY;
      const dSq = dx * dx + dy * dy;
      if (dSq > r * r) continue;
      const edgeSq = Math.abs(Math.sqrt(dSq) - (hostile.radius ?? 14));
      if (edgeSq < nearestScore) {
        nearestScore = edgeSq;
        nearest = hostile;
      }
    }
    if (!nearest) return null;
    return {
      kind: nearest.isTrainingDummy ? 'training_dummy' : (nearest.isBoss ? 'boss' : 'enemy'),
      id: nearest.uid ?? nearest.bossName ?? nearest.type ?? 'enemy',
      ref: nearest,
    };
  }

  _findHoveredHubInteractable(mouseWorldX, mouseWorldY) {
    const spots = [
      ...(this.hubWorld?.interactables ?? []),
      ...(this.hubWorld?.mapPortal ? [this.hubWorld.mapPortal] : []),
    ];
    let nearest = null;
    let nearestSq = Infinity;
    for (const spot of spots) {
      const r = (spot.radius ?? 64) + HOVER_INTERACTABLE_EXTRA_RADIUS;
      const dx = spot.x - mouseWorldX;
      const dy = spot.y - mouseWorldY;
      const dSq = dx * dx + dy * dy;
      if (dSq > r * r || dSq >= nearestSq) continue;
      nearest = spot;
      nearestSq = dSq;
    }
    if (!nearest) return null;
    return {
      kind: 'hub_interactable',
      id: nearest.id ?? 'hub_interactable',
      ref: nearest,
    };
  }

  _findHoveredPortal(mouseWorldX, mouseWorldY) {
    const portals = this.mapInstance?.portalsInWorld ?? [];
    let nearest = null;
    let nearestSq = Infinity;
    for (const portal of portals) {
      const r = (portal.radius ?? 16) + 24;
      const dx = portal.x - mouseWorldX;
      const dy = portal.y - mouseWorldY;
      const dSq = dx * dx + dy * dy;
      if (dSq > r * r || dSq >= nearestSq) continue;
      nearest = portal;
      nearestSq = dSq;
    }
    if (!nearest) return null;
    return { kind: 'portal', id: nearest.type ?? 'portal', ref: nearest };
  }

  _findHoveredMapObstacle(mouseWorldX, mouseWorldY) {
    const map = this.mapLayout;
    if (!map?.obstacles?.length || !map.tileToWorld) return null;
    let nearest = null;
    let nearestSq = Infinity;
    for (const obstacle of map.obstacles) {
      const world = map.tileToWorld(obstacle.centerX, obstacle.centerY);
      const radius = Math.max(14, map.tileSize * (obstacle.radiusTiles ?? 0.45) + 14);
      const dx = world.x - mouseWorldX;
      const dy = world.y - mouseWorldY;
      const dSq = dx * dx + dy * dy;
      if (dSq > radius * radius || dSq >= nearestSq) continue;
      nearest = { obstacle, world, radius };
      nearestSq = dSq;
    }
    if (!nearest) return null;
    return {
      kind: 'map_obstacle',
      id: nearest.obstacle.id ?? `${nearest.obstacle.type ?? 'obstacle'}`,
      ref: nearest.obstacle,
      world: nearest.world,
      radius: nearest.radius,
    };
  }

  _findHoveredSetpieceNode(mouseWorldX, mouseWorldY) {
    const map = this.mapLayout;
    const nodes = map?.encounterMetadata?.setpieceNodes ?? [];
    if (!nodes.length || !map.tileToWorld) return null;

    let nearest = null;
    let nearestSq = Infinity;
    for (const node of nodes) {
      const world = map.tileToWorld(node.centerTile.tx, node.centerTile.ty);
      const radius = Math.max(16, map.tileSize * 0.8);
      const dx = world.x - mouseWorldX;
      const dy = world.y - mouseWorldY;
      const dSq = dx * dx + dy * dy;
      if (dSq > radius * radius || dSq >= nearestSq) continue;
      nearest = { node, world, radius };
      nearestSq = dSq;
    }
    if (!nearest) return null;
    return {
      kind: 'setpiece',
      id: nearest.node.id ?? nearest.node.type ?? 'setpiece',
      ref: nearest.node,
      world: nearest.world,
      radius: nearest.radius,
    };
  }

  _findHoveredTerrainTile(mouseWorldX, mouseWorldY) {
    const map = this.mapLayout;
    if (!map?.worldToTile || !map?.tileToWorld) return null;
    const tile = map.worldToTile(mouseWorldX, mouseWorldY);
    if (tile.tx < 0 || tile.ty < 0 || tile.tx >= map.cols || tile.ty >= map.rows) return null;
    const world = map.tileToWorld(tile.tx, tile.ty);
    return {
      kind: 'terrain',
      id: `${tile.tx}:${tile.ty}`,
      ref: {
        tile,
        terrainType: map.terrainTypeAtTile?.(tile.tx, tile.ty) ?? null,
        terrainCode: map.terrainCodeAtTile?.(tile.tx, tile.ty) ?? 0,
        speedMult: map.terrainSpeedMultiplierAtTile?.(tile.tx, tile.ty) ?? 1,
        wall: map.isWall?.(tile.tx, tile.ty) ?? false,
      },
      world,
      radius: Math.max(14, map.tileSize * 0.45),
    };
  }

  _formatLabelFromId(id) {
    if (!id) return 'Unknown';
    return String(id)
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  _emitHoveredInspect(forceTarget = undefined, force = false) {
    if (!this.onHoverInspectChange) return;
    const target = forceTarget === undefined ? this._hoverInspectTarget : forceTarget;
    const payload = target ? this._serializeHoveredInspectTarget(target) : null;
    const hash = payload ? JSON.stringify(payload) : '';
    if (force || hash !== this._hoverInspectHash) {
      this._hoverInspectHash = hash;
      this.onHoverInspectChange(payload);
    }
  }

  _serializeHoveredInspectTarget(target) {
    const round = (v) => Number.isFinite(v) ? Math.round(v) : 0;
    const round2 = (v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;

    if (target.kind === 'drop') {
      const d = target.ref?.itemDef ?? {};
      return {
        kind: 'drop',
        name: d.name ?? 'Item Drop',
        subtitle: this._formatLabelFromId(d.rarity ?? d.type ?? 'item'),
        details: [
          { label: 'Type', value: this._formatLabelFromId(d.type ?? 'item') },
          { label: 'Rarity', value: this._formatLabelFromId(d.rarity ?? 'normal') },
          { label: 'Size', value: `${d.gridW ?? 1} x ${d.gridH ?? 1}` },
        ],
        debugDetails: [
          { label: 'UID', value: d.uid ?? 'n/a' },
          { label: 'Slot', value: d.slot ?? 'n/a' },
          { label: 'Area Level', value: d.mapItemLevel ?? 'n/a' },
        ],
      };
    }

    if (target.kind === 'enemy' || target.kind === 'boss' || target.kind === 'training_dummy') {
      const e = target.ref;
      return {
        kind: target.kind,
        name: e.bossName ?? this._formatLabelFromId(e.type ?? (e.isTrainingDummy ? 'training_dummy' : 'enemy')),
        subtitle: target.kind === 'boss' ? 'Boss' : (target.kind === 'training_dummy' ? 'Practice Target' : 'Enemy'),
        health: {
          current: e.health ?? 0,
          max: e.maxHealth ?? 1,
        },
        details: [
          { label: 'Level Context', value: this.mapInstance?.areaLevel ?? this.player?.level ?? 1 },
          { label: 'Threat', value: e.isBoss ? 'Boss' : (e.isChampion ? 'Champion' : 'Normal') },
          { label: 'State', value: e.aiState ?? (e.isWarning ? 'warning' : 'active') },
        ],
        debugDetails: [
          { label: 'Entity Type', value: e.type ?? 'unknown' },
          { label: 'Position', value: `${round(e.x)}, ${round(e.y)}` },
          { label: 'Radius', value: round2(e.radius ?? 0) },
          { label: 'Aggro Source', value: e.aggroSource ?? 'n/a' },
          { label: 'Move Speed', value: round2(e.speed ?? 0) },
          { label: 'Frozen Timer', value: round2(e.frozenTimer ?? 0) },
        ],
      };
    }

    if (target.kind === 'hub_interactable') {
      const spot = target.ref;
      return {
        kind: 'hub_interactable',
        name: spot.label ?? this._formatLabelFromId(spot.id ?? 'Interactable'),
        subtitle: 'Hub Interactable',
        details: [
          { label: 'Action', value: spot.id === 'map_portal' ? 'Enter' : 'Open' },
          { label: 'Hotkey', value: spot.key ?? 'F' },
        ],
        debugDetails: [
          { label: 'ID', value: spot.id ?? 'n/a' },
          { label: 'Position', value: `${round(spot.x)}, ${round(spot.y)}` },
          { label: 'Radius', value: round2(spot.radius ?? 0) },
        ],
      };
    }

    if (target.kind === 'portal') {
      const portal = target.ref;
      return {
        kind: 'portal',
        name: portal.type === 'entry' ? 'Map Portal' : 'Inactive Portal',
        subtitle: 'Portal',
        details: [
          { label: 'State', value: portal.type ?? 'entry' },
          { label: 'Portals Left', value: this.mapInstance?.portalsRemaining ?? 0 },
        ],
        debugDetails: [
          { label: 'Position', value: `${round(portal.x)}, ${round(portal.y)}` },
          { label: 'Radius', value: round2(portal.radius ?? 0) },
          { label: 'Map', value: this.mapInstance?.mapDef?.name ?? 'n/a' },
        ],
      };
    }

    if (target.kind === 'map_obstacle') {
      const obstacle = target.ref;
      const center = target.world ?? this.mapLayout?.tileToWorld?.(obstacle.centerX, obstacle.centerY) ?? { x: 0, y: 0 };
      return {
        kind: 'map_obstacle',
        name: this._formatLabelFromId(obstacle.type ?? 'obstacle'),
        subtitle: 'Map Object',
        details: [
          { label: 'Category', value: this._formatLabelFromId(obstacle.category ?? 'object') },
          { label: 'Collision', value: obstacle.collision ? 'Yes' : 'No' },
          { label: 'LOS Blocker', value: obstacle.blocksLineOfSight ? 'Yes' : 'No' },
        ],
        debugDetails: [
          { label: 'Obstacle ID', value: obstacle.id ?? 'n/a' },
          { label: 'Room ID', value: obstacle.roomId ?? 'n/a' },
          { label: 'Center Tile', value: `${round2(obstacle.centerX ?? 0)}, ${round2(obstacle.centerY ?? 0)}` },
          { label: 'Center World', value: `${round(center.x)}, ${round(center.y)}` },
          { label: 'Footprint', value: obstacle.footprintType ?? 'single_tile' },
        ],
      };
    }

    if (target.kind === 'setpiece') {
      const node = target.ref;
      const center = target.world ?? this.mapLayout?.tileToWorld?.(node.centerTile?.tx ?? 0, node.centerTile?.ty ?? 0) ?? { x: 0, y: 0 };
      return {
        kind: 'setpiece',
        name: this._formatLabelFromId(node.type ?? 'setpiece'),
        subtitle: 'Encounter Setpiece',
        details: [
          { label: 'Stage', value: this._formatLabelFromId(node.stage ?? 'mid') },
          { label: 'Room Type', value: this._formatLabelFromId(node.roomType ?? 'combat') },
          { label: 'Tags', value: node.tags ?? [] },
        ],
        debugDetails: [
          { label: 'Setpiece ID', value: node.id ?? 'n/a' },
          { label: 'Room ID', value: node.roomId ?? 'n/a' },
          { label: 'Center Tile', value: `${node.centerTile?.tx ?? 0}, ${node.centerTile?.ty ?? 0}` },
          { label: 'Center World', value: `${round(center.x)}, ${round(center.y)}` },
        ],
      };
    }

    if (target.kind === 'terrain') {
      const terrain = target.ref;
      return {
        kind: 'terrain',
        name: terrain.wall ? 'Wall Tile' : this._formatLabelFromId(terrain.terrainType ?? 'floor'),
        subtitle: 'Terrain',
        details: [
          { label: 'Tile', value: `${terrain.tile.tx}, ${terrain.tile.ty}` },
          { label: 'Walkable', value: terrain.wall ? 'No' : 'Yes' },
          { label: 'Speed Mult', value: round2(terrain.speedMult ?? 1) },
        ],
        debugDetails: [
          { label: 'Terrain Code', value: terrain.terrainCode ?? 0 },
          { label: 'World', value: `${round(target.world?.x ?? 0)}, ${round(target.world?.y ?? 0)}` },
          { label: 'Map Family', value: this.mapLayout?.layoutFamily ?? 'n/a' },
        ],
      };
    }

    return {
      kind: 'unknown',
      name: 'Unknown Target',
      subtitle: 'Unknown',
      details: [],
      debugDetails: [],
    };
  }

  _drawHoveredWorldHighlight() {
    const target = this._hoverInspectTarget;
    if (!target) return;

    if (target.kind === 'enemy' || target.kind === 'boss' || target.kind === 'training_dummy') {
      const e = target.ref;
      const color = target.kind === 'boss' ? '#ff6b3a' : '#ff4444';
      const radius = (e.radius ?? 14) + 4;
      this.renderer.drawHoverHighlight(e.x, e.y, radius, color, 0.27, target.kind === 'boss' ? 3 : 2);
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
      explicitAffixes: d.explicitAffixes ?? [],
      implicitAffixes: d.implicitAffixes ?? [],
      description: d.description,
      affixes:     d.affixes ?? [],
      gridW:       d.gridW,
      gridH:       d.gridH,
      isUnique:    d.isUnique ?? false,
      flavorText:  d.flavorText ?? null,
      baseStats:   d.baseStats ?? d.stats ?? {},
      defenseType: d.defenseType ?? null,
      weaponType: d.weaponType ?? null,
      handedness: d.handedness ?? null,
      type: d.type,
      mapTheme: d.mapTheme,
      mapMods: d.mapMods ?? [],
      mapItemLevel: d.mapItemLevel,
    };
  }

  /** @private Only small items are eligible for mobile auto-loot assist. */
  _shouldAutoPickupDrop(drop) {
    const item = drop?.itemDef;
    if (!item) return false;
    if (item.type === 'skill_gem' || item.type === 'support_gem' || item.type === 'map_item' || item.type === 'potion') return true;
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
      const placed = drop.itemDef?.type === 'potion'
        ? this._tryAutoSlotPotion(drop.itemDef) || this.player.inventory.autoPlace(drop.itemDef)
        : this.player.inventory.autoPlace(drop.itemDef);
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
    const placed = itemDef?.type === 'potion'
      ? this._tryAutoSlotPotion(itemDef) || this.player.inventory.autoPlace(itemDef)
      : this.player.inventory.autoPlace(itemDef);
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
    if (itemDef.type === 'potion') {
      const slotted = this._tryAutoSlotPotion(itemDef);
      if (!slotted) {
        this.player.inventory.autoPlace(itemDef);
      }
      this._flushHudUpdate();
      return null;
    }
    const targetSlot = preferredSlot ?? this.player._resolveEquipSlot(itemDef);
    if (!this.player.canEquip(itemDef, targetSlot)) {
      this.player.inventory.autoPlace(itemDef);
      this._flushHudUpdate();
      return null;
    }
    const displaced = this.player.equip(itemDef, preferredSlot);
    this._flushHudUpdate();
    return displaced; // null = slot was empty; def = slot was occupied, goes to cursor
  }

  canEquipItemInSlot(itemDef, slot) {
    if (!this.player || !itemDef || !slot) return false;
    const normalized = normalizeWeaponItem(itemDef, { enforceWeaponDimensions: false });
    return canEquipItemInSlot(normalized, slot, this.player.equipment);
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
      mana:      this.player.mana,
      maxMana:   this.player.maxMana,
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
      debugMode: this.debugMode,
      mapName: this.mapInstance?.mapDef?.name ?? '',
      mapAreaLevel: this.mapInstance?.areaLevel ?? 0,
      mapEncounterDebug: this.mapInstance?.encounterDebug ?? null,
      areaLevelTelemetry: this._areaLevelTelemetry,
      mapMods: this.mapInstance?.mods ?? [],
      potions: this._serializePotionHud(),
      minimapMode: this.minimapMode,
      equipment: this._serializeEquipment(),
      inventory: this.player.inventory.serialize(),
      training: this._serializeTrainingHud(),
      primarySkill:    this._serializePrimarySkill(),
      activeSkills:    this.activeSkillSystem.serialize(this.player),
      modifierDebug: summarizeActiveModifiers(this.player),
      bonusDebug: summarizeCharacterBonuses(this.player),
      lockedTarget: this._serializeLockedTargetHud(),
    });
    this._emitHoveredInspect();
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
    if (player.allocatedNodes.has(nodeId)) return false;

    const node = TREE_NODE_MAP[nodeId];
    if (!node) return false;

    // Cost scales with ring depth; hub/start/inner-ring rules enforced in nodePointCost.
    const cost = GameEngine.nodePointCost(node);
    if (player.skillPoints < cost) return false;

    // Must be adjacent to at least one already-allocated node.
    const adjacent = node.connections.some((id) => player.allocatedNodes.has(id));
    if (!adjacent) return false;

    player.skillPoints -= cost;
    player.allocatedNodes.add(nodeId);
    const snapshot = applyStats(player, node.stats, {
      id: `passive:${nodeId}`,
      kind: node.type === 'keystone' ? 'keystone' : 'passiveTree',
      label: node.label ?? node.name ?? nodeId,
    });
    player.nodeSnapshots.set(nodeId, snapshot);

    this.audio.play('level_up');
    this.particles.emit('level_up', player.x, player.y);
    this._flushHudUpdate();
    return true;
  }

  /**
   * Refund cost per node type (gold). Legacy table kept for reference.
   * Hub and start nodes are never refundable.
   */
  static REFUND_COST = {
    minor:    25,
    notable:  50,
    mastery:  75,
    keystone: 100,
  };

  /**
   * Passive points required to allocate a node.
   * - hub / start: 0 (free, permanent)
   * - r0–r2 minor: 5 pts (foundational inner ring cost)
   * - r3+:  ring − 2 pts  (r3=1, r4=2, … r15=13)
   */
  static nodePointCost(node) {
    if (!node || node.type === 'hub' || node.type === 'start') return 0;
    return node.ring <= 2 ? 5 : Math.max(1, node.ring - 2);
  }

  /**
   * Gold required to right-click-refund a node.
   * - hub / start: n/a (cannot refund)
   * - r0–r2 minor: 0g (only passive points are at stake)
   * - r3+:  25 × (ring − 2) gold  (r3=25g, r4=50g, … r15=325g)
   */
  static nodeGoldCost(node) {
    if (!node || node.type === 'hub' || node.type === 'start') return 0;
    return node.ring <= 2 ? 0 : 25 * Math.max(1, node.ring - 2);
  }

  /**
   * Checks whether removing `nodeId` from the allocated set would disconnect
   * any other allocated node from the hub (BFS connectivity check).
   * @param {Set<string>} allocated
   * @param {string} nodeId
   * @returns {boolean} true if the refund is safe
   */
  _refundConnectivityOk(allocated, nodeId) {
    const remaining = new Set(allocated);
    remaining.delete(nodeId);
    if (remaining.size === 0) return true;

    // Root BFS from all permanent nodes (hub + start types) still in remaining.
    // Hub may not be allocated, so we can't assume it's the root.
    const roots = [...remaining].filter(id => {
      const n = TREE_NODE_MAP[id];
      return n && (n.type === 'hub' || n.type === 'start');
    });
    if (roots.length === 0) return true;

    const visited = new Set(roots);
    const queue   = [...roots];
    while (queue.length) {
      const cur  = queue.shift();
      const node = TREE_NODE_MAP[cur];
      if (!node) continue;
      for (const conn of node.connections) {
        if (remaining.has(conn) && !visited.has(conn)) {
          visited.add(conn);
          queue.push(conn);
        }
      }
    }
    for (const id of remaining) {
      if (!visited.has(id)) return false;
    }
    return true;
  }

  /**
   * Refund an allocated passive node, returning the skill point and reversing
   * its stat effects. Costs gold; only allowed between runs (state === 'HUB').
   * Hub and start nodes cannot be refunded.
   * @param {string} nodeId
   * @returns {boolean} true if the refund succeeded
   */
  refundNode(nodeId) {
    const { player } = this;
    if (!player) return false;

    const node = TREE_NODE_MAP[nodeId];
    if (!node) return false;
    if (node.type === 'hub' || node.type === 'start') return false;
    if (!player.allocatedNodes.has(nodeId)) return false;

    // Gold cost to refund scales with ring depth; inner rings (r0–r2) are free in gold.
    const refundGoldCost = GameEngine.nodeGoldCost(node);
    if (player.gold < refundGoldCost) return false;

    if (!this._refundConnectivityOk(player.allocatedNodes, nodeId)) return false;

    // Reverse stat effects using the stored snapshot
    const snapshot = player.nodeSnapshots.get(nodeId);
    if (snapshot) removeStats(player, snapshot);

    player.gold -= refundGoldCost;
    player.allocatedNodes.delete(nodeId);
    player.nodeSnapshots.delete(nodeId);
    // Restore the same number of points that were originally spent.
    player.skillPoints += GameEngine.nodePointCost(node);

    this._flushHudUpdate();
    return true;
  }

  /**
   * Refund ALL allocated nodes (complete respec). Costs the sum of all individually
   * refundable nodes. Hub and start-type nodes are kept; points are fully restored.
   * Only available at hub between runs (same guard as refundNode).
   * @returns {{ success: boolean, totalCost: number }}
   */
  refundAll() {
    const { player } = this;
    if (!player) return { success: false, totalCost: 0 };

    // Collect refundable nodes (not hub/start type)
    const refundable = [...player.allocatedNodes].filter(id => {
      const n = TREE_NODE_MAP[id];
      return n && n.type !== 'hub' && n.type !== 'start';
    });

    // Bulk respec is free — no gold cost; restores full point cost per node (ring-scaled + inner-ring rules).
    for (const id of refundable) {
      const n = TREE_NODE_MAP[id];
      const snapshot = player.nodeSnapshots.get(id);
      if (snapshot) removeStats(player, snapshot);
      player.allocatedNodes.delete(id);
      player.nodeSnapshots.delete(id);
      player.skillPoints += GameEngine.nodePointCost(n);
    }

    this._flushHudUpdate();
    return { success: true, totalCost: 0 };
  }

  /**
   * Calculate the total gold cost to refund all currently allocated non-permanent nodes.
   * Used by the UI to show the Refund All button cost before the user commits.
   */
  refundAllCost() {
    const { player } = this;
    if (!player) return 0;
    return [...player.allocatedNodes].reduce((sum, id) => {
      const n = TREE_NODE_MAP[id];
      if (!n || n.type === 'hub' || n.type === 'start') return sum;
      return sum + (GameEngine.REFUND_COST[n.type] ?? 25);
    }, 0);
  }

  /**
   * Socket a support gem (by inventory uid) into a skill's support slot.
   * The gem item is removed from inventory and a live support instance is placed.
   */
  _openSupportSlots(skill) {
    return openSupportSlotsForSkill(skill);
  }

  _unsocketAllSupports(skill) {
    if (!Array.isArray(skill?.supportSlots)) return;
    for (let i = 0; i < skill.supportSlots.length; i++) {
      const sup = skill.supportSlots[i];
      if (!sup?._itemDef) {
        skill.supportSlots[i] = null;
        continue;
      }
      const placed = this.player.inventory.autoPlace(sup._itemDef);
      if (!placed) this.dropItemToWorld(sup._itemDef);
      skill.supportSlots[i] = null;
    }
  }

  _removeEquippedSkillAtSlot(slotIndex) {
    const current = this.activeSkillSystem.slots?.[slotIndex] ?? null;
    if (!current) return;
    this._unsocketAllSupports(current);
    if (current._isPureSkill) {
      this.player.pureSkills = (this.player.pureSkills ?? []).filter((s) => s !== current);
    } else {
      this.player.autoSkills = (this.player.autoSkills ?? []).filter((w) => w !== current);
    }
    this.activeSkillSystem.unequip(slotIndex);
  }

  _setSkillProgress(skill, level = 1, xp = 0) {
    if (!skill) return;
    const targetLevel = Math.max(1, Math.min(skill.maxLevel ?? 20, Math.floor(level ?? 1)));
    skill.level = 1;
    skill._xp = 0;
    while ((skill.level ?? 1) < targetLevel) {
      skill.levelUp?.();
      if ((skill.level ?? 1) >= targetLevel) break;
      // Safety fallback if a levelUp implementation fails to increment.
      if ((skill.level ?? 1) < targetLevel) skill.level = (skill.level ?? 1) + 1;
    }
    skill._xp = Math.max(0, Math.floor(xp ?? 0));
    if ((skill.level ?? 1) >= (skill.maxLevel ?? 20)) skill._xp = 0;
  }

  _slotIndexFromSkillSlotKey(slotKey) {
    if (slotKey === 'q') return 0;
    if (slotKey === 'e') return 1;
    if (slotKey === 'r') return 2;
    return -1;
  }

  _isSkillIdEquippedAnywhere(skillId, excludeSlotKey = null) {
    if (!skillId) return false;
    if (excludeSlotKey !== 'primary' && this.player?.primarySkill?.id === skillId) return true;
    for (let i = 0; i < 3; i++) {
      const key = i === 0 ? 'q' : (i === 1 ? 'e' : 'r');
      if (excludeSlotKey === key) continue;
      if (this.activeSkillSystem?.slots?.[i]?.id === skillId) return true;
    }
    return false;
  }

  _resolveGemInput(gemSource) {
    if (!gemSource) return { gemItem: null, fromInventory: false };
    if (typeof gemSource === 'string') {
      return {
        gemItem: this.player?.inventory?.remove?.(gemSource) ?? null,
        fromInventory: true,
      };
    }
    return {
      gemItem: gemSource,
      fromInventory: false,
    };
  }

  _returnGemInput(gemItem, fromInventory) {
    if (!gemItem || !fromInventory) return;
    this.player.inventory.autoPlace(gemItem);
  }

  _extractSkillGemFromSlot(slotKey) {
    if (!['primary', 'q', 'e', 'r'].includes(slotKey)) return { ok: false, reason: 'invalid_slot' };

    const idx = slotKey === 'primary' ? -1 : this._slotIndexFromSkillSlotKey(slotKey);
    const runtime = slotKey === 'primary'
      ? (this.player.primarySkill ?? null)
      : (idx >= 0 ? (this.activeSkillSystem.slots[idx] ?? null) : null);

    if (!runtime) return { ok: false, reason: 'no_skill' };

    this._unsocketAllSupports(runtime);

    const offer = getSkillOfferById(runtime._skillGemOfferId ?? runtime.id);
    let gemItem = runtime._skillGemItemDef ?? null;
    if (!gemItem && offer) {
      gemItem = createSkillGemItem(offer);
    }
    if (!gemItem) return { ok: false, reason: 'no_gem_item' };

    gemItem.skillLevel = Math.max(1, runtime.level ?? 1);
    gemItem.skillXp = Math.max(0, runtime._xp ?? 0);

    if (slotKey === 'primary') {
      this.player.primarySkill = null;
    } else if (idx >= 0) {
      this.activeSkillSystem.unequip(idx);
    }

    if (runtime._isPureSkill) {
      this.player.pureSkills = (this.player.pureSkills ?? []).filter((s) => s !== runtime);
    }
    this.player.autoSkills = (this.player.autoSkills ?? []).filter((w) => w !== runtime);

    return { ok: true, gemItem };
  }

  debugLevelUpSkillGem(slotKey) {
    if (!this.debugMode) return { ok: false, reason: 'debug_disabled' };
    if (!['primary', 'q', 'e', 'r'].includes(slotKey)) return { ok: false, reason: 'invalid_slot' };

    const idx = slotKey === 'primary' ? -1 : this._slotIndexFromSkillSlotKey(slotKey);
    const runtime = slotKey === 'primary'
      ? (this.player?.primarySkill ?? null)
      : (idx >= 0 ? (this.activeSkillSystem?.slots?.[idx] ?? null) : null);
    if (!runtime) return { ok: false, reason: 'no_skill' };

    const currentLevel = Math.max(1, runtime.level ?? 1);
    const maxLevel = Math.max(1, runtime.maxLevel ?? 20);
    if (currentLevel >= maxLevel) return { ok: false, reason: 'already_max' };

    this._setSkillProgress(runtime, currentLevel + 1, 0);
    if (runtime._skillGemItemDef) {
      runtime._skillGemItemDef.skillLevel = runtime.level ?? (currentLevel + 1);
      runtime._skillGemItemDef.skillXp = runtime._xp ?? 0;
    }

    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, level: runtime.level ?? (currentLevel + 1), maxLevel };
  }

  equipSkillGemToSlot(slotKey, gemSource) {
    if (!this.player?.inventory) return { ok: false, reason: 'no_player' };
    if (!['primary', 'q', 'e', 'r'].includes(slotKey)) return { ok: false, reason: 'invalid_slot' };

    const { gemItem, fromInventory } = this._resolveGemInput(gemSource);
    if (!gemItem) return { ok: false, reason: 'gem_not_found' };
    if (gemItem.type !== 'skill_gem' || !gemItem.skillOfferId) {
      this._returnGemInput(gemItem, fromInventory);
      return { ok: false, reason: 'invalid_gem' };
    }

    const offer = getSkillOfferById(gemItem.skillOfferId);
    if (!offer) {
      this._returnGemInput(gemItem, fromInventory);
      return { ok: false, reason: 'offer_not_found' };
    }

    if (slotKey === 'primary' && !offer.isActiveSkill) {
      this._returnGemInput(gemItem, fromInventory);
      return { ok: false, reason: 'primary_requires_weapon' };
    }

    if (this._isSkillIdEquippedAnywhere(offer.id, slotKey)) {
      this._returnGemInput(gemItem, fromInventory);
      return { ok: false, reason: 'already_equipped' };
    }

    let replacedGemItem = null;
    const occupied = slotKey === 'primary'
      ? !!this.player.primarySkill
      : !!this.activeSkillSystem.slots[this._slotIndexFromSkillSlotKey(slotKey)];

    if (occupied) {
      const extraction = this._extractSkillGemFromSlot(slotKey);
      if (!extraction.ok) {
        this._returnGemInput(gemItem, fromInventory);
        return extraction;
      }
      replacedGemItem = extraction.gemItem ?? null;
    }

    const runtime = offer.isActiveSkill ? offer.create?.() : offer.createSkill?.();
    if (!runtime) {
      this._returnGemInput(gemItem, fromInventory);
      if (replacedGemItem) this.player.inventory.autoPlace(replacedGemItem);
      return { ok: false, reason: 'create_failed' };
    }

    runtime._skillGemItemDef = gemItem;
    runtime._skillGemOfferId = offer.id;
    this._setSkillProgress(runtime, gemItem.skillLevel ?? 1, gemItem.skillXp ?? 0);

    if (slotKey === 'primary') {
      this.player.primarySkill = runtime;
      if (offer.isActiveSkill) {
        this.player.autoSkills.push(runtime);
      }
    } else {
      const idx = this._slotIndexFromSkillSlotKey(slotKey);
      if (offer.isActiveSkill) {
        this.player.autoSkills.push(runtime);
      } else {
        this.player.pureSkills.push(runtime);
      }
      this.activeSkillSystem.equip(runtime, idx);
    }

    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, replacedGemItem };
  }

  unequipSkillGemFromSlot(slotKey, options = {}) {
    if (!this.player?.inventory) return { ok: false, reason: 'no_player' };
    const extraction = this._extractSkillGemFromSlot(slotKey);
    if (!extraction.ok) return extraction;

    const gemItem = extraction.gemItem;
    const toCursor = options?.toCursor === true;
    let placed = true;
    if (!toCursor) {
      placed = this.player.inventory.autoPlace(gemItem);
      if (!placed) this.dropItemToWorld(gemItem);
    }

    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, dropped: !placed, gemItem };
  }

  socketGem(skillId, slotIndex, gemSource, options = {}) {
    const skill = this.activeSkillSystem.findSkillById(skillId)
      ?? (this.player?.primarySkill?.id === skillId ? this.player.primarySkill : null);
    if (!skill) return { ok: false, reason: 'no_skill' };
    if (!Array.isArray(skill.supportSlots)) return { ok: false, reason: 'no_sockets' };
    const openSlots = this._openSupportSlots(skill);
    if (slotIndex < 0 || slotIndex >= skill.supportSlots.length) return { ok: false, reason: 'invalid_slot' };
    if (slotIndex >= openSlots) return { ok: false, reason: 'slot_locked' };

    const { gemItem: gemItemDef, fromInventory } = this._resolveGemInput(gemSource);
    if (!gemItemDef) return { ok: false, reason: 'gem_not_found' };
    const support = makeSupportInstance(gemItemDef);
    if (!support) {
      this._returnGemInput(gemItemDef, fromInventory);
      return { ok: false, reason: 'invalid_gem' };
    }
    if (!isSupportCompatible(support, skill.tags ?? [])) {
      this._returnGemInput(gemItemDef, fromInventory);
      return { ok: false, reason: 'incompatible' };
    }

    let replacedGemItem = null;
    const existing = skill.supportSlots[slotIndex];
    if (existing?._itemDef) {
      replacedGemItem = existing._itemDef;
      if (!options?.toCursorExisting) {
        const replaced = this.player.inventory.autoPlace(existing._itemDef);
        if (!replaced) this.dropItemToWorld(existing._itemDef);
        replacedGemItem = null;
      }
    }
    skill.supportSlots[slotIndex] = support;
    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, replacedGemItem };
  }

  /**
   * Remove a support gem from a skill socket, returning the gem to inventory.
   */
  unsocketGem(skillId, slotIndex, options = {}) {
    const skill = this.activeSkillSystem.findSkillById(skillId)
      ?? (this.player?.primarySkill?.id === skillId ? this.player.primarySkill : null);
    if (!skill) return { ok: false, reason: 'no_skill' };
    if (!Array.isArray(skill.supportSlots) || slotIndex < 0 || slotIndex >= skill.supportSlots.length) {
      return { ok: false, reason: 'invalid_slot' };
    }
    const support = skill.supportSlots[slotIndex];
    if (!support) return { ok: false, reason: 'empty_slot' };
    const toCursor = options?.toCursor === true;
    let gemItem = null;
    if (support._itemDef) {
      gemItem = support._itemDef;
      if (!toCursor) {
        const placed = this.player.inventory.autoPlace(support._itemDef);
        if (!placed) this.dropItemToWorld(support._itemDef);
        gemItem = null;
      }
    }
    skill.supportSlots[slotIndex] = null;
    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, gemItem };
  }

  /** Consume an inventory skill gem and learn/equip its associated skill. */
  consumeSkillGem(gemUid) {
    void gemUid;
    return { ok: false, reason: 'use_gem_panel' };
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
      explicitAffixes: d.explicitAffixes ?? [],
      implicitAffixes: d.implicitAffixes ?? [],
      isUnique:    d.isUnique ?? false,
      flavorText:  d.flavorText ?? null,
      baseStats:   d.baseStats ?? d.stats ?? {},
      defenseType: d.defenseType ?? null,
      weaponType: d.weaponType ?? null,
      handedness: d.handedness ?? null,
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
        const def    = generateItem(base, rarity, {
          itemLevel: playerLevel,
        });
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

    const baseAreaLevel = clampAreaLevel(Math.round(playerLevel + 8));
    const maps = Array.from({ length: 5 }, () => {
      const levelVariance = Math.floor(Math.random() * 9) - 4;
      const rolledAreaLevel = clampAreaLevel(baseAreaLevel + levelVariance);
      const mapItem = createMapItemDrop({
        playerLevel,
        isChampion: false,
        dropContext: 'vendor',
        areaLevel: rolledAreaLevel,
        sourceMapItemLevel: rolledAreaLevel,
      });
      return {
        id:    `map:${mapItem.uid}`,
        tab:   'maps',
        kind:  'map_item',
        name:  mapItem.name,
        icon:  '🗺',
        description: `Area Lv. ${mapItem.mapItemLevel} — ${mapItem.description}`,
        price: Math.min(10, Math.max(3, 2 + Math.floor((mapItem.mapItemLevel ?? 1) / 12))),
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
    const skillRows = listSkillOffers().map((offer) => ({
      id:    `skill:${offer.id}`,
      tab:   'skill',
      kind:  'skill_gem',
      name:  `${offer.name} Gem`,
      icon:  offer.isActiveSkill ? '✦' : '◇',
      description: offer.description,
      price: offer.isActiveSkill ? 8 : 6,
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

  /**
   * Sell an inventory item back to the vendor.
   * Gold value = base item price + sum of affix prices.
   * Item is removed from inventory.
   * @param {string} itemUid
   * @returns {{ ok: boolean, reason?: string, itemName?: string, goldReceived?: number }}
   */
  sellItem(itemUid) {
    if (!this.player?.inventory) return { ok: false, reason: 'no_player' };

    // Remove item from inventory
    const itemDef = this.player.inventory.remove(itemUid);
    if (!itemDef) return { ok: false, reason: 'not_found' };

    // Calculate sell price
    const goldValue = Math.max(1, Math.round(calcSellPrice(itemDef)));

    // Add gold to player
    this.player.gold = (this.player.gold ?? 0) + goldValue;

    this.audio.play('xp_collect');
    this._flushHudUpdate();
    this.checkpoint();
    return { ok: true, itemName: itemDef.name, goldReceived: goldValue };
  }

  getCraftingActions() {
    return CRAFTING_ACTIONS;
  }

  craftEquippedItem(slot, actionId, options = {}) {
    if (!this.player?.equipment) return { ok: false, reason: 'no_player', blockedReason: 'No player is active.' };
    const entry = this.player.equipment?.[slot] ?? null;
    if (!entry?.def) return { ok: false, reason: 'missing_item', blockedReason: 'Select an equipped item first.' };

    const beforeItem = structuredClone(entry.def);
    const result = applyCraftingAction(entry.def, actionId, options);
    if (!result?.ok || !result.afterItem) {
      return {
        ok: false,
        slot,
        action: result?.action ?? null,
        reason: result?.reason ?? 'craft_failed',
        blockedReason: result?.blockedReason ?? 'Crafting failed.',
        beforeItem,
      };
    }

    let removed = null;
    try {
      removed = this.player.unequip(slot);
      const displaced = this.player.equip(result.afterItem, slot);
      if (displaced && displaced.uid !== beforeItem.uid) {
        throw new Error('unexpected_displaced_item');
      }
    } catch (error) {
      if (removed) {
        this.player.equip(beforeItem, slot);
      }
      return {
        ok: false,
        slot,
        action: result.action,
        reason: 'craft_transaction_failed',
        blockedReason: 'Crafting could not be applied safely.',
        error: String(error?.message ?? error),
        beforeItem,
      };
    }

    this.audio.play('xp_collect');
    this._flushHudUpdate();
    this.checkpoint();
    return {
      ok: true,
      slot,
      action: result.action,
      beforeItem,
      afterItem: structuredClone(result.afterItem),
    };
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
    const replaceWhenFull = !!opts.replaceWhenFull;

    // Find the first empty slot; optionally allow replacing slot 0 when full.
    let targetSlot = this.activeSkillSystem.firstEmptySlot();
    if (targetSlot === -1 && replaceWhenFull) targetSlot = 0;
    if (targetSlot === -1) {
      if (suppressFlow) {
        this._flushHudUpdate();
      } else {
        this.resume();
      }
      return { ok: false, reason: 'no_free_slot' };
    }

    if (replaceWhenFull && this.activeSkillSystem.slots?.[targetSlot]) {
      this._removeEquippedSkillAtSlot(targetSlot);
    }

    if (choice.isActiveSkill) {
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
      return { ok: true, slot: targetSlot };
    }
    // Notify UI, but do not auto-open passive tree. Player can open it manually with T.
    if (player.skillPoints > 0) {
      this.onLevelUp?.(player.skillPoints);
    }
    this.resume();
    return { ok: true, slot: targetSlot };
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
