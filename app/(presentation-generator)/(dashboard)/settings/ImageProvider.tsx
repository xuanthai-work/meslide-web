import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { LLMConfig } from '@/types/llm_config'
import OpenAICompatibleImageFields from '@/components/OpenAICompatibleImageFields'
import { GPT_IMAGE_1_5_QUALITY_OPTIONS, IMAGE_PROVIDERS } from '@/utils/providerConstants'
import { Check, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
    SettingsField,
    settingsControlClassName,
    settingsDropdownClassName,
    settingsFormColumnClassName,
} from './SettingsField'
import { useT } from '@/i18n/provider'

const ImageProvider = ({ llmConfig, setLlmConfig }: { llmConfig: LLMConfig, setLlmConfig: (config: any) => void }) => {
    const t = useT();
    const [showApiKey, setShowApiKey] = useState(false);
    const [openImageProviderSelect, setOpenImageProviderSelect] = useState(false);
    const [openaiCompatListMeta, setOpenaiCompatListMeta] = useState<{
        modelsChecked: boolean
        modelCount: number
    }>({ modelsChecked: false, modelCount: 0 })

    useEffect(() => {
        if (llmConfig.IMAGE_PROVIDER !== 'openai_compatible') {
            setOpenaiCompatListMeta({ modelsChecked: false, modelCount: 0 })
        }
    }, [llmConfig.IMAGE_PROVIDER])
    const isImageGenerationDisabled = llmConfig.DISABLE_IMAGE_GENERATION ?? false;
    const handleChangeImageGenerationDisabled = (value: boolean) => {
        setLlmConfig((prev: any) => ({
            ...prev,
            DISABLE_IMAGE_GENERATION: value
        }));
    }
    const input_field_changed = (value: string, field: string) => {
        setLlmConfig((prev: any) => ({
            ...prev,
            [field]: value
        }));
    }

    const getFieldValue = (field?: string) => {
        if (!field) return "";
        return (llmConfig as Record<string, string | undefined>)[field] || "";
    };

    const updateFieldValue = (field: string | undefined, value: string) => {
        if (!field) return;
        setLlmConfig((prev: any) => ({
            ...prev,
            [field]: value,
        }));
    };

    const renderQualitySelector = (llmConfig: LLMConfig, input_field_changed: (value: string, field: string) => void) => {
        if (llmConfig.IMAGE_PROVIDER === "gpt-image-1.5") {
            return (
                <SettingsField label={t("settings.image.qualityLabel")}>
                    <Select
                        value={llmConfig.GPT_IMAGE_1_5_QUALITY || 'low'}
                        onValueChange={(value) => input_field_changed(value, "GPT_IMAGE_1_5_QUALITY")}
                    >
                        <SelectTrigger className={settingsDropdownClassName}>
                            <SelectValue placeholder={t("settings.image.selectQuality")} />
                        </SelectTrigger>
                        <SelectContent>
                            {GPT_IMAGE_1_5_QUALITY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsField>
            );
        }

        return null;
    };

    return (
        <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
            <div className="mb-4 rounded-[12px] bg-white px-6 py-6 sm:px-8 sm:py-8">
                <div className="mb-6 flex justify-end">
                    <Switch
                        checked={!isImageGenerationDisabled}
                        onCheckedChange={(checked) => handleChangeImageGenerationDisabled(!checked)}
                        aria-label={t("settings.image.enableDisableAria")}
                    />
                </div>
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
                    <div className="max-w-[280px] shrink-0">
                        <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[4px] bg-[var(--gslide-accent-soft)]">
                            <img src="/image-markup.svg" className="h-full w-full object-cover" alt="" />
                        </div>
                        <h3 className="py-2.5 text-xl font-normal text-[#191919]">{t("settings.image.title")}</h3>
                        <p className="text-sm text-gray-500">
                            {t("settings.image.subtitle")}
                        </p>
                    </div>
                    {!isImageGenerationDisabled && (
                        <div className={settingsFormColumnClassName}>
                            <SettingsField label={t("settings.image.selectProvider")}>
                                <Popover
                                    open={openImageProviderSelect}
                                    onOpenChange={setOpenImageProviderSelect}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openImageProviderSelect}
                                            className={settingsDropdownClassName}
                                        >
                                            <span className="truncate text-sm font-medium text-gray-900">
                                                {llmConfig.IMAGE_PROVIDER
                                                    ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]?.label || llmConfig.IMAGE_PROVIDER
                                                    : t("settings.image.providerPlaceholder")}
                                            </span>
                                            {openImageProviderSelect ? (
                                                <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="p-0"
                                        align="start"
                                        style={{ width: "var(--radix-popover-trigger-width)" }}
                                    >
                                        <Command>
                                            <CommandInput placeholder={t("settings.image.searchProvider")} />
                                            <CommandList>
                                                <CommandEmpty>{t("settings.image.noProvider")}</CommandEmpty>
                                                <CommandGroup>
                                                    {Object.values(IMAGE_PROVIDERS).map((provider) => (
                                                        <CommandItem
                                                            key={provider.value}
                                                            value={provider.value}
                                                            onSelect={(value) => {
                                                                input_field_changed(value, "IMAGE_PROVIDER");
                                                                setOpenImageProviderSelect(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={llmConfig.IMAGE_PROVIDER === provider.value ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"}
                                                            />
                                                            <div className="flex flex-1 flex-col space-y-1">
                                                                <span className="text-sm font-medium capitalize text-gray-900">
                                                                    {provider.label}
                                                                </span>
                                                                <span className="text-xs leading-relaxed text-gray-600">
                                                                    {provider.description}
                                                                </span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </SettingsField>

                            {llmConfig.IMAGE_PROVIDER &&
                                IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER] &&
                                (() => {
                                    const provider = IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER];

                                    if (provider.value === "openai_compatible") {
                                        return (
                                            <OpenAICompatibleImageFields
                                                layout="textProviderSettings"
                                                baseUrl={llmConfig.OPENAI_COMPAT_IMAGE_BASE_URL || ""}
                                                apiKey={llmConfig.OPENAI_COMPAT_IMAGE_API_KEY || ""}
                                                model={llmConfig.OPENAI_COMPAT_IMAGE_MODEL || ""}
                                                onBaseUrlChange={(v) => {
                                                    setLlmConfig((prev: any) => ({ ...prev, OPENAI_COMPAT_IMAGE_BASE_URL: v }));
                                                }}
                                                onApiKeyChange={(v) => {
                                                    setLlmConfig((prev: any) => ({ ...prev, OPENAI_COMPAT_IMAGE_API_KEY: v }));
                                                }}
                                                onModelChange={(v) => {
                                                    setLlmConfig((prev: any) => ({ ...prev, OPENAI_COMPAT_IMAGE_MODEL: v }));
                                                }}
                                                onModelListMetaChange={setOpenaiCompatListMeta}
                                            />
                                        );
                                    }

                                    return (
                                        <SettingsField label={provider.apiKeyFieldLabel ?? t("settings.image.apiKeyLabel")}>
                                            <div className="relative">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    placeholder={t("settings.text.apiKeyPlaceholder", { label: provider.apiKeyFieldLabel ?? t("settings.image.apiKeyLabel") })}
                                                    className={`${settingsControlClassName} pr-10`}
                                                    value={getFieldValue(provider.apiKeyField)}
                                                    onChange={(e) =>
                                                        updateFieldValue(
                                                            provider.apiKeyField,
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey((prev) => !prev)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer bg-white px-2 py-1"
                                                >
                                                    {showApiKey ? <Eye className="h-4 w-4 text-gray-500" /> : <EyeOff className="h-4 w-4 text-gray-500" />}
                                                </button>
                                            </div>
                                        </SettingsField>
                                    );
                                })()}

                            {renderQualitySelector(llmConfig, input_field_changed)}
                        </div>
                    )}
                </div>
            </div>

            {!isImageGenerationDisabled &&
                llmConfig.IMAGE_PROVIDER === "openai_compatible" &&
                openaiCompatListMeta.modelsChecked &&
                openaiCompatListMeta.modelCount === 0 && (
                    <>
                        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                            <p className="text-sm text-yellow-800">
                                {t("settings.common.noModelsFound")}
                            </p>
                        </div>
                        <div className={settingsFormColumnClassName}>
                            <SettingsField label={t("settings.image.imageModelId")}>
                                <input
                                    type="text"
                                    placeholder={t("settings.image.imageModelPlaceholder")}
                                    className={settingsControlClassName}
                                    value={llmConfig.OPENAI_COMPAT_IMAGE_MODEL || ""}
                                    onChange={(e) => {
                                        setLlmConfig((prev: any) => ({
                                            ...prev,
                                            OPENAI_COMPAT_IMAGE_MODEL: e.target.value,
                                        }));
                                    }}
                                />
                            </SettingsField>
                        </div>
                    </>
                )}
        </div>
    )
}

export default ImageProvider
