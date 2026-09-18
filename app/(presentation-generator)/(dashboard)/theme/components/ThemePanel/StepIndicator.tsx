import React from 'react'
import { useT } from '@/i18n/provider'

interface StepIndicatorProps {
  currentStep: number
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const t = useT()
  const steps = [
    { step: 1, label: t('themes.steps.brand') },
    { step: 2, label: t('themes.steps.palette') },
    { step: 3, label: t('themes.steps.fonts') },
    { step: 4, label: t('themes.steps.logo') },
  ]
  return (
    <div className="flex flex-col items-center gap-7 px-4 min-w-[104px] pt-8 border-r border-[#EDEEEF]">
      {steps.map(({ step, label }) => {
        const isActive = currentStep === step
        return (
          <div key={step} className="flex flex-col items-center gap-1.5 px-3  ">
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${isActive
                ? 'bg-[#1D6FE8] text-white'
                : 'bg-white text-[#404348] border border-[#EDEEEF]'
                }`}
            >
              {t('themes.steps.stepLabel', { step })}
            </span>
            <span className="text-[11px] font-normal text-black">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
