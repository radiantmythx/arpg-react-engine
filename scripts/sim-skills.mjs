import { getPureSkillCtorById } from '../src/game/content/registries/index.js';

const SKILL_IDS = ['fireball', 'frost_nova'];

function summarizeSkill(id) {
  const SkillCtor = getPureSkillCtorById(id);
  if (!SkillCtor) {
    throw new Error(`Missing pure skill constructor for '${id}'`);
  }

  const skill = new SkillCtor();
  const stats = skill.computedStats();
  const damage = Number(stats.damage ?? 0);
  const cooldown = Number(skill.cooldown ?? 0);

  if (!Number.isFinite(cooldown) || cooldown <= 0) {
    throw new Error(`Skill '${id}' has invalid cooldown '${cooldown}'`);
  }
  if (!Number.isFinite(damage) || damage <= 0) {
    throw new Error(`Skill '${id}' has invalid damage '${damage}'`);
  }

  return {
    id,
    cooldown,
    damage,
  };
}

function run() {
  const rows = SKILL_IDS.map(summarizeSkill);
  console.log('Skill simulation passed.');
  for (const row of rows) {
    console.log(`- ${row.id}: cooldown=${row.cooldown.toFixed(2)}s, damage=${row.damage.toFixed(2)}`);
  }
}

run();
