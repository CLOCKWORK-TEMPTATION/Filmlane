export type ElementType =
  | 'BASMALA'
  | 'SCENE-HEADER-1'
  | 'SCENE-HEADER-2'
  | 'SCENE-HEADER-3'
  | 'ACTION'
  | 'CHARACTER'
  | 'DIALOGUE'
  | 'TRANSITION'
  | 'PARENTHETICAL'; // Added Parenthetical for completeness

export type Patch =
  | { op: 'relabel'; index: number; from: ElementType; to: ElementType }
  | {
      op: 'split_inline';
      index: number;
      delimiter: ':';
      leftType: 'CHARACTER';
      rightType: 'DIALOGUE';
    };

export type ReviewResponse = { patches: Patch[] };

export type LineCandidate = {
  text: string;
  type: ElementType;
  topScore?: number;
  secondScore?: number;
};

export type ReviewRequest = {
  before_context: { text: string; type: ElementType }[];
  pasted_block: LineCandidate[];
  rules: {
    character_requires_colon: boolean;
    dialogue_must_follow_character: boolean;
    no_rewrite_text: boolean;
  };
};
