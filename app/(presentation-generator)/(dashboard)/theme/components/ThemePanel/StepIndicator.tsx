import React from 'react'

interface StepIndicatorProps {
  currentStep: number
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { step: 1, label: "Thương hiệu" },
    { step: 2, label: "Bảng màu" },
    { step: 3, label: "Font" },
    { step: 4, label: "Logo" },
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
              {`Bước-${step}`}
            </span>
            <span className="text-[11px] font-normal text-black">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
