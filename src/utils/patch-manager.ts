import { AIPatchOp } from './ai-reviewer';
import { getFormatStyles } from './editor-styles';
import { logger } from './logger';

/**
 * Applies AI-suggested patches to the editor content.
 * Uses line-ids to locate elements.
 */
export const applyPatches = (container: HTMLElement, patches: AIPatchOp[]): void => {
  logger.info('PatchManager', `Applying ${patches.length} patches...`);

  patches.forEach((patch) => {
    if (!patch.id) {
      logger.warning('PatchManager', `Skipping patch without ID: ${JSON.stringify(patch)}`);
      return;
    }

    const element = container.querySelector(`[id="${patch.id}"]`);
    if (!element) {
      logger.warning('PatchManager', `Element with ID ${patch.id} not found.`);
      return;
    }

    if (patch.op === 'relabel') {
      applyRelabel(element as HTMLElement, patch);
    } else if (patch.op === 'split_inline') {
      applySplitInline(element as HTMLElement, patch);
    }
  });
};

const applyRelabel = (element: HTMLElement, patch: AIPatchOp) => {
  if (!patch.to) return;

  // update class
  // We assume class is like 'format-action', 'format-dialogue'
  const newClass = `format-${patch.to}`;

  // Remove old format classes
  element.classList.forEach((cls) => {
    if (cls.startsWith('format-')) {
      element.classList.remove(cls);
    }
  });
  element.classList.add(newClass);

  // Update Styles
  // We need to re-apply inline styles for the new type
  // We use default font/size for now or try to preserve?
  // Editor uses '12pt' 'AzarMehrMonospaced-San' usually.
  const styles = getFormatStyles(patch.to, '12pt', 'AzarMehrMonospaced-San');

  // Apply styles
  Object.assign(element.style, styles);

  // If changing to Character, ensure it ends with colon?
  if (patch.to === 'character') {
    if (!element.textContent?.trim().endsWith(':')) {
      element.textContent = (element.textContent || '') + ':';
    }
  }

  logger.info('PatchManager', `Relabeled ${patch.id} to ${patch.to}`);
};

const applySplitInline = (element: HTMLElement, patch: AIPatchOp) => {
  // Handling split is complex because we need to insert a new element AFTER this one.
  // And potentially modify this one.
  // Ops: "from: Action, to: Character+Dialogue"
  // Usually means the element contains "NAME: Dialogue"

  if (!patch.delimiter) return;

  const text = element.textContent || '';
  const parts = text.split(patch.delimiter);
  if (parts.length < 2) return;

  const charName = parts[0].trim();
  const dialogueText = parts.slice(1).join(patch.delimiter).trim();

  // 1. Convert current element to Character
  applyRelabel(element, { ...patch, op: 'relabel', to: 'character' });
  element.textContent = charName + ':';
  element.id = `${patch.id}-char`; // Update ID to specific

  // 2. Create new Dialogue element
  const dialDiv = document.createElement('div');
  dialDiv.className = 'format-dialogue';
  dialDiv.id = `${patch.id}-dial`;
  dialDiv.textContent = dialogueText;
  const dialStyles = getFormatStyles('dialogue', '12pt', 'AzarMehrMonospaced-San');
  Object.assign(dialDiv.style, dialStyles);

  // Insert after
  if (element.nextSibling) {
    element.parentNode?.insertBefore(dialDiv, element.nextSibling);
  } else {
    element.parentNode?.appendChild(dialDiv);
  }

  logger.info('PatchManager', `Split ${patch.id} into Character/Dialogue`);
};
