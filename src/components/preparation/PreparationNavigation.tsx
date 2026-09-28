import { preparationSections, preparationSteps, type PreparationSectionId, type PreparationSectionInfo } from '@/features/preparation/metadata'
import type { PreparationStepId } from '@/features/preparation/preparation'

interface PreparationNavigationProps {
  activeSectionId: PreparationSectionId
  activeStep: PreparationStepId
  completed: PreparationStepId[]
  mobile?: boolean
  onSectionSelect: (sectionId: PreparationSectionId) => void
  onStepSelect: (stepId: PreparationStepId) => void
}

function completedInSection(section: PreparationSectionInfo, completed: PreparationStepId[]): number {
  return section.steps.filter((step) => completed.includes(step)).length
}

export function PreparationNavigation({ activeSectionId, activeStep, completed, mobile = false, onSectionSelect, onStepSelect }: PreparationNavigationProps) {
  return <nav aria-label={mobile ? 'Разделы подготовки на мобильном устройстве' : 'Разделы подготовки'}>
    {preparationSections.map((section) => {
      const isActive = section.id === activeSectionId
      return <section className={isActive ? 'is-active' : ''} key={section.id}>
        <button className="preparation-section-toggle" type="button" aria-expanded={isActive} onClick={() => onSectionSelect(section.id)}><span><strong>{section.label}</strong><small>{completedInSection(section, completed)} из {section.steps.length}</small></span><i aria-hidden="true">{isActive ? '⌃' : '⌄'}</i></button>
        {isActive && <div className="preparation-section-steps">{preparationSteps.filter((step) => step.section === section.id).map((step) => <button type="button" className={activeStep === step.id ? 'is-active' : ''} onClick={() => onStepSelect(step.id)} key={step.id}><span className={completed.includes(step.id) ? 'is-complete' : ''}>{completed.includes(step.id) ? '✓' : ''}</span>{step.label}</button>)}</div>}
      </section>
    })}
  </nav>
}
