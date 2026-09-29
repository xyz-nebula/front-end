export interface PreparationDraft {
  rootConflict: string
  strategicGoal: string
  proposals: string
  layers: {
    economic: string
    legal: string
    technical: string
    technological: string
    emotional: string
    psychological: string
    aesthetic: string
    ethical: string
  }
  swot: {
    strengths: string
    weaknesses: string
    opportunities: string
    threats: string
  }
  negotiationGoal: string
  bargaining: {
    declared: string
    desired: string
    redLine: string
  }
  batna: string
  scenario: string
  opening: string
}

export interface SessionPreparationSnapshot {
  caseId: string
  caseTitle: string
  userRole: string
  opponentRole: string
  selectedRole: 0 | 1
  draft: PreparationDraft
}

export interface PreparationOverview {
  goal: string
  limits: [string, string, string]
  batna: string
  steps: string[]
}
