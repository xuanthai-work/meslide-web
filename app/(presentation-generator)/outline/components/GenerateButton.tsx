import React from "react";
import { GSlideButton } from "@/components/gslide";
import { LoadingState } from "../types/index";
import { ChevronRight } from "lucide-react";
import { translate } from "@/i18n/translate";

interface GenerateButtonProps {
  loadingState: LoadingState;
  streamState: { isStreaming: boolean; isLoading: boolean };
  selectedTemplateId: string | null;
  onSubmit: () => void;
}

const GenerateButton: React.FC<GenerateButtonProps> = ({
  loadingState,
  streamState,
  selectedTemplateId,
  onSubmit,
}) => {
  const isDisabled =
    loadingState.isLoading ||
    streamState.isLoading ||
    streamState.isStreaming ||
    !selectedTemplateId;

  const getButtonText = () => {
    if (loadingState.isLoading) return loadingState.message;
    if (streamState.isLoading || streamState.isStreaming) return translate("outline.generateButton.loading");
    if (!selectedTemplateId) return translate("outline.generateButton.selectTemplate");
    return translate("outline.generateButton.continue");
  };

  return (
    <GSlideButton
      disabled={isDisabled}
      onClick={() => {
        onSubmit();
      }}
      className="flex h-[46px] w-fit items-center gap-[2px] px-6 py-3 text-lg font-medium tracking-[-0.18px]"
    >
      {getButtonText()}
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.7}
        className="h-[18px] w-[18px]"
      />
    </GSlideButton>
  );
};

export default GenerateButton;
