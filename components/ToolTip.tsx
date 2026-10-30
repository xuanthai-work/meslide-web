import React from 'react'
import { TooltipContent, Tooltip, TooltipTrigger, TooltipProvider } from './ui/tooltip'

const ToolTip = ({ children, content, className }: { children: React.ReactNode, content: string, className?: string }) => {
    return (
        <div className={className}>
            <TooltipProvider delay={100}>
                <Tooltip>
                    <TooltipTrigger render={children as React.ReactElement} />
                    <TooltipContent>
                        <p>{content}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

export default ToolTip
