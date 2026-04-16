import { PURE_SKILL_CTORS } from './pureSkillCtors.js';

/**
 * Compile a SkillTemplate into the current runtime SkillDef instance.
 * Phase 3 bridge: compilation delegates to existing SkillDef constructors.
 */
export function compileSkillTemplateToRuntime(template) {
  if (!template?.runtimeCtorId) {
    throw new Error('skillCompiler: template missing runtimeCtorId');
  }
  const Ctor = PURE_SKILL_CTORS[template.runtimeCtorId];
  if (!Ctor) {
    throw new Error(`skillCompiler: unknown runtimeCtorId '${template.runtimeCtorId}'`);
  }
  const runtime = new Ctor();
  if (Array.isArray(template?.requiresWeaponType)) {
    runtime.requiresWeaponType = [...template.requiresWeaponType];
  }
  if (typeof template?.requirementHint === 'string' && template.requirementHint.trim()) {
    runtime.requirementHint = template.requirementHint;
  }
  return runtime;
}

/**
 * Compile a migrated template into a SkillOffer-compatible pure skill create function.
 */
export function buildCreateSkillFromTemplate(template) {
  return () => compileSkillTemplateToRuntime(template);
}
