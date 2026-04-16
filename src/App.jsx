import { useRef, useState, useEffect, useCallback } from 'react';
import { GameEngine } from './game/GameEngine.js';
import { MainMenu } from './components/MainMenu.jsx';
import { HUD } from './components/HUD.jsx';
import { PauseScreen } from './components/PauseScreen.jsx';
import { OptionsModal } from './components/OptionsModal.jsx';
import { GameOver } from './components/GameOver.jsx';
import { ItemTooltip } from './components/ItemTooltip.jsx';
import { InventoryScreen } from './components/InventoryScreen.jsx';
import { PassiveTreeScreen } from './components/PassiveTreeScreen.jsx';
import { MetaTreeScreen } from './components/MetaTreeScreen.jsx';
import { CharacterSelect, AchievementSystem } from './components/CharacterSelect.jsx';
import { CharacterCreateScreen } from './components/CharacterCreateScreen.jsx';
import { CharacterSelectScreen } from './components/CharacterSelectScreen.jsx';
import { DeathScreen } from './components/DeathScreen.jsx';
import { HubScreen } from './components/HubScreen.jsx';
import { MapSelectScreen } from './components/MapSelectScreen.jsx';
import { MapCompleteScreen } from './components/MapCompleteScreen.jsx';
import { CharacterSheet } from './components/CharacterSheet.jsx';
import { VendorScreen } from './components/VendorScreen.jsx';
import { BossAnnouncement } from './components/BossAnnouncement.jsx';
import { PortalConfirmDialog } from './components/PortalConfirmDialog.jsx';
import { MobileControls } from './components/MobileControls.jsx';
import { HoverInspectPanel } from './components/HoverInspectPanel.jsx';
import { CHARACTER_MAP } from './game/data/characters.js';
import { MetaProgression } from './game/MetaProgression.js';
import { CharacterSave } from './game/CharacterSave.js';
import { listFreeMaps } from './game/content/registries/index.js';
import './styles/App.css';

const FREE_MAPS = listFreeMaps();

const INITIAL_HUD = {
  health: 100,
  maxHealth: 100,
  mana: 100,
  maxMana: 100,
  xp: 0,
  xpToNext: 10,
  level: 1,
  elapsed: 0,
  kills: 0,
  gold: 0,
  skillPoints:    0,
  allocatedNodes: [],
  shardsThisRun:  0,
  portalsRemaining: 0,
  mapEnemiesKilled: 0,
  mapEnemiesTotal: 0,
  hasActiveMap: false,
  mapContext: false,
  debugMode: false,
  minimapMode: 0,
  mapName: '',
  mapAreaLevel: 0,
  mapMods: [],
  potions: [
    { slot: 1, hotkey: '1', empty: true, id: null, name: 'Empty', icon: '·', color: '#5a6070', charges: 0, maxCharges: 0, chargesPerUse: 0, active: false, activePct: 0 },
    { slot: 2, hotkey: '2', empty: true, id: null, name: 'Empty', icon: '·', color: '#5a6070', charges: 0, maxCharges: 0, chargesPerUse: 0, active: false, activePct: 0 },
    { slot: 3, hotkey: '3', empty: true, id: null, name: 'Empty', icon: '·', color: '#5a6070', charges: 0, maxCharges: 0, chargesPerUse: 0, active: false, activePct: 0 },
    { slot: 4, hotkey: '4', empty: true, id: null, name: 'Empty', icon: '·', color: '#5a6070', charges: 0, maxCharges: 0, chargesPerUse: 0, active: false, activePct: 0 },
  ],
  training: {
    enabled: false,
    windowSeconds: 8,
    dps: 0,
    manaSpendPerS: 0,
    manaRegenPerS: 0,
  },
  equipment: {
    mainhand:  null,
    offhand:   null,
    bodyarmor: null,
    helmet:    null,
    boots:     null,
    belt:      null,
    ring1:     null,
    ring2:     null,
    amulet:    null,
    gloves:    null,
  },
  inventory: { cols: 12, rows: 6, items: [] },
  primarySkill: null,
  activeSkills: [],
};

const MOBILE_PREF_KEY = 'survivor_mobile_mode';
const MOBILE_UI_PREF_KEY = 'survivor_mobile_ui';
const MOBILE_PERF_PREF_KEY = 'survivor_mobile_perf';

function detectMobileByDefault() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)')?.matches
  );
}

function loadMobileUiPrefs() {
  if (typeof window === 'undefined') {
    return { leftHanded: false, largeButtons: false, haptics: true, autoPickup: true };
  }
  try {
    const raw = window.localStorage.getItem(MOBILE_UI_PREF_KEY);
    if (!raw) return { leftHanded: false, largeButtons: false, haptics: true, autoPickup: true };
    const parsed = JSON.parse(raw);
    return {
      leftHanded: !!parsed.leftHanded,
      largeButtons: !!parsed.largeButtons,
      haptics: parsed.haptics !== false,
      autoPickup: parsed.autoPickup !== false,
    };
  } catch {
    return { leftHanded: false, largeButtons: false, haptics: true, autoPickup: true };
  }
}

function detectDefaultPerfPreset() {
  if (typeof window === 'undefined') return 'quality';
  const saveData = navigator.connection?.saveData === true;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  if (saveData || reduceMotion || (detectMobileByDefault() && (lowCpu || lowMemory))) return 'battery';
  if (detectMobileByDefault()) return 'balanced';
  return 'quality';
}

function loadMobilePerfPrefs() {
  const fallback = { preset: detectDefaultPerfPreset() };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(MOBILE_PERF_PREF_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const preset = ['quality', 'balanced', 'battery'].includes(parsed?.preset) ? parsed.preset : fallback.preset;
    return { preset };
  } catch {
    return fallback;
  }
}

function buildPerformanceProfile(preset = 'quality', mobileActive = false) {
  switch (preset) {
    case 'battery':
      return {
        preset,
        targetFps: 30,
        particleMultiplier: 0.35,
        maxParticles: 80,
        maxFloatTexts: 12,
        drawBackgroundGrid: false,
        backgroundGridStep: 3,
        drawWallDetails: false,
        hudInterval: 0.09,
        reduceUiEffects: true,
      };
    case 'balanced':
      return {
        preset,
        targetFps: mobileActive ? 45 : 60,
        particleMultiplier: 0.65,
        maxParticles: 130,
        maxFloatTexts: 16,
        drawBackgroundGrid: true,
        backgroundGridStep: mobileActive ? 2 : 1,
        drawWallDetails: !mobileActive,
        hudInterval: 0.065,
        reduceUiEffects: mobileActive,
      };
    default:
      return {
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
  }
}

function getViewportSize() {
  if (typeof window === 'undefined') return { width: 1024, height: 768 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function getPhoneUiHint(context) {
  switch (context) {
    case 'INVENTORY_equipment':
      return 'Your bag and gear are easier to compare in landscape.';
    case 'INVENTORY_gems':
      return 'Gems and socket links are much easier to manage with extra horizontal space.';
    case 'VENDOR':
      return 'Shop tabs and item browsing fit better in landscape.';
    case 'MAP_SELECT':
      return '';
    case 'TREE':
      return 'The passive tree is much easier to pan and read in landscape.';
    case 'SHEET':
      return 'Character stats and equipment details fit more comfortably in landscape.';
    default:
      return '';
  }
}

// Screen names:
// 'MENU' | 'CHARACTER_SELECT' | 'CHARACTER_CREATE' | 'HUB' | 'DIED' |
// 'MAP_SELECT' | 'MAP_COMPLETE' | 'RUNNING' | 'PAUSED' | 'TREE' | 'INVENTORY' | 'SHEET' | 'VENDOR' | 'PORTAL_CONFIRM' | 'GAME_OVER' | 'META'

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Start on the title screen so players can confirm desktop/mobile mode first.
  const [screen, setScreen] = useState('MENU');
  const [hud, setHud]                 = useState(INITIAL_HUD);
  const [finalStats, setFinalStats]   = useState(null);
  // D2/PoE inventory state
  const [cursorItem, setCursorItem]   = useState(null);
  const [hoveredDrop, setHoveredDrop] = useState(null);
  const [hoveredInspect, setHoveredInspect] = useState(null);
  const [mousePos, setMousePos]       = useState({ x: 0, y: 0 });
  // Character selection
  const [unlockedChars, setUnlockedChars] = useState(() => AchievementSystem.loadUnlocks());
  // Meta-tree state
  const [metaNodes, setMetaNodes] = useState(() => MetaProgression.loadMetaNodes());
  const [totalShards, setTotalShards] = useState(() => MetaProgression.loadShards());
  // Achievement unlock toast: { id, name, color } | null
  const [unlockToast, setUnlockToast] = useState(null);
  const _toastTimer = useRef(null);
  // Boss announcement: boss name string | null
  const [bossAnnouncement, setBossAnnouncement] = useState(null);
  // C2 death overlay info: { portalsLeft, elapsed, kills, level } | null
  const [deathInfo, setDeathInfo] = useState(null);
  // C3 hub overlay info
  const [nearbyHubInteractable, setNearbyHubInteractable] = useState(null);
  const [activeCharacterName, setActiveCharacterName] = useState('');
  const [activeMapInfo, setActiveMapInfo] = useState(null);
  const [mapCompleteInfo, setMapCompleteInfo] = useState(null);
  const [vendorStock, setVendorStock] = useState([]);
  const [vendorFeedback, setVendorFeedback] = useState('');
  const [sheetMode, setSheetMode] = useState('sheet');
  const [sheetFeedback, setSheetFeedback] = useState('');
  const [actsCleared, setActsCleared] = useState([]);
  const [primedMapPortal, setPrimedMapPortal] = useState(null);
  // Options overlay: visible from main menu or pause screen
  const [showOptions, setShowOptions] = useState(false);
  // Inventory tab: 'equipment' | 'gems'
  const [invTab, setInvTab] = useState('equipment');
  const [hasExplicitMobilePref, setHasExplicitMobilePref] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem(MOBILE_PREF_KEY);
    return saved === '1' || saved === '0';
  });
  const [mobileMode, setMobileMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem(MOBILE_PREF_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return detectMobileByDefault();
  });
  const [mobileUi, setMobileUi] = useState(() => loadMobileUiPrefs());
  const [mobilePerf, setMobilePerf] = useState(() => loadMobilePerfPrefs());
  const [viewportSize, setViewportSize] = useState(() => getViewportSize());
  const [dismissedPhoneHintKey, setDismissedPhoneHintKey] = useState('');

  // ── Callbacks passed to GameEngine ──────────────────────────────

  const handleHudUpdate = useCallback((data) => {
    setHud((prev) => ({ ...prev, ...data }));
  }, []);

  const handleLevelUp = useCallback(() => {
    // Level-up no longer auto-opens the passive tree. HUD indicators guide the player to press T.
  }, []);

  const handleGameOver = useCallback((stats) => {
    const charDef = CHARACTER_MAP[stats.characterId];
    const record = {
      characterId:    stats.characterId,
      characterName:  charDef?.name ?? stats.characterId,
      elapsed:        stats.elapsed,
      kills:          stats.kills,
      level:          stats.level,
      bossesDefeated: stats.bossesDefeated?.length ?? 0,
      shardsEarned:   stats.shardsThisRun ?? 0,
      date:           new Date().toISOString(),
    };
    MetaProgression.addShards(record.shardsEarned);
    MetaProgression.addRunRecord(record);
    MetaProgression.addHighScore(record.characterId, record);
    const newTotal = MetaProgression.loadShards();
    setTotalShards(newTotal);
    setFinalStats({ ...stats, totalShards: newTotal });
    setScreen('GAME_OVER');
  }, []);

  const handleHoveredItemChange = useCallback((itemData) => {
    setHoveredDrop(itemData ?? null);
  }, []);

  const handleHoverInspectChange = useCallback((payload) => {
    setHoveredInspect(payload ?? null);
  }, []);

  const handleBossAnnounce = useCallback((bossName) => {
    setBossAnnouncement(bossName);
  }, []);

  const handleMapComplete = useCallback((stats) => {
    setMapCompleteInfo(stats ?? null);
    setScreen('MAP_COMPLETE');
  }, []);

  const handleAchievementUnlock = useCallback((characterId) => {
    const char = CHARACTER_MAP[characterId];
    if (!char) return;
    // Refresh the unlocked set so CharacterSelect re-renders immediately
    setUnlockedChars(AchievementSystem.loadUnlocks());
    // Show toast
    if (_toastTimer.current) clearTimeout(_toastTimer.current);
    setUnlockToast({ id: char.id, name: char.name, color: char.color, icon: char.icon });
    _toastTimer.current = setTimeout(() => setUnlockToast(null), 4500);
  }, []);

  /** C2 callback from engine.enterHub(). */
  const handleEnterHub = useCallback(() => {
    setDeathInfo(null);
    const activeId = activeCharIdRef.current;
    if (activeId) {
      const save = CharacterSave.load(activeId);
      setActsCleared(save?.actsCleared ?? []);
    } else {
      setActsCleared([]);
    }
    setActiveMapInfo(engineRef.current?.getReenterableMapInfo?.() ?? null);
    setPrimedMapPortal(engineRef.current?.getPrimedMapPortalInfo?.() ?? null);
    setMapCompleteInfo(null);
    setScreen('HUB');
  }, []);

  /** C2 callback when dying in a map while portals remain. */
  const handlePlayerDied = useCallback((portalsLeft, stats = {}) => {
    setDeathInfo({
      portalsLeft,
      elapsed: stats.elapsed ?? 0,
      kills:   stats.kills ?? 0,
      level:   stats.level ?? 1,
      characterName: stats.characterName ?? activeCharacterName,
      characterClass: stats.characterClass ?? '',
    });
    setScreen('DIED');
  }, [activeCharacterName]);

  /** C3 callback when the nearest hub interactable changes. */
  const handleHubInteractableChange = useCallback((interactable) => {
    setNearbyHubInteractable(interactable ?? null);
  }, []);

  // ── Game control ────────────────────────────────────────────────

  /** C1: id of the active character save (set before each run; used by C2 engine integration). */
  const activeCharIdRef = useRef(null);

  const bootEngine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (engineRef.current) engineRef.current.destroy();

    const engine = new GameEngine(
      canvas,
      handleHudUpdate,
      handleLevelUp,
      handleGameOver,
      handleHoveredItemChange,
      handleAchievementUnlock,
      handleBossAnnounce,
      handleEnterHub,
      handlePlayerDied,
      handleHubInteractableChange,
      handleMapComplete,
      handleHoverInspectChange,
    );
    engine.setMobileAssistOptions?.({ autoPickup: mobileMode && mobileUi.autoPickup, enabled: mobileMode });
    engine.setPerformanceProfile?.(buildPerformanceProfile(mobilePerf.preset, mobileMode));
    engineRef.current = engine;

    setHud(INITIAL_HUD);
    setFinalStats(null);
    setCursorItem(null);
    setHoveredDrop(null);
    setHoveredInspect(null);
    setDeathInfo(null);
    setBossAnnouncement(null);
    setNearbyHubInteractable(null);
    setActiveMapInfo(null);
    setMapCompleteInfo(null);
    setVendorStock([]);
    setVendorFeedback('');
    setPrimedMapPortal(null);

    return engine;
  }, [
    handleHudUpdate,
    handleLevelUp,
    handleGameOver,
    handleHoveredItemChange,
    handleAchievementUnlock,
    handleBossAnnounce,
    handleEnterHub,
    handlePlayerDied,
    handleHubInteractableChange,
    handleMapComplete,
    handleHoverInspectChange,
    mobileMode,
    mobileUi.autoPickup,
    mobilePerf.preset,
  ]);

  const startGame = useCallback((classId = 'sage', characterId = null) => {
    const engine = bootEngine();
    if (!engine) return;
    activeCharIdRef.current = characterId;
    setScreen('RUNNING');
    engine.start(classId);
  }, [bootEngine]);

  // ── C2 character flow ───────────────────────────────────────────────────

  const enterHubForCharacter = useCallback((characterId) => {
    const engine = bootEngine();
    if (!engine) return;
    activeCharIdRef.current = characterId;
    const save = CharacterSave.load(characterId);
    setActiveCharacterName(save?.name ?? characterId);
    setActsCleared(save?.actsCleared ?? []);
    engine.enterHub(characterId);
  }, [bootEngine]);

  /**
   * Called by CharacterCreateScreen after the save is written.
   * C2: enters hub for that persistent character.
   */
  const handleCreateCharacter = useCallback((characterId) => {
    enterHubForCharacter(characterId);
  }, [enterHubForCharacter]);

  /**
   * Called by CharacterSelectScreen when the player clicks a saved character.
   * C2: enters hub for that saved character.
   */
  const handleSelectCharacter = useCallback((characterId) => {
    enterHubForCharacter(characterId);
  }, [enterHubForCharacter]);

  /** C3 map-device action: enter selected map. */
  const handleStartMapFromHub = useCallback((mapDef) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.enterMap(mapDef);
    setPrimedMapPortal(engine.getPrimedMapPortalInfo?.() ?? null);
    setActiveMapInfo(engine.getReenterableMapInfo?.() ?? null);
    setDeathInfo(null);
    setScreen('RUNNING');
  }, []);

  const handleResumeMapFromHub = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.hasReenterableMap?.()) return;
    engine.reenterMapInstance();
    setPrimedMapPortal(engine.getPrimedMapPortalInfo?.() ?? null);
    setActiveMapInfo(engine.getReenterableMapInfo?.() ?? null);
    setDeathInfo(null);
    setMapCompleteInfo(null);
    setScreen('RUNNING');
  }, []);

  const handleOpenMapSelect = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pause();
    setActiveMapInfo(engine.getReenterableMapInfo?.() ?? null);
    setPrimedMapPortal(engine.getPrimedMapPortalInfo?.() ?? null);
    setScreen('MAP_SELECT');
  }, []);

  const handleCloseMapSelect = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'MAP_SELECT') return;
    setActiveMapInfo(engine.getReenterableMapInfo?.() ?? null);
    setPrimedMapPortal(engine.getPrimedMapPortalInfo?.() ?? null);
    engine.resume();
    setScreen('HUB');
  }, [screen]);

  const handleOpenMapPortalFromItem = useCallback((itemUid) => {
    const engine = engineRef.current;
    if (!engine || screen !== 'MAP_SELECT') return;
    const opened = engine.openMapDevicePortal?.(itemUid);
    if (!opened) return;
    setPrimedMapPortal(engine.getPrimedMapPortalInfo?.() ?? null);
    setActiveMapInfo(engine.getReenterableMapInfo?.() ?? null);
    engine.resume();
    setScreen('HUB');
  }, [screen]);

  const handleEnterPrimedMapPortal = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const entered = engine.enterPrimedMapPortal?.();
    if (!entered) return;
    setPrimedMapPortal(null);
    setActiveMapInfo(engine.getReenterableMapInfo?.() ?? null);
    setDeathInfo(null);
    setMapCompleteInfo(null);
    setScreen('RUNNING');
  }, []);

  const handleHubInteract = useCallback((interactableId) => {
    const engine = engineRef.current;
    if (!engine || screen !== 'HUB') return;

    if (interactableId === 'stash') {
      setInvTab('equipment');
      engine.pause();
      setScreen('INVENTORY');
      return;
    }
    if (interactableId === 'passive_tree') {
      engine.pause();
      setScreen('TREE');
      return;
    }
    if (interactableId === 'map_device') {
      handleOpenMapSelect();
      return;
    }
    if (interactableId === 'crafting') {
      engine.pause();
      setSheetMode('crafting');
      setSheetFeedback('Crafting Bench: select equipped gear and choose a currency action.');
      setScreen('SHEET');
      return;
    }
    if (interactableId === 'vendor') {
      engine.pause();
      setVendorStock(engine.getVendorStock?.() ?? []);
      setVendorFeedback('Tip: right-click a skill gem in inventory to learn it.');
      setScreen('VENDOR');
      return;
    }
    if (interactableId === 'map_portal') {
      handleEnterPrimedMapPortal();
    }
  }, [screen, handleOpenMapSelect, handleEnterPrimedMapPortal]);

  const closeVendor = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'VENDOR') return;
    engine.resume();
    setScreen('HUB');
  }, [screen]);

  const handleVendorBuy = useCallback((listingId) => {
    const engine = engineRef.current;
    if (!engine || screen !== 'VENDOR') return;
    const result = engine.purchaseVendorItem?.(listingId);
    if (!result?.ok) {
      if (result?.reason === 'not_enough_gold') {
        setVendorFeedback(`Not enough gold for ${result.itemName}.`);
      } else if (result?.reason === 'inventory_full') {
        setVendorFeedback('Inventory is full. Free some space and try again.');
      } else {
        setVendorFeedback('Purchase failed.');
      }
      return;
    }
    setVendorFeedback(`Purchased ${result.itemName} for ${result.price}g.`);
    // Refresh stock to reflect the sold item being removed
    setVendorStock(engine.getVendorStock?.() ?? []);
  }, [screen]);

  const handleVendorReroll = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'VENDOR') return;
    const result = engine.rerollVendorEquipment?.();
    if (!result?.ok) {
      if (result?.reason === 'not_enough_gold') {
        setVendorFeedback(`Need ${result.price}g to reroll the shop.`);
      }
      return;
    }
    setVendorStock(engine.getVendorStock?.() ?? []);
    setVendorFeedback(`Shop rerolled for ${result.price}g.`);
  }, [screen]);

  const handleVendorSell = useCallback((itemUid) => {
    const engine = engineRef.current;
    if (!engine || screen !== 'VENDOR') return;
    const result = engine.sellItem?.(itemUid);
    if (!result?.ok) {
      setVendorFeedback(`Could not sell item: ${result?.reason ?? 'unknown error'}.`);
      return;
    }
    setVendorFeedback(`Sold ${result.itemName} for ${result.goldReceived}g.`);
    // Refresh HUD to reflect new gold and inventory state
    engine._flushHudUpdate();
  }, [screen]);

  const handleDevAddGold = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.player) return;
    engine.player.gold = (engine.player.gold ?? 0) + 100;
    if (engine.currentCharId) engine.checkpoint();
    engine._flushHudUpdate?.();
  }, []);

  const handleDevLevelUp = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.player || !engine?.xpSystem) return;
    const needed = (engine.player.xpToNext ?? 1) - (engine.player.xp ?? 0);
    engine.xpSystem.collect(needed > 0 ? needed : 1);
  }, []);

  const handleDevUnlockAllActs = useCallback(() => {
    const engine = engineRef.current;
    const charId = engine?.currentCharId ?? activeCharIdRef.current;
    if (!charId) return;

    const existing = CharacterSave.load(charId) ?? {};
    const now = new Date().toISOString();
    const unlockedIds = FREE_MAPS.map((map) => map.id);
    const clearedSet = new Set([...(existing.actsCleared ?? []), ...unlockedIds]);
    const actsClearedAt = { ...(existing.actsClearedAt ?? {}) };
    for (const mapId of unlockedIds) {
      if (!actsClearedAt[mapId]) actsClearedAt[mapId] = now;
    }

    const updatedActs = [...clearedSet];
    CharacterSave.save(charId, {
      ...existing,
      actsCleared: updatedActs,
      actsClearedAt,
    });
    setActsCleared(updatedActs);
    engine?._flushHudUpdate?.();
  }, []);

  const handleDebugLevelUpSkillGem = useCallback((slotKey) => {
    const engine = engineRef.current;
    if (!engine || !hud.debugMode) return;
    const result = engine.debugLevelUpSkillGem?.(slotKey);
    if (!result?.ok) {
      const reasonText = {
        no_skill: 'No skill gem is equipped in that slot.',
        already_max: 'That skill gem is already at max level.',
        invalid_slot: 'Invalid skill slot.',
      };
      setVendorFeedback(reasonText[result?.reason] ?? 'Could not level up skill gem.');
      return;
    }
    setVendorFeedback(`Debug: leveled ${String(slotKey).toUpperCase()} skill to ${result.level}/${result.maxLevel}.`);
  }, [hud.debugMode]);

  const handleSwitchCharacterFromHub = useCallback(() => {
    const engine = engineRef.current;
    if (engine) engine.destroy();
    engineRef.current = null;
    activeCharIdRef.current = null;
    setActiveCharacterName('');
    setNearbyHubInteractable(null);
    setActiveMapInfo(null);
    setMapCompleteInfo(null);
    setPrimedMapPortal(null);
    setActsCleared([]);
    setScreen('CHARACTER_SELECT');
  }, []);

  /** Return to hub after a portal death. */
  const handleReturnToHubFromDeath = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setDeathInfo(null);
    engine.exitMap(false);
  }, []);

  const handleReturnToHubAfterClear = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setMapCompleteInfo(null);
    engine.exitMap(true);
  }, []);

  const handleStayInMapAfterClear = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setMapCompleteInfo(null);
    engine.stayInClearedMap?.();
    setScreen('RUNNING');
  }, []);

  const handleUpgradeChoice = useCallback(() => {
    // Kept for backward compat; not called in Phase 6.
  }, []);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (screen === 'RUNNING' || screen === 'HUB') {
      engine.pause();
      setScreen('PAUSED');
    } else if (screen === 'PAUSED') {
      engine.resume();
      setScreen(engine.state === 'HUB' ? 'HUB' : 'RUNNING');
    }
  }, [screen]);

  const handleAbandonRun = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // Build final stats based on current HUD so the game-over screen is meaningful
    const stats = {
      ...hud,
      characterId: engine.player?.characterId ?? 'sage',
      bossesDefeated: engine.bossesDefeated ?? [],
      shardsThisRun: engine.shardsThisRun ?? 0,
    };
    engine.destroy();
    engineRef.current = null;
    handleGameOver(stats);
  }, [hud, handleGameOver]);

  const handleReturnToMainMenu = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
    setScreen('MENU');
  }, []);

  // ── Passive tree interactions ───────────────────────────────────────

  const openTree = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || (screen !== 'RUNNING' && screen !== 'HUB')) return;
    engine.pause();
    setScreen('TREE');
  }, [screen]);

  const closeTree = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'TREE') return;
    engine.resume();
    setScreen(engine.state === 'HUB' ? 'HUB' : 'RUNNING');
  }, [screen]);

  const openCharacterSheet = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'HUB') return;
    engine.pause();
    setSheetMode('sheet');
    setSheetFeedback('');
    setScreen('SHEET');
  }, [screen]);

  const closeCharacterSheet = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'SHEET') return;
    setSheetMode('sheet');
    setSheetFeedback('');
    engine.resume();
    setScreen('HUB');
  }, [screen]);

  const handleSheetCraftAction = useCallback((slot, actionId) => {
    const engine = engineRef.current;
    if (!engine || screen !== 'SHEET' || sheetMode !== 'crafting') return;
    const result = engine.craftEquippedItem?.(slot, actionId);
    if (!result?.ok) {
      setSheetFeedback(result?.blockedReason ?? 'Crafting failed.');
      return;
    }
    setSheetFeedback(`${result.action?.label ?? 'Crafting'} applied to ${result.afterItem?.name ?? result.beforeItem?.name ?? 'item'}.`);
  }, [screen, sheetMode]);

  const openPortalConfirm = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'RUNNING') return;
    const canSpend = engine.canSpendPortalToHub?.();
    const canFree  = engine.canReturnToHubFree?.();
    if (!canSpend && !canFree) return;
    engine.pause();
    setScreen('PORTAL_CONFIRM');
  }, [screen]);

  const closePortalConfirm = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'PORTAL_CONFIRM') return;
    engine.resume();
    setScreen('RUNNING');
  }, [screen]);

  const confirmPortalToHub = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'PORTAL_CONFIRM') return;
    if (engine.canReturnToHubFree?.()) {
      engine.returnToHubFree?.();
      return;
    }
    const used = engine.spendPortalToHub?.();
    if (!used) {
      engine.resume();
      setScreen('RUNNING');
    }
  }, [screen]);

  const handleAllocateNode = useCallback((nodeId) => {
    engineRef.current?.allocateNode(nodeId);
    // HUD will update via _flushHudUpdate — no local state change needed
  }, []);

  const handleRefundNode = useCallback((nodeId) => {
    engineRef.current?.refundNode(nodeId);
    // HUD will update via _flushHudUpdate — no local state change needed
  }, []);

  const handleRefundAll = useCallback(() => {
    engineRef.current?.refundAll();
    // HUD will update via _flushHudUpdate — no local state change needed
  }, []);

  const handleMetaAllocate = useCallback((nodeId) => {
    const success = MetaProgression.allocateMetaNode(nodeId);
    if (success) {
      setMetaNodes(MetaProgression.loadMetaNodes());
      setTotalShards(MetaProgression.loadShards());
    }
  }, []);

  // ── Inventory interactions ───────────────────────────────────────

  const openInventory = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || (screen !== 'RUNNING' && screen !== 'HUB')) return;
    engine.pause();
    setScreen('INVENTORY');
  }, [screen]);

  const closeInventory = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || screen !== 'INVENTORY') return;
    // If cursor item is held, drop it back into the world
    if (cursorItem) {
      const returned = engine.addToInventory(cursorItem);
      if (!returned) engine.dropItemToWorld(cursorItem);
      setCursorItem(null);
    }
    engine.resume();
    setScreen(engine.state === 'HUB' ? 'HUB' : 'RUNNING');
  }, [screen, cursorItem]);

  // Left-click item in grid → to cursor (swap if cursor held)
  const handleInventoryItemClick = useCallback((uid) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (cursorItem) {
      // Swap: place cursor item, pick up clicked item
      const placed = engine.addToInventory(cursorItem);
      if (placed) {
        // Remove the clicked item from inventory and put on cursor
        const def = engine.player.inventory.remove(uid);
        if (def) {
          engine._flushHudUpdate();
          setCursorItem(def);
        }
      }
    } else {
      // Pick up to cursor
      const def = engine.player.inventory.remove(uid);
      if (def) {
        engine._flushHudUpdate();
        setCursorItem(def);
      }
    }
  }, [cursorItem]);

  // Right-click item in grid → auto-equip (displaced item goes to cursor)
  const handleInventoryItemRightClick = useCallback((uid) => {
    const engine = engineRef.current;
    if (!engine) return;
    const invItem = hud.inventory.items.find((item) => item.uid === uid);
    if (invItem?.type === 'skill_gem') {
      setInvTab('gems');
      setVendorFeedback('Select this skill gem in the Gems tab, then choose a Primary/Q/E/R slot to equip it.');
      return;
    }
    const equippable = ['weapon', 'armor', 'jewelry', 'helmet', 'boots', 'offhand', 'ring', 'amulet', 'mainhand', 'bodyarmor', 'gloves', 'belt'];
    if (!invItem || !equippable.includes(invItem.slot)) return;
    const displaced = engine.equipFromInventory(uid);
    if (displaced) setCursorItem(displaced);
  }, [hud.inventory.items]);

  const handleInventoryDropItem = useCallback((uid) => {
    const engine = engineRef.current;
    if (!engine) return;
    const def = engine.player?.inventory?.remove(uid);
    if (!def) return;
    engine.dropItemToWorld(def);
    engine._flushHudUpdate();
  }, []);

  // Click empty grid cell with cursor item → place it there
  const handleInventoryCellClick = useCallback((col, row) => {
    const engine = engineRef.current;
    if (!engine || !cursorItem) return;
    const placed = engine.placeInInventory(cursorItem, col, row);
    if (placed) setCursorItem(null);
  }, [cursorItem]);

  // Click equip slot:
  //   no cursor  → unequip to cursor (if occupied)
  //   cursor fits slot → equip cursor item (displaced goes to cursor)
  const handleEquipSlotClick = useCallback((slot) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (cursorItem) {
      if (!engine.canEquipItemInSlot(cursorItem, slot)) {
        setVendorFeedback('That item cannot be equipped in this slot.');
        return;
      }
      const displaced = engine.player.equip(cursorItem, slot);
      engine._flushHudUpdate();
      setCursorItem(displaced ?? null);
    } else {
      const displaced = engine.unequipToInventory(slot);
      if (displaced) setCursorItem(displaced);
    }
  }, [cursorItem]);

  // ── Gem socket callbacks (passed to InventoryScreen) ─────────────

  const handleSocketGem = useCallback((skillId, slotIndex, gemSource, options = {}) => {
    const engine = engineRef.current;
    if (!engine) return;
    const usedCursorGem = typeof gemSource === 'object' && gemSource?.uid && gemSource.uid === cursorItem?.uid;
    const result = engine.socketGem(skillId, slotIndex, gemSource, options);
    if (!result?.ok) {
      const messageByReason = {
        no_skill: 'That skill slot is empty. Equip a skill gem first.',
        no_sockets: 'This skill cannot use support gems.',
        invalid_slot: 'Invalid socket index.',
        slot_locked: 'That socket is locked. Level the skill gem to unlock it.',
        gem_not_found: 'That support gem was not available to socket.',
        invalid_gem: 'That item is not a valid support gem.',
        incompatible: 'That support gem is incompatible with this skill.',
      };
      setVendorFeedback(messageByReason[result?.reason] ?? 'Could not socket support gem.');
      return;
    }
    if (usedCursorGem) {
      setCursorItem(result?.replacedGemItem ?? null);
    } else if (result?.replacedGemItem) {
      const placed = engine.addToInventory(result.replacedGemItem);
      if (!placed) engine.dropItemToWorld(result.replacedGemItem);
    }
    setVendorFeedback('Support gem socketed.');
  }, [cursorItem]);

  const handleUnsocketGem = useCallback((skillId, slotIndex, options = {}) => {
    const engine = engineRef.current;
    if (!engine) return;
    const toCursor = options?.toCursor === true;
    const result = engine.unsocketGem(skillId, slotIndex, { toCursor });
    if (!result?.ok) {
      const messageByReason = {
        no_skill: 'That skill slot is empty.',
        invalid_slot: 'Invalid socket index.',
        empty_slot: 'That socket is already empty.',
      };
      setVendorFeedback(messageByReason[result?.reason] ?? 'Could not unsocket support gem.');
      return;
    }
    if (toCursor) {
      setCursorItem(result?.gemItem ?? null);
      setVendorFeedback('Support gem picked up.');
      return;
    }
    setVendorFeedback('Support gem removed.');
  }, []);

  const handleEquipSkillGem = useCallback((slotKey, gemSource) => {
    const engine = engineRef.current;
    if (!engine) return;
    const usedCursorGem = typeof gemSource === 'object' && gemSource?.uid && gemSource.uid === cursorItem?.uid;
    const result = engine.equipSkillGemToSlot(slotKey, gemSource);
    if (!result?.ok) {
      const messageByReason = {
        no_player: 'No active character is loaded.',
        invalid_slot: 'Invalid skill slot.',
        gem_not_found: 'That skill gem was not available to equip.',
        invalid_gem: 'That item is not a valid skill gem.',
        offer_not_found: 'Unknown skill gem type.',
        primary_requires_weapon: 'Primary slot only accepts weapon skill gems.',
        already_equipped: 'That skill is already equipped in another slot.',
        slot_occupied: 'That slot is occupied. Unequip it first.',
        create_failed: 'Failed to equip that skill gem.',
      };
      setVendorFeedback(messageByReason[result?.reason] ?? 'Could not equip skill gem.');
      return;
    }
    if (usedCursorGem) {
      setCursorItem(result?.replacedGemItem ?? null);
    } else if (result?.replacedGemItem) {
      const placed = engine.addToInventory(result.replacedGemItem);
      if (!placed) engine.dropItemToWorld(result.replacedGemItem);
    }
    setVendorFeedback(`Equipped skill gem in ${String(slotKey).toUpperCase()} slot.`);
  }, [cursorItem]);

  const handleUnequipSkillGem = useCallback((slotKey, options = {}) => {
    const engine = engineRef.current;
    if (!engine) return;
    const toCursor = options?.toCursor === true;
    const result = engine.unequipSkillGemFromSlot(slotKey, { toCursor });
    if (!result?.ok) {
      const messageByReason = {
        no_player: 'No active character is loaded.',
        invalid_slot: 'Invalid skill slot.',
        no_skill: 'That slot has no equipped skill.',
        no_gem_item: 'Could not convert this skill back into a gem item.',
      };
      setVendorFeedback(messageByReason[result?.reason] ?? 'Could not unequip skill gem.');
      return;
    }
    if (toCursor) {
      setCursorItem(result?.gemItem ?? null);
      setVendorFeedback('Skill gem picked up. Linked supports were returned to inventory.');
      return;
    }
    if (result?.dropped) {
      setVendorFeedback('Skill gem unequipped. Inventory full, so it was dropped nearby.');
      return;
    }
    setVendorFeedback('Skill gem unequipped and returned to inventory.');
  }, []);

  // ── Canvas mouse events ──────────────────────────────────────────

  const handleCanvasMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    engineRef.current?.updateMousePosition(sx, sy);
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCanvasClick = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (screen === 'HUB') {
      const nearby = engine.getNearbyHubInteractable?.() ?? null;
      if (nearby?.id) handleHubInteract(nearby.id);
      return;
    }

    if (screen !== 'RUNNING') return;
    const itemDef = engine.pickupHoveredItem();
    if (!itemDef) return;
    // Inventory closed → auto-place; inventory open → cursor (can't happen here since
    // picking up from canvas only works when screen === 'RUNNING', not 'INVENTORY')
    const placed = engine.addToInventory(itemDef);
    if (!placed) {
      // Inventory full — open inventory and give item to cursor
      engine.pause();
      setScreen('INVENTORY');
      setCursorItem(itemDef);
    }
  }, [screen, handleHubInteract]);

  const handleMobileMove = useCallback((dx, dy) => {
    const engine = engineRef.current;
    if (!engine?.input) return;
    engine.input.setVirtualMovement(dx, dy);
    engine.input.setVirtualAim(dx, dy);
  }, []);

  const handleMobilePrimaryHold = useCallback((held) => {
    const input = engineRef.current?.input;
    if (!input) return;
    input.setVirtualPrimaryHeld(held);
  }, []);

  const handleMobileSkillTap = useCallback((slot) => {
    const input = engineRef.current?.input;
    if (!input) return;
    if (slot === 'q') input.pressVirtualSkill('KeyQ');
    else if (slot === 'e') input.pressVirtualSkill('KeyE');
    else if (slot === 'r') input.pressVirtualSkill('KeyR');
  }, []);

  const handleMobileOpenInventory = useCallback(() => {
    if (screen !== 'RUNNING' && screen !== 'HUB') return;
    setInvTab('equipment');
    openInventory();
  }, [screen, openInventory]);

  const handleMobileOpenGems = useCallback(() => {
    if (screen !== 'RUNNING' && screen !== 'HUB') return;
    setInvTab('gems');
    openInventory();
  }, [screen, openInventory]);

  const handleMobileOpenTree = useCallback(() => {
    if (screen !== 'RUNNING' && screen !== 'HUB') return;
    openTree();
  }, [screen, openTree]);

  const handleMobileOpenSheet = useCallback(() => {
    if (screen !== 'HUB') return;
    openCharacterSheet();
  }, [screen, openCharacterSheet]);

  const handleMobilePause = useCallback(() => {
    if (screen === 'RUNNING' || screen === 'PAUSED' || screen === 'HUB') togglePause();
  }, [screen, togglePause]);

  const handleMobileToggleLock = useCallback(() => {
    if (screen !== 'RUNNING') return;
    engineRef.current?.toggleTargetLock?.();
  }, [screen]);

  const handleMobileUsePotion = useCallback((slotIndex) => {
    engineRef.current?._usePotion?.(slotIndex);
  }, []);

  const handleMobileCycleMinimap = useCallback(() => {
    engineRef.current?.cycleMobileMinimapMode?.();
  }, []);

  const handleToggleMobileMode = useCallback(() => {
    setHasExplicitMobilePref(true);
    setMobileMode((prev) => !prev);
  }, []);

  // ── Global effects ───────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasExplicitMobilePref) {
      window.localStorage.setItem(MOBILE_PREF_KEY, mobileMode ? '1' : '0');
    }
  }, [mobileMode, hasExplicitMobilePref]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MOBILE_UI_PREF_KEY, JSON.stringify(mobileUi));
  }, [mobileUi]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MOBILE_PERF_PREF_KEY, JSON.stringify(mobilePerf));
  }, [mobilePerf]);

  useEffect(() => {
    engineRef.current?.setMobileAssistOptions?.({ autoPickup: mobileMode && mobileUi.autoPickup, enabled: mobileMode });
  }, [mobileMode, mobileUi.autoPickup]);

  useEffect(() => {
    engineRef.current?.setPerformanceProfile?.(buildPerformanceProfile(mobilePerf.preset, mobileMode));
  }, [mobileMode, mobilePerf.preset]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewport = () => setViewportSize(getViewportSize());
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Track mouse position globally (needed when cursor item leaves canvas)
  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Key handlers: Escape = close/back, V = inventory, G = gems, T = passive tree, P = portal prompt
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyT') {
        if (screen === 'RUNNING' || screen === 'HUB') openTree();
        else if (screen === 'TREE') closeTree();
      }
      if (e.code === 'KeyB') {
        if (screen === 'RUNNING') openPortalConfirm();
      }
      if (e.code === 'KeyG') {
        if (screen === 'RUNNING' || screen === 'HUB') { setInvTab('gems'); openInventory(); }
        else if (screen === 'INVENTORY') { setInvTab((t) => t === 'gems' ? 'equipment' : 'gems'); }
      }
      if (e.code === 'KeyV') {
        if (screen === 'RUNNING' || screen === 'HUB') { setInvTab('equipment'); openInventory(); }
        else if (screen === 'INVENTORY') closeInventory();
      }
      if (e.code === 'KeyC') {
        if (screen === 'HUB') openCharacterSheet();
        else if (screen === 'SHEET') closeCharacterSheet();
      }
      if (e.code === 'Escape') {
        if (screen === 'TREE')                       closeTree();
        else if (screen === 'INVENTORY')             closeInventory();
        else if (screen === 'SHEET')                 closeCharacterSheet();
        else if (screen === 'VENDOR')                closeVendor();
        else if (screen === 'PORTAL_CONFIRM')        closePortalConfirm();
        else if (screen === 'MAP_SELECT')            handleCloseMapSelect();
        else if (screen === 'RUNNING' || screen === 'PAUSED' || screen === 'HUB') togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, openTree, closeTree, openInventory, closeInventory, openCharacterSheet, closeCharacterSheet, closeVendor, togglePause, setInvTab, handleHubInteract, handleCloseMapSelect, openPortalConfirm, closePortalConfirm]);

  // Destroy engine on unmount
  useEffect(() => {
    return () => engineRef.current?.destroy();
  }, []);

  useEffect(() => {
    const input = engineRef.current?.input;
    if (!input) return;
    const mobileActive = mobileMode && (screen === 'RUNNING' || screen === 'HUB');
    if (mobileActive) return;
    input.setVirtualMovement(0, 0);
    input.setVirtualAim(0, 0);
    input.setVirtualPrimaryHeld(false);
  }, [mobileMode, screen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mobileMode) return;

    const pauseForInterruption = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.input?.setVirtualMovement(0, 0);
      engine.input?.setVirtualAim(0, 0);
      engine.input?.setVirtualPrimaryHeld(false);
      if (screen === 'RUNNING') {
        engine.pause();
        setScreen('PAUSED');
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) pauseForInterruption();
    };

    window.addEventListener('blur', pauseForInterruption);
    window.addEventListener('orientationchange', pauseForInterruption);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', pauseForInterruption);
      window.removeEventListener('orientationchange', pauseForInterruption);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [mobileMode, screen]);

  const showHud = screen === 'RUNNING'      || screen === 'HUB'    || screen === 'PAUSED' ||
                  screen === 'MAP_SELECT'   ||
                  screen === 'MAP_COMPLETE' ||
                  screen === 'TREE'          || screen === 'INVENTORY' || screen === 'SHEET' || screen === 'VENDOR' ||
                  screen === 'PORTAL_CONFIRM';

  const hideHudTimer = screen === 'HUB';
  const showMobileControls = mobileMode && (screen === 'RUNNING' || screen === 'HUB');
  const activePhoneHintKey = showOptions ? 'OPTIONS' : screen === 'INVENTORY' ? `INVENTORY_${invTab}` : screen;
  const rotateHintCopy = getPhoneUiHint(activePhoneHintKey);
  const isPortraitPhone = mobileMode
    && viewportSize.width > 0
    && viewportSize.width <= 640
    && viewportSize.width < viewportSize.height;
  const isCompactPhoneUi = mobileMode
    && (
      (viewportSize.width > 0 && viewportSize.width <= 390)
      || (viewportSize.height > 0 && viewportSize.height <= 740)
    );
  const showRotateHint = isPortraitPhone && !!rotateHintCopy && dismissedPhoneHintKey !== activePhoneHintKey;
  const perfClass = ` perf-${mobilePerf.preset}-mode`;
  const phonePortraitClass = isPortraitPhone ? ' phone-portrait-mode' : '';
  const compactPhoneClass = isCompactPhoneUi ? ' mobile-compact-ui' : '';
  const lockedInspectTarget = mobileMode && screen === 'RUNNING' && hud.lockedTarget
    ? {
        name: hud.lockedTarget.name ?? 'Target',
        subtitle: hud.lockedTarget.isBoss ? 'Boss' : 'Enemy',
        health: {
          current: hud.lockedTarget.health ?? Math.round((hud.lockedTarget.healthPct ?? 0) * 100),
          max: hud.lockedTarget.maxHealth ?? 100,
        },
        details: [],
      }
    : null;
  const inspectPanelTarget = lockedInspectTarget ?? hoveredInspect;

  return (
    <div className={`app${mobileMode ? ' mobile-mode' : ''}${mobileUi.leftHanded ? ' mobile-left-handed' : ''}${mobileUi.largeButtons ? ' mobile-large-controls' : ''}${perfClass}${phonePortraitClass}${compactPhoneClass}`}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onMouseMove={handleCanvasMouseMove}
        onClick={handleCanvasClick}
      />

      {screen === 'MENU' && (
        <MainMenu
          hasCharacters={CharacterSave.list().length > 0}
          onNewCharacter={() => setScreen('CHARACTER_CREATE')}
          onContinue={() => setScreen('CHARACTER_SELECT')}
          onOptions={() => setShowOptions(true)}
          mobileMode={mobileMode}
          mobileModeIsAuto={!hasExplicitMobilePref}
          onToggleMobileMode={handleToggleMobileMode}
        />
      )}

      {/* C1 — Saved character list */}
      {screen === 'CHARACTER_SELECT' && (
        <CharacterSelectScreen
          onSelect={handleSelectCharacter}
          onNew={() => setScreen('CHARACTER_CREATE')}
          onBack={() => setScreen('MENU')}
          history={MetaProgression.loadHistory()}
        />
      )}

      {/* C1 — New character creation */}
      {screen === 'CHARACTER_CREATE' && (
        <CharacterCreateScreen
          onCreate={handleCreateCharacter}
          onBack={() =>
            CharacterSave.list().length > 0
              ? setScreen('CHARACTER_SELECT')
              : setScreen('MENU')
          }
        />
      )}

      {screen === 'HUB' && (
        <HubScreen
          characterName={activeCharacterName}
          nearbyInteractable={nearbyHubInteractable}
          onSwitchCharacter={handleSwitchCharacterFromHub}
          mobileMode={mobileMode}
          compactMode={isCompactPhoneUi}
        />
      )}

      {screen === 'MAP_SELECT' && (
        <MapSelectScreen
          onSelectMap={handleStartMapFromHub}
          activeMap={activeMapInfo}
          onResumeMap={handleResumeMapFromHub}
          actsCleared={actsCleared}
          mapItems={hud.inventory.items.filter((item) => item.type === 'map_item')}
          primedPortal={primedMapPortal}
          onOpenMapPortal={handleOpenMapPortalFromItem}
          onClose={handleCloseMapSelect}
          mobileMode={mobileMode}
        />
      )}

      {screen === 'DIED' && (
        <DeathScreen
          portalsLeft={deathInfo?.portalsLeft ?? 0}
          stats={deathInfo ?? {}}
          onReturnHub={handleReturnToHubFromDeath}
        />
      )}

      {screen === 'MAP_COMPLETE' && (
        <MapCompleteScreen
          stats={mapCompleteInfo ?? {}}
          onReturnHub={handleReturnToHubAfterClear}
          onStay={handleStayInMapAfterClear}
        />
      )}

      {screen === 'SHEET' && (
        <CharacterSheet
          hud={hud}
          characterName={activeCharacterName}
          onClose={closeCharacterSheet}
          mobileMode={mobileMode}
          mode={sheetMode}
          feedback={sheetFeedback}
          craftingActions={engineRef.current?.getCraftingActions?.() ?? []}
          onCraftAction={handleSheetCraftAction}
        />
      )}

      {screen === 'VENDOR' && (
        <VendorScreen
          stock={vendorStock}
          inventory={hud.inventory}
          equipment={hud.equipment}
          gold={hud.gold ?? 0}
          feedback={vendorFeedback}
          onBuy={handleVendorBuy}
          onSell={handleVendorSell}
          onClose={closeVendor}
          onReroll={handleVendorReroll}
          rerollCost={5}
          mobileMode={mobileMode}
        />
      )}

      {/* Legacy class-select screen — kept for Achievement unlock flow */}
      {screen === 'LEGACY_CHARACTER_SELECT' && (
        <CharacterSelect
          unlocked={unlockedChars}
          highScores={MetaProgression.loadHighScores()}
          onSelect={(id) => startGame(id)}
          onBack={() => setScreen('MENU')}
        />
      )}

      {showHud && (
        <HUD
          hud={hud}
          hideTimer={hideHudTimer}
          hideCoreOverlays={screen === 'TREE'}
          mobileMode={mobileMode}
          compactMode={isCompactPhoneUi}
          screenContext={screen}
          onDevAddGold={handleDevAddGold}
          onDevLevelUp={handleDevLevelUp}
          onDevUnlockAllActs={handleDevUnlockAllActs}
        />
      )}

      {showMobileControls && (
        <MobileControls
          onMove={handleMobileMove}
          onPrimaryHold={handleMobilePrimaryHold}
          onSkillTap={handleMobileSkillTap}
          onOpenInventory={handleMobileOpenInventory}
          onOpenGems={handleMobileOpenGems}
          onOpenTree={handleMobileOpenTree}
          onOpenSheet={handleMobileOpenSheet}
          onPause={handleMobilePause}
          onPortal={openPortalConfirm}
          onToggleLock={handleMobileToggleLock}
          lockActive={!!hud.lockedTarget}
          leftHanded={mobileUi.leftHanded}
          largeButtons={mobileUi.largeButtons}
          hapticsEnabled={mobileUi.haptics}
          autoPickupEnabled={mobileUi.autoPickup}
          onToggleHandedness={() => setMobileUi((prev) => ({ ...prev, leftHanded: !prev.leftHanded }))}
          onToggleButtonSize={() => setMobileUi((prev) => ({ ...prev, largeButtons: !prev.largeButtons }))}
          onToggleHaptics={() => setMobileUi((prev) => ({ ...prev, haptics: !prev.haptics }))}
          onToggleAutoPickup={() => setMobileUi((prev) => ({ ...prev, autoPickup: !prev.autoPickup }))}
          showCombatButtons={screen === 'RUNNING' || screen === 'HUB'}
          showSheetButton={screen === 'HUB'}
          compactMode={isCompactPhoneUi}
          primarySkill={hud.primarySkill ?? null}
          activeSkills={hud.activeSkills ?? []}
          potions={hud.potions ?? []}
          onUsePotion={handleMobileUsePotion}
          minimapMode={hud.minimapMode ?? 0}
          onCycleMinimap={handleMobileCycleMinimap}
        />
      )}

      {screen === 'RUNNING' && hoveredDrop && (
        <ItemTooltip itemData={hoveredDrop} mousePos={mousePos} hint={mobileMode ? 'Tap to pick up' : 'Click to pick up'} />
      )}

      {(screen === 'RUNNING' || screen === 'HUB' || screen === 'PAUSED') && (
        <HoverInspectPanel
          target={inspectPanelTarget}
          debugMode={!!hud.debugMode}
          mobileMode={mobileMode}
          allowMobile={!!lockedInspectTarget}
        />
      )}

      {screen === 'TREE' && (
        <PassiveTreeScreen
          allocatedIds={hud.allocatedNodes}
          skillPoints={hud.skillPoints}
          gold={hud.gold ?? 0}
          onAllocate={handleAllocateNode}
          onRefund={handleRefundNode}
          onRefundAll={handleRefundAll}
          refundAllCost={engineRef.current?.refundAllCost?.() ?? 0}
          onClose={closeTree}
          mobileMode={mobileMode}
        />
      )}

      {screen === 'INVENTORY' && (
        <InventoryScreen
          inventory={hud.inventory}
          equipment={hud.equipment}
          gold={hud.gold ?? 0}
          feedback={vendorFeedback}
          cursorItem={cursorItem}
          mousePos={mousePos}
          mobileMode={mobileMode}
          onClose={closeInventory}
          onItemClick={handleInventoryItemClick}
          onItemRightClick={handleInventoryItemRightClick}
          onDropItem={handleInventoryDropItem}
          onCellClick={handleInventoryCellClick}
          onSlotClick={handleEquipSlotClick}
          activeTab={invTab}
          onTabChange={setInvTab}
          primarySkill={hud.primarySkill ?? null}
          activeSkills={hud.activeSkills ?? []}
          onSocketGem={handleSocketGem}
          onUnsocketGem={handleUnsocketGem}
          onEquipSkillGem={handleEquipSkillGem}
          onUnequipSkillGem={handleUnequipSkillGem}
          debugMode={!!hud.debugMode}
          onDebugLevelUpSkillGem={handleDebugLevelUpSkillGem}
        />
      )}


      {screen === 'PAUSED' && <PauseScreen
        hubMode={!hud.mapContext}
        onResume={togglePause}
        onOptions={() => setShowOptions(true)}
        onAbandon={handleAbandonRun}
        onMainMenu={handleReturnToMainMenu}
      />}

      {screen === 'PORTAL_CONFIRM' && (
        <PortalConfirmDialog
          portalsRemaining={hud.portalsRemaining ?? 0}
          isFree={!!(engineRef.current?.canReturnToHubFree?.())}
          onConfirm={confirmPortalToHub}
          onCancel={closePortalConfirm}
        />
      )}

      {showOptions && (
        <OptionsModal
          engine={engineRef.current ?? undefined}
          onClose={() => setShowOptions(false)}
          mobileMode={mobileMode}
          perfSettings={mobilePerf}
          onPerfChange={(preset) => setMobilePerf({ preset })}
        />
      )}

      {showRotateHint && (
        <div className="phone-rotate-hint" role="status" aria-live="polite">
          <span className="phone-rotate-hint__icon" aria-hidden="true">↻</span>
          <div className="phone-rotate-hint__copy">
            <strong>Portrait works, but landscape is easier here.</strong>
            <span>{rotateHintCopy}</span>
          </div>
          <button
            type="button"
            className="phone-rotate-hint__dismiss"
            onClick={() => setDismissedPhoneHintKey(activePhoneHintKey)}
            aria-label="Dismiss rotate hint"
          >
            ✕
          </button>
        </div>
      )}

      {bossAnnouncement && (
        <BossAnnouncement
          bossName={bossAnnouncement}
          onDone={() => setBossAnnouncement(null)}
        />
      )}

      {screen === 'GAME_OVER' && (
        <GameOver
          stats={finalStats ?? hud}
          onRestart={() => setScreen('CHARACTER_SELECT')}
        />
      )}

      {screen === 'META' && (
        <MetaTreeScreen
          allocatedNodes={metaNodes}
          shards={totalShards}
          onAllocate={handleMetaAllocate}
          onClose={() => setScreen('MENU')}
        />
      )}

      {/* Achievement unlock toast */}
      {unlockToast && (
        <div
          className="achievement-toast"
          style={{ '--toast-color': unlockToast.color }}
        >
          <span className="achievement-toast-icon">{unlockToast.icon}</span>
          <div className="achievement-toast-text">
            <div className="achievement-toast-label">CHARACTER UNLOCKED</div>
            <div className="achievement-toast-name" style={{ color: unlockToast.color }}>
              {unlockToast.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
